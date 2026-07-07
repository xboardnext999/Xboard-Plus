<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\GroupBuyActivity;
use App\Models\GroupBuyGroup;
use App\Models\GroupBuyMember;
use App\Models\Order;
use App\Models\Plan;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class GroupBuyService
{
    public function availableActivities(?int $planId = null): Collection
    {
        $now = time();

        return GroupBuyActivity::with(['plan'])
            ->where('status', GroupBuyActivity::STATUS_ENABLED)
            ->when($planId, fn($query) => $query->where('plan_id', $planId))
            ->where(function ($query) use ($now) {
                $query->whereNull('started_at')
                    ->orWhere('started_at', '<=', $now);
            })
            ->where(function ($query) use ($now) {
                $query->whereNull('ended_at')
                    ->orWhere('ended_at', '>=', $now);
            })
            ->orderByDesc('id')
            ->get();
    }

    public function publicGroups(?int $activityId = null): Collection
    {
        $now = time();

        return GroupBuyGroup::with(['activity.plan'])
            ->where('status', GroupBuyGroup::STATUS_OPEN)
            ->when($activityId, fn($query) => $query->where('activity_id', $activityId))
            ->where(function ($query) use ($now) {
                $query->whereNull('expired_at')
                    ->orWhere('expired_at', '>=', $now);
            })
            ->orderByDesc('id')
            ->get();
    }

    public function createGroup(User $user, GroupBuyActivity $activity): GroupBuyGroup
    {
        if (!$activity->isAvailable()) {
            throw new ApiException('拼团活动不可用');
        }

        return DB::transaction(function () use ($user, $activity) {
            $group = GroupBuyGroup::create([
                'activity_id' => $activity->id,
                'leader_user_id' => $user->id,
                'status' => GroupBuyGroup::STATUS_OPEN,
                'required_count' => max(2, (int) $activity->group_size),
                'current_count' => 0,
                'expired_at' => time() + (max(1, (int) $activity->expire_minutes) * 60),
            ]);

            GroupBuyMember::create([
                'group_id' => $group->id,
                'user_id' => $user->id,
                'status' => GroupBuyMember::STATUS_JOINED,
            ]);

            return $group->load(['activity.plan', 'members']);
        });
    }

    public function joinGroup(User $user, GroupBuyGroup $group): GroupBuyGroup
    {
        if (!$group->isOpen() || !$group->activity || !$group->activity->isAvailable()) {
            throw new ApiException('拼团已结束');
        }

        return DB::transaction(function () use ($user, $group) {
            GroupBuyMember::firstOrCreate([
                'group_id' => $group->id,
                'user_id' => $user->id,
            ], [
                'status' => GroupBuyMember::STATUS_JOINED,
            ]);

            return $group->refresh()->load(['activity.plan', 'members']);
        });
    }

    public function applyDiscount(Order $order, Plan $plan, string $period, int $activityId): int
    {
        $activity = GroupBuyActivity::find($activityId);
        if (!$activity || !$activity->isAvailable()) {
            throw new ApiException('拼团活动不可用');
        }
        if ((int) $activity->plan_id !== (int) $plan->id || $activity->period !== $period) {
            throw new ApiException('拼团活动与套餐不匹配');
        }
        if ($order->group_buy_group_id) {
            $group = GroupBuyGroup::find($order->group_buy_group_id);
            if (
                !$group
                || (int) $group->activity_id !== (int) $activity->id
                || !$group->isOpen()
            ) {
                throw new ApiException('拼团队伍不可用');
            }
        }

        $discount = $this->discountAmount($order->total_amount, $activity);
        if ($discount <= 0) {
            return 0;
        }

        $discount = min($discount, (int) $order->total_amount);
        $order->discount_amount = (int) $order->discount_amount + $discount;
        $order->group_buy_activity_id = $activity->id;
        $order->group_buy_discount_amount = $discount;
        $order->total_amount = max(0, (int) $order->total_amount - $discount);

        return $discount;
    }

    public function markOrderPaid(Order $order): void
    {
        if (!$order->group_buy_group_id) {
            return;
        }

        DB::transaction(function () use ($order) {
            $group = GroupBuyGroup::lockForUpdate()->find($order->group_buy_group_id);
            if (!$group) {
                return;
            }

            GroupBuyMember::updateOrCreate([
                'group_id' => $group->id,
                'user_id' => $order->user_id,
            ], [
                'order_id' => $order->id,
                'status' => GroupBuyMember::STATUS_PAID,
            ]);

            $group->current_count = GroupBuyMember::where('group_id', $group->id)
                ->where('status', GroupBuyMember::STATUS_PAID)
                ->count();

            if ($group->current_count >= $group->required_count) {
                $group->status = GroupBuyGroup::STATUS_COMPLETED;
            }

            if ($group->expired_at && $group->expired_at < time() && $group->status === GroupBuyGroup::STATUS_OPEN) {
                $group->status = GroupBuyGroup::STATUS_EXPIRED;
            }

            $group->save();
        });
    }

    private function discountAmount(int $amount, GroupBuyActivity $activity): int
    {
        if ($activity->discount_type === GroupBuyActivity::DISCOUNT_FIXED) {
            return max(0, (int) $activity->discount_value);
        }

        return (int) round($amount * (max(0, min(100, (int) $activity->discount_value)) / 100));
    }
}
