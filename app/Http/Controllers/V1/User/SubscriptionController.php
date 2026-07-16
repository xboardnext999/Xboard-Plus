<?php

namespace App\Http\Controllers\V1\User;

use App\Http\Controllers\Controller;
use App\Models\SubscriptionTransfer;
use App\Models\UserSubscription;
use App\Services\SubscriptionService;
use App\Services\SubscriptionTransferService;
use App\Utils\Helper;
use Illuminate\Http\Request;

class SubscriptionController extends Controller
{
    public function fetch(Request $request)
    {
        $user = $request->user();
        $service = app(SubscriptionService::class);
        $transferService = app(SubscriptionTransferService::class);
        $subscriptions = $service->subscriptionsForUser($user);

        return $this->success([
            'data' => $subscriptions->map(fn(UserSubscription $subscription) => $this->formatSubscription($subscription))->values(),
            'summary' => [
                'active_count' => $subscriptions->where('status', UserSubscription::STATUS_ACTIVE)->count(),
                'frozen_count' => $subscriptions->where('status', UserSubscription::STATUS_FROZEN)->count(),
                'total_transfer_enable' => (int) $subscriptions->where('status', UserSubscription::STATUS_ACTIVE)->sum('transfer_enable'),
            ],
            'transfer' => [
                'enabled' => $transferService->enabled(),
                'fee' => $transferService->fee(),
                'default_fee' => $transferService->fee(),
                'fee_mode' => 'per_plan',
                'history' => $transferService->history($user)
                    ->map(fn(SubscriptionTransfer $transfer) => $this->formatTransfer($transfer, (int) $user->id))
                    ->values(),
            ],
        ]);
    }

    public function freeze(Request $request)
    {
        $request->validate([
            'id' => 'required|integer',
            'days' => 'required|integer|min:1',
            'reason' => 'nullable|string|max:255',
        ]);

        $subscription = $this->findSubscription($request);
        $subscription = app(SubscriptionService::class)->freeze(
            $subscription,
            (int) $request->input('days'),
            $request->input('reason')
        );

        return $this->success($this->formatSubscription($subscription->load('plan')));
    }

    public function unfreeze(Request $request)
    {
        $request->validate([
            'id' => 'required|integer',
        ]);

        $subscription = app(SubscriptionService::class)->unfreeze($this->findSubscription($request));

        return $this->success($this->formatSubscription($subscription->load('plan')));
    }

    public function primary(Request $request)
    {
        $request->validate([
            'id' => 'required|integer',
        ]);

        $subscription = app(SubscriptionService::class)->makePrimary($this->findSubscription($request));

        return $this->success($this->formatSubscription($subscription->load('plan')));
    }

    public function transfer(Request $request)
    {
        $request->validate([
            'id' => 'required|integer',
            'email' => 'required|email|max:255',
        ]);

        $transfer = app(SubscriptionTransferService::class)->transfer(
            $request->user(),
            (int) $request->input('id'),
            (string) $request->input('email')
        );

        return $this->success($this->formatTransfer($transfer, (int) $request->user()->id));
    }

    private function findSubscription(Request $request): UserSubscription
    {
        return UserSubscription::where('id', $request->input('id'))
            ->where('user_id', $request->user()->id)
            ->firstOrFail();
    }

    private function formatSubscription(UserSubscription $subscription): array
    {
        $plan = $subscription->plan;

        return [
            'id' => $subscription->id,
            'plan_id' => $subscription->plan_id,
            'plan_name' => $plan?->name,
            'group_id' => $subscription->group_id,
            'period' => $subscription->period,
            'transfer_enable' => $subscription->transfer_enable,
            'used_traffic' => $subscription->used_traffic,
            'speed_limit' => $subscription->speed_limit,
            'device_limit' => $subscription->device_limit,
            'started_at' => $subscription->started_at,
            'expired_at' => $subscription->expired_at,
            'status' => $subscription->status,
            'status_text' => $this->statusText($subscription->status),
            'can_transfer' => (int) $subscription->status === UserSubscription::STATUS_ACTIVE
                && !$subscription->isExpired()
                && $subscription->frozen_at === null
                && $subscription->freeze_ends_at === null,
            'transfer_fee' => app(SubscriptionTransferService::class)->fee($plan),
            'is_primary' => $subscription->is_primary,
            'frozen_at' => $subscription->frozen_at,
            'freeze_ends_at' => $subscription->freeze_ends_at,
            'freeze_used_days' => $subscription->freeze_used_days,
            'freeze_count' => $subscription->freeze_count,
            'traffic_text' => Helper::trafficConvert($subscription->transfer_enable),
            'plan' => $plan ? [
                'id' => $plan->id,
                'name' => $plan->name,
                'content' => $plan->content,
                'transfer_enable' => $plan->transfer_enable,
                'speed_limit' => $plan->speed_limit,
                'device_limit' => $plan->device_limit,
                'transfer_price' => $plan->transfer_price,
            ] : null,
        ];
    }

    private function statusText(int $status): string
    {
        return match ($status) {
            UserSubscription::STATUS_ACTIVE => '启用中',
            UserSubscription::STATUS_FROZEN => '已冻结',
            UserSubscription::STATUS_EXPIRED => '已过期',
            UserSubscription::STATUS_CANCELLED => '已取消',
            default => '未知',
        };
    }

    private function formatTransfer(SubscriptionTransfer $transfer, int $userId): array
    {
        $isOutgoing = (int) $transfer->from_user_id === $userId;

        return [
            'id' => $transfer->id,
            'subscription_id' => $transfer->subscription_id,
            'direction' => $isOutgoing ? 'out' : 'in',
            'counterparty_email' => $isOutgoing ? $transfer->to_email : $transfer->from_email,
            'plan_name' => $transfer->plan_name,
            'fee' => $transfer->fee,
            'transferred_at' => $transfer->transferred_at,
        ];
    }
}
