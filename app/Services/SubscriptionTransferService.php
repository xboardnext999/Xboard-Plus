<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\SubscriptionTransfer;
use App\Models\User;
use App\Models\UserSubscription;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class SubscriptionTransferService
{
    public function enabled(): bool
    {
        return (bool) admin_setting('subscription_transfer_enable', false);
    }

    public function fee(): int
    {
        return max(0, (int) admin_setting('subscription_transfer_fee', 0));
    }

    public function transfer(User $actor, int $subscriptionId, string $recipientEmail): SubscriptionTransfer
    {
        if (!$this->enabled()) {
            throw new ApiException('套餐转让功能未开启');
        }

        $recipientEmail = strtolower(trim($recipientEmail));
        $recipient = User::byEmail($recipientEmail)->first();
        if (!$recipient) {
            throw new ApiException('接收方账号不存在');
        }
        if ((int) $recipient->id === (int) $actor->id) {
            throw new ApiException('不能将套餐转让给自己');
        }

        return DB::transaction(function () use ($actor, $recipient, $subscriptionId) {
            $users = User::whereIn('id', [$actor->id, $recipient->id])
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            /** @var User|null $sender */
            $sender = $users->get($actor->id);
            /** @var User|null $receiver */
            $receiver = $users->get($recipient->id);
            if (!$sender || !$receiver) {
                throw new ApiException('用户状态已变化，请刷新后重试');
            }
            if ($sender->banned) {
                throw new ApiException('当前账号不可用');
            }
            if ($receiver->banned) {
                throw new ApiException('接收方账号不可用');
            }

            /** @var UserSubscription|null $subscription */
            $subscription = UserSubscription::with('plan')
                ->where('id', $subscriptionId)
                ->where('user_id', $sender->id)
                ->lockForUpdate()
                ->first();
            if (!$subscription) {
                throw new ApiException('套餐不存在或已被转让');
            }
            if ((int) $subscription->status !== UserSubscription::STATUS_ACTIVE || $subscription->isExpired()) {
                throw new ApiException('仅启用中的未过期套餐可以转让');
            }
            if ($subscription->frozen_at !== null || $subscription->freeze_ends_at !== null) {
                throw new ApiException('冻结中的套餐不能转让');
            }

            $fee = $this->fee();
            if ((int) $sender->balance < $fee) {
                throw new ApiException('余额不足，请充值后再转让');
            }

            $receiverHasActive = UserSubscription::where('user_id', $receiver->id)
                ->where('status', UserSubscription::STATUS_ACTIVE)
                ->where(function ($query) {
                    $query->whereNull('expired_at')->orWhere('expired_at', '>=', time());
                })
                ->lockForUpdate()
                ->get(['id'])
                ->isNotEmpty();
            $wasPrimary = (bool) $subscription->is_primary;
            $transferredAt = time();
            $planName = $subscription->plan?->name;
            $senderBalanceBefore = (int) $sender->balance;

            $sender->balance = $senderBalanceBefore - $fee;
            $sender->save();

            $metadata = $subscription->metadata ?: [];
            $metadata['last_transfer'] = [
                'from_user_id' => (int) $sender->id,
                'to_user_id' => (int) $receiver->id,
                'transferred_at' => $transferredAt,
            ];
            $subscription->user_id = $receiver->id;
            $subscription->is_primary = !$receiverHasActive;
            $subscription->metadata = $metadata;
            $subscription->save();

            if ($wasPrimary) {
                $nextPrimary = UserSubscription::where('user_id', $sender->id)
                    ->where('status', UserSubscription::STATUS_ACTIVE)
                    ->where(function ($query) {
                        $query->whereNull('expired_at')->orWhere('expired_at', '>=', time());
                    })
                    ->orderByRaw('expired_at IS NULL DESC')
                    ->orderByDesc('expired_at')
                    ->orderByDesc('id')
                    ->lockForUpdate()
                    ->first();
                if ($nextPrimary) {
                    $nextPrimary->is_primary = true;
                    $nextPrimary->save();
                }
            }

            if (!$receiverHasActive) {
                UserSubscription::where('user_id', $receiver->id)
                    ->where('id', '!=', $subscription->id)
                    ->update(['is_primary' => false, 'updated_at' => $transferredAt]);
            }

            app(SubscriptionService::class)->syncUserFromSubscriptions($sender, true);
            app(SubscriptionService::class)->syncUserFromSubscriptions($receiver, true);

            return SubscriptionTransfer::create([
                'subscription_id' => $subscription->id,
                'from_user_id' => $sender->id,
                'to_user_id' => $receiver->id,
                'plan_id' => $subscription->plan_id,
                'fee' => $fee,
                'from_email' => $sender->email,
                'to_email' => $receiver->email,
                'plan_name' => $planName,
                'transferred_at' => $transferredAt,
                'metadata' => [
                    'direct_transfer' => true,
                    'sender_balance_before' => $senderBalanceBefore,
                    'sender_balance_after' => $senderBalanceBefore - $fee,
                ],
            ]);
        }, 3);
    }

    public function history(User $user): Collection
    {
        return SubscriptionTransfer::where(function ($query) use ($user) {
            $query->where('from_user_id', $user->id)->orWhere('to_user_id', $user->id);
        })
            ->orderByDesc('transferred_at')
            ->orderByDesc('id')
            ->limit(20)
            ->get();
    }
}
