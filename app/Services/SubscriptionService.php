<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Order;
use App\Models\Plan;
use App\Models\SubscriptionFreeze;
use App\Models\User;
use App\Models\UserSubscription;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class SubscriptionService
{
    private const STR_TO_TIME = [
        Plan::PERIOD_MONTHLY => 1,
        Plan::PERIOD_QUARTERLY => 3,
        Plan::PERIOD_HALF_YEARLY => 6,
        Plan::PERIOD_YEARLY => 12,
        Plan::PERIOD_TWO_YEARLY => 24,
        Plan::PERIOD_THREE_YEARLY => 36,
    ];

    public function ensureLegacySubscription(User $user): void
    {
        if (!$user->id || UserSubscription::where('user_id', $user->id)->exists()) {
            return;
        }

        if (!$user->plan_id) {
            return;
        }

        $plan = Plan::find($user->plan_id);
        if (!$plan) {
            return;
        }

        UserSubscription::create([
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'order_id' => null,
            'group_id' => $user->group_id ?: $plan->group_id,
            'period' => $user->expired_at === null ? Plan::PERIOD_ONETIME : null,
            'transfer_enable' => $user->transfer_enable ?: $this->planTrafficBytes($plan),
            'speed_limit' => $user->speed_limit ?? $plan->speed_limit,
            'device_limit' => $user->device_limit ?? $plan->device_limit,
            'started_at' => time(),
            'expired_at' => $user->expired_at,
            'status' => $this->legacyStatus($user),
            'is_primary' => true,
            'metadata' => ['source' => 'legacy'],
        ]);
    }

    public function hasAvailableSubscriptions(User $user): bool
    {
        $this->ensureLegacySubscription($user);
        $this->expireStale($user);

        return UserSubscription::where('user_id', $user->id)
            ->where('status', UserSubscription::STATUS_ACTIVE)
            ->where(function ($query) {
                $query->whereNull('expired_at')
                    ->orWhere('expired_at', '>=', time());
            })
            ->exists();
    }

    public function subscriptionsForUser(User $user): Collection
    {
        $this->ensureLegacySubscription($user);
        $this->expireStale($user);

        return UserSubscription::with(['plan'])
            ->where('user_id', $user->id)
            ->orderByRaw('status = ? DESC', [UserSubscription::STATUS_ACTIVE])
            ->orderByRaw('expired_at IS NULL DESC')
            ->orderByDesc('expired_at')
            ->orderByDesc('id')
            ->get();
    }

    public function activeGroupIds(User $user): array
    {
        $this->ensureLegacySubscription($user);
        $this->expireStale($user);

        $groupIds = UserSubscription::where('user_id', $user->id)
            ->where('status', UserSubscription::STATUS_ACTIVE)
            ->where(function ($query) {
                $query->whereNull('expired_at')
                    ->orWhere('expired_at', '>=', time());
            })
            ->pluck('group_id')
            ->filter()
            ->map(fn($groupId) => (int) $groupId)
            ->unique()
            ->values()
            ->all();

        if (empty($groupIds) && $user->group_id) {
            return [(int) $user->group_id];
        }

        return $groupIds;
    }

    public function openFromOrder(User $user, Plan $plan, Order $order): ?UserSubscription
    {
        if ($order->period === Plan::PERIOD_RESET_TRAFFIC) {
            return null;
        }

        $this->ensureLegacySubscription($user);
        $this->expireStale($user);

        if ((int) $order->type === Order::TYPE_UPGRADE) {
            UserSubscription::where('user_id', $user->id)
                ->whereIn('status', [UserSubscription::STATUS_ACTIVE, UserSubscription::STATUS_FROZEN])
                ->update([
                    'status' => UserSubscription::STATUS_CANCELLED,
                    'is_primary' => false,
                    'updated_at' => time(),
                ]);
        }

        $subscription = null;
        if ((int) $order->type === Order::TYPE_RENEWAL) {
            $subscription = UserSubscription::where('user_id', $user->id)
                ->where('plan_id', $plan->id)
                ->whereIn('status', [UserSubscription::STATUS_ACTIVE, UserSubscription::STATUS_FROZEN])
                ->orderByRaw('expired_at IS NULL DESC')
                ->orderByDesc('expired_at')
                ->orderByDesc('id')
                ->first();
        }

        if (!$subscription) {
            $subscription = new UserSubscription([
                'user_id' => $user->id,
                'plan_id' => $plan->id,
                'started_at' => time(),
                'status' => UserSubscription::STATUS_ACTIVE,
                'is_primary' => !UserSubscription::where('user_id', $user->id)
                    ->where('status', UserSubscription::STATUS_ACTIVE)
                    ->where(function ($query) {
                        $query->whereNull('expired_at')
                            ->orWhere('expired_at', '>=', time());
                    })
                    ->exists(),
            ]);
        }

        $subscription->order_id = $order->id;
        $subscription->plan_id = $plan->id;
        $subscription->group_id = $plan->group_id;
        $subscription->period = PlanService::getPeriodKey((string) $order->period);
        $subscription->transfer_enable = $this->planTrafficBytes($plan);
        $subscription->speed_limit = $plan->speed_limit;
        $subscription->device_limit = $plan->device_limit;
        $subscription->status = UserSubscription::STATUS_ACTIVE;
        $subscription->frozen_at = null;
        $subscription->freeze_ends_at = null;

        if ((string) $order->period === Plan::PERIOD_ONETIME) {
            $subscription->expired_at = null;
        } elseif ((int) $order->type === Order::TYPE_RENEWAL && $subscription->exists) {
            $subscription->expired_at = $this->advanceExpiration((string) $order->period, $subscription->expired_at);
        } else {
            $subscription->expired_at = $this->advanceExpiration((string) $order->period, null);
        }

        $subscription->save();

        if ((int) $order->type === Order::TYPE_UPGRADE || !$this->primarySubscription($user)) {
            $this->setPrimary($subscription);
        }

        $this->syncUserFromSubscriptions($user);

        return $subscription;
    }

    public function syncUserFromSubscriptions(User $user, bool $save = false): User
    {
        if (!$user->id) {
            return $user;
        }

        $subscriptionCount = UserSubscription::where('user_id', $user->id)->count();
        if ($subscriptionCount === 0) {
            return $user;
        }

        $this->expireStale($user);

        $activeSubscriptions = UserSubscription::where('user_id', $user->id)
            ->where('status', UserSubscription::STATUS_ACTIVE)
            ->where(function ($query) {
                $query->whereNull('expired_at')
                    ->orWhere('expired_at', '>=', time());
            })
            ->orderByDesc('is_primary')
            ->orderByRaw('expired_at IS NULL DESC')
            ->orderByDesc('expired_at')
            ->orderByDesc('id')
            ->get();

        if ($activeSubscriptions->isEmpty()) {
            $user->plan_id = null;
            $user->group_id = null;
            $user->transfer_enable = 0;
            $user->speed_limit = null;
            $user->device_limit = null;
            $user->expired_at = time();
            if ($save) {
                $user->save();
            }
            return $user;
        }

        $primary = $activeSubscriptions->firstWhere('is_primary', true) ?: $activeSubscriptions->first();
        $groupIds = $activeSubscriptions->pluck('group_id')->filter()->values();
        $expires = $activeSubscriptions->pluck('expired_at')->filter()->values();

        $user->plan_id = $primary->plan_id;
        $user->group_id = $primary->group_id ?: $groupIds->first();
        $user->transfer_enable = (int) $activeSubscriptions->sum('transfer_enable');
        $user->speed_limit = $this->maxNullable($activeSubscriptions->pluck('speed_limit'));
        $user->device_limit = $this->maxNullable($activeSubscriptions->pluck('device_limit'));
        $user->expired_at = $activeSubscriptions->contains(fn(UserSubscription $item) => $item->expired_at === null)
            ? null
            : ($expires->max() ?: time());

        if ($save) {
            $user->save();
        }

        return $user;
    }

    public function freeze(UserSubscription $subscription, int $days, ?string $reason = null): UserSubscription
    {
        if ($subscription->status !== UserSubscription::STATUS_ACTIVE || $subscription->isExpired()) {
            throw new ApiException('当前订阅不可冻结');
        }

        $maxDays = max(1, (int) admin_setting('subscription_freeze_max_days', 30));
        if ($days < 1 || $days > $maxDays) {
            throw new ApiException("冻结天数需在 1-{$maxDays} 天之间");
        }

        $now = time();
        $subscription->status = UserSubscription::STATUS_FROZEN;
        $subscription->frozen_at = $now;
        $subscription->freeze_ends_at = $now + ($days * 86400);
        $subscription->freeze_count = (int) $subscription->freeze_count + 1;
        $subscription->save();

        SubscriptionFreeze::create([
            'subscription_id' => $subscription->id,
            'user_id' => $subscription->user_id,
            'started_at' => $now,
            'days' => $days,
            'status' => SubscriptionFreeze::STATUS_FROZEN,
            'reason' => $reason,
        ]);

        $this->syncUserFromSubscriptions($subscription->user()->first(), true);

        return $subscription->refresh();
    }

    public function unfreeze(UserSubscription $subscription): UserSubscription
    {
        if ($subscription->status !== UserSubscription::STATUS_FROZEN) {
            throw new ApiException('当前订阅未冻结');
        }

        $now = time();
        $freeze = SubscriptionFreeze::where('subscription_id', $subscription->id)
            ->where('status', SubscriptionFreeze::STATUS_FROZEN)
            ->orderByDesc('id')
            ->first();
        $startedAt = $subscription->frozen_at ?: ($freeze->started_at ?? $now);
        $frozenSeconds = max(0, $now - (int) $startedAt);

        if ($subscription->expired_at !== null) {
            $subscription->expired_at = (int) $subscription->expired_at + $frozenSeconds;
        }

        $subscription->status = UserSubscription::STATUS_ACTIVE;
        $subscription->frozen_at = null;
        $subscription->freeze_ends_at = null;
        $subscription->freeze_used_days = (int) $subscription->freeze_used_days + max(1, (int) ceil($frozenSeconds / 86400));
        $subscription->save();

        if ($freeze) {
            $freeze->ended_at = $now;
            $freeze->status = SubscriptionFreeze::STATUS_UNFROZEN;
            $freeze->save();
        }

        $this->syncUserFromSubscriptions($subscription->user()->first(), true);

        return $subscription->refresh();
    }

    public function makePrimary(UserSubscription $subscription): UserSubscription
    {
        if ($subscription->status !== UserSubscription::STATUS_ACTIVE || $subscription->isExpired()) {
            throw new ApiException('当前订阅不可设为主订阅');
        }

        $this->setPrimary($subscription);
        $this->syncUserFromSubscriptions($subscription->user()->first(), true);

        return $subscription->refresh();
    }

    private function expireStale(User $user): void
    {
        $this->releaseExpiredFreezes($user);

        UserSubscription::where('user_id', $user->id)
            ->whereIn('status', [UserSubscription::STATUS_ACTIVE, UserSubscription::STATUS_FROZEN])
            ->whereNotNull('expired_at')
            ->where('expired_at', '<', time())
            ->update([
                'status' => UserSubscription::STATUS_EXPIRED,
                'is_primary' => false,
                'updated_at' => time(),
            ]);
    }

    private function releaseExpiredFreezes(User $user): void
    {
        $now = time();
        $subscriptions = UserSubscription::where('user_id', $user->id)
            ->where('status', UserSubscription::STATUS_FROZEN)
            ->whereNotNull('freeze_ends_at')
            ->where('freeze_ends_at', '<=', $now)
            ->get();

        foreach ($subscriptions as $subscription) {
            $startedAt = $subscription->frozen_at ?: $subscription->freeze_ends_at;
            $frozenSeconds = max(0, $now - (int) $startedAt);

            if ($subscription->expired_at !== null) {
                $subscription->expired_at = (int) $subscription->expired_at + $frozenSeconds;
            }

            $subscription->status = UserSubscription::STATUS_ACTIVE;
            $subscription->frozen_at = null;
            $subscription->freeze_ends_at = null;
            $subscription->freeze_used_days = (int) $subscription->freeze_used_days + max(1, (int) ceil($frozenSeconds / 86400));
            $subscription->save();

            $freeze = SubscriptionFreeze::where('subscription_id', $subscription->id)
                ->where('status', SubscriptionFreeze::STATUS_FROZEN)
                ->orderByDesc('id')
                ->first();

            if ($freeze) {
                $freeze->ended_at = $now;
                $freeze->status = SubscriptionFreeze::STATUS_UNFROZEN;
                $freeze->save();
            }
        }
    }

    private function primarySubscription(User $user): ?UserSubscription
    {
        return UserSubscription::where('user_id', $user->id)
            ->where('status', UserSubscription::STATUS_ACTIVE)
            ->where('is_primary', true)
            ->first();
    }

    private function setPrimary(UserSubscription $subscription): void
    {
        UserSubscription::where('user_id', $subscription->user_id)
            ->where('id', '!=', $subscription->id)
            ->update(['is_primary' => false, 'updated_at' => time()]);

        $subscription->is_primary = true;
        $subscription->save();
    }

    private function legacyStatus(User $user): int
    {
        if ($user->expired_at !== null && (int) $user->expired_at < time()) {
            return UserSubscription::STATUS_EXPIRED;
        }

        return UserSubscription::STATUS_ACTIVE;
    }

    private function planTrafficBytes(Plan $plan): int
    {
        return (int) $plan->transfer_enable * 1073741824;
    }

    private function advanceExpiration(string $period, ?int $timestamp = null): int
    {
        $timestamp = $timestamp && $timestamp > time() ? $timestamp : time();
        $periodKey = PlanService::getPeriodKey($period);

        if (!isset(self::STR_TO_TIME[$periodKey])) {
            throw new ApiException('无效的套餐周期');
        }

        return Carbon::createFromTimestamp($timestamp)
            ->addMonths(self::STR_TO_TIME[$periodKey])
            ->timestamp;
    }

    private function maxNullable(Collection $values): ?int
    {
        $filtered = $values
            ->filter(fn($value) => $value !== null && $value !== '')
            ->map(fn($value) => (int) $value);

        return $filtered->isEmpty() ? null : $filtered->max();
    }
}
