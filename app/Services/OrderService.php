<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Jobs\OrderHandleJob;
use App\Models\GroupBuyActivity;
use App\Models\GroupBuyGroup;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\TrafficResetLog;
use App\Models\User;
use App\Services\Plugin\HookManager;
use App\Utils\Helper;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;
use App\Services\PlanService;

class OrderService
{
    const STR_TO_TIME = [
        Plan::PERIOD_MONTHLY => 1,
        Plan::PERIOD_QUARTERLY => 3,
        Plan::PERIOD_HALF_YEARLY => 6,
        Plan::PERIOD_YEARLY => 12,
        Plan::PERIOD_TWO_YEARLY => 24,
        Plan::PERIOD_THREE_YEARLY => 36
    ];
    public $order;
    public $user;

    public function __construct(Order $order)
    {
        $this->order = $order;
    }

    /**
     * Create an order from a request.
     *
     * @param User $user
     * @param Plan $plan
     * @param string $period
     * @param string|null $couponCode
     * @return Order
     * @throws ApiException
     */
    public static function createFromRequest(
        User $user,
        Plan $plan,
        string $period,
        ?string $couponCode = null,
        ?string $subscriptionMode = null,
        ?int $groupBuyActivityId = null,
        ?int $groupBuyGroupId = null,
    ): Order {
        $userService = app(UserService::class);
        $planService = new PlanService($plan);

        $planService->validatePurchase($user, $period);
        HookManager::call('order.create.before', [$user, $plan, $period, $couponCode]);

        return DB::transaction(function () use ($user, $plan, $period, $couponCode, $subscriptionMode, $groupBuyActivityId, $groupBuyGroupId, $userService) {
            $newPeriod = PlanService::getPeriodKey($period);
            if ($groupBuyGroupId && !$groupBuyActivityId) {
                throw new ApiException('请选择拼团活动');
            }

            if ($groupBuyActivityId) {
                $groupBuyService = app(GroupBuyService::class);
                if ($groupBuyGroupId) {
                    $group = GroupBuyGroup::find($groupBuyGroupId);
                    if (!$group || (int) $group->activity_id !== (int) $groupBuyActivityId) {
                        throw new ApiException('拼团队伍不可用');
                    }
                    $groupBuyService->joinGroup($user, $group);
                } else {
                    $activity = GroupBuyActivity::find($groupBuyActivityId);
                    if (!$activity) {
                        throw new ApiException('拼团活动不可用');
                    }
                    $groupBuyGroupId = $groupBuyService->createGroup($user, $activity)->id;
                }
            }

            $order = new Order([
                'user_id' => $user->id,
                'plan_id' => $plan->id,
                'period' => $newPeriod,
                'trade_no' => Helper::generateOrderNo(),
                'total_amount' => (int) (optional($plan->prices)[$newPeriod] * 100),
                'group_buy_activity_id' => $groupBuyActivityId,
                'group_buy_group_id' => $groupBuyGroupId,
            ]);

            $orderService = new self($order);

            if ($groupBuyActivityId) {
                app(GroupBuyService::class)->applyDiscount($order, $plan, $newPeriod, $groupBuyActivityId);
            }

            if ($couponCode) {
                $orderService->applyCoupon($couponCode);
            }

            $orderService->setVipDiscount($user);
            $orderService->setOrderType($user, $subscriptionMode);
            $orderService->setInvite(user: $user);

            if ($user->balance && $order->total_amount > 0) {
                $orderService->handleUserBalance($user, $userService);
            }

            if (!$order->save()) {
                throw new ApiException(__('Failed to create order'));
            }

            HookManager::call('order.create.after', $order);
            // 兼容旧钩子
            HookManager::call('order.after_create', $order);

            return $order;
        });
    }

    /**
     * Preview an order amount without creating an order, deducting balance,
     * or consuming a coupon.
     */
    public static function quote(
        User $user,
        Plan $plan,
        string $period,
        ?string $couponCode = null,
        ?int $paymentMethodId = null,
        ?string $subscriptionMode = null,
        ?int $groupBuyActivityId = null,
    ): array {
        $planService = new PlanService($plan);
        $planService->validatePurchase($user, $period);

        $newPeriod = PlanService::getPeriodKey($period);
        $order = new Order([
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'period' => $newPeriod,
            'trade_no' => Helper::generateOrderNo(),
            'total_amount' => (int) (optional($plan->prices)[$newPeriod] * 100),
            'group_buy_activity_id' => $groupBuyActivityId,
        ]);

        $orderService = new self($order);
        $originalAmount = (int) $order->total_amount;
        $groupBuyDiscountAmount = 0;
        $coupon = null;
        $couponDiscountAmount = 0;

        if ($groupBuyActivityId) {
            $groupBuyDiscountAmount = app(GroupBuyService::class)->applyDiscount($order, $plan, $newPeriod, $groupBuyActivityId);
        }

        if ($couponCode) {
            $coupon = $orderService->applyCouponForQuote($couponCode);
            $couponDiscountAmount = (int) $order->discount_amount;
        }

        $discountAmountBeforeVip = (int) $order->discount_amount;
        $orderService->setVipDiscount($user);
        $vipDiscountAmount = max(0, (int) $order->discount_amount - $discountAmountBeforeVip);
        $orderService->setOrderType($user, $subscriptionMode);

        if ($user->balance && $order->total_amount > 0) {
            $orderService->applyBalanceForQuote($user);
        }

        $payment = null;
        $handlingAmount = 0;
        if ($paymentMethodId && $order->total_amount > 0) {
            $payment = Payment::select([
                'id',
                'name',
                'payment',
                'icon',
                'handling_fee_fixed',
                'handling_fee_percent'
            ])
                ->where('id', $paymentMethodId)
                ->where('enable', 1)
                ->first();

            if (!$payment) {
                throw new ApiException(__('Payment method is not available'));
            }

            if ($payment->handling_fee_fixed || $payment->handling_fee_percent) {
                $handlingAmount = (int) round(($order->total_amount * ($payment->handling_fee_percent / 100)) + $payment->handling_fee_fixed);
            }
        }

        $totalAmount = max(0, (int) $order->total_amount);
        $handlingAmount = max(0, $handlingAmount);

        return [
            'plan_id' => $plan->id,
            'period' => $newPeriod,
            'order_type' => (int) $order->type,
            'original_amount' => max(0, $originalAmount),
            'discount_amount' => max(0, (int) $order->discount_amount),
            'coupon_discount_amount' => max(0, $couponDiscountAmount),
            'group_buy_discount_amount' => max(0, $groupBuyDiscountAmount),
            'vip_discount_amount' => max(0, $vipDiscountAmount),
            'surplus_amount' => max(0, (int) $order->surplus_amount),
            'surplus_credit' => max(0, (int) $order->surplus_credit),
            'balance_amount' => max(0, (int) $order->balance_amount),
            'handling_amount' => $handlingAmount,
            'total_amount' => $totalAmount,
            'pay_amount' => $totalAmount + $handlingAmount,
            'coupon' => $coupon ? [
                'id' => $coupon->id,
                'code' => $coupon->code,
                'type' => $coupon->type,
                'value' => $coupon->value,
            ] : null,
            'payment' => $payment ? [
                'id' => $payment->id,
                'name' => $payment->name,
                'payment' => $payment->payment,
                'handling_fee_fixed' => $payment->handling_fee_fixed,
                'handling_fee_percent' => $payment->handling_fee_percent,
            ] : null,
        ];
    }

    public function open(): void
    {
        $order = $this->order;
        $plan = Plan::find($order->plan_id);

        HookManager::call('order.open.before', $order);


        DB::transaction(function () use ($order, $plan) {
            $this->user = User::lockForUpdate()->find($order->user_id);
            $subscriptionService = app(SubscriptionService::class);
            $isForwarding = $plan?->isForwarding();
            $isDigital = $plan?->isDigital();
            if (!$isForwarding && !$isDigital && $order->period !== Plan::PERIOD_RESET_TRAFFIC) {
                $subscriptionService->ensureLegacySubscription($this->user);
            }

            if ($order->surplus_credit) {
                $this->user->balance += $order->surplus_credit;
            }

            if ($order->surplus_order_ids) {
                Order::whereIn('id', $order->surplus_order_ids)
                    ->update(['status' => Order::STATUS_DISCOUNTED]);
            }

            if ($isForwarding) {
                $this->buyForwardingPlan($order, $plan);
            } elseif ($isDigital) {
                $this->buyDigitalProduct($order, $plan);
            } else {
                match ((string) $order->period) {
                    Plan::PERIOD_ONETIME => $this->buyByOneTime($plan),
                    Plan::PERIOD_RESET_TRAFFIC => app(TrafficResetService::class)->performReset($this->user, TrafficResetLog::SOURCE_ORDER),
                    default => $this->buyByPeriod($order, $plan),
                };

                $this->setSpeedLimit($plan->speed_limit);
                $this->setDeviceLimit($plan->device_limit);
                $subscriptionService->openFromOrder($this->user, $plan, $order);
            }

            if (!$this->user->save()) {
                throw new \RuntimeException('用户信息保存失败');
            }

            $order->status = Order::STATUS_COMPLETED;
            if (!$order->save()) {
                throw new \RuntimeException('订单信息保存失败');
            }

            if ($order->group_buy_group_id) {
                app(GroupBuyService::class)->markOrderPaid($order);
            }
        });

        $eventId = match ((int) $order->type) {
            Order::STATUS_PROCESSING => admin_setting('new_order_event_id', 0),
            Order::TYPE_RENEWAL => admin_setting('renew_order_event_id', 0),
            Order::TYPE_UPGRADE => admin_setting('change_order_event_id', 0),
            default => 0,
        };

        if ($eventId) {
            $this->openEvent($eventId);
        }

        HookManager::call('order.open.after', $order);
    }


    public function setOrderType(User $user, ?string $subscriptionMode = null)
    {
        $order = $this->order;
        $plan = Plan::find($order->plan_id);
        if ($plan?->isForwarding()) {
            $tunnelId = (int) data_get($plan->product_config, 'tunnel_id');
            $active = $tunnelId && DB::table('flux_user_tunnels')->where('user_id', $user->id)->where('tunnel_id', $tunnelId)
                ->where('enabled', true)->where(function ($query) { $query->whereNull('expires_at')->orWhere('expires_at', '>', time()); })->exists();
            $order->type = $active ? Order::TYPE_RENEWAL : Order::TYPE_NEW_PURCHASE;
            return;
        }
        if ($plan?->isDigital()) {
            $order->type = Order::TYPE_NEW_PURCHASE;
            return;
        }
        if ($order->period === Plan::PERIOD_RESET_TRAFFIC) {
            $order->type = Order::TYPE_RESET_TRAFFIC;
        } else if (in_array($subscriptionMode, ['append', 'multi'], true)) {
            $hasSamePlan = \App\Models\UserSubscription::where('user_id', $user->id)
                ->where('plan_id', $order->plan_id)
                ->where('status', \App\Models\UserSubscription::STATUS_ACTIVE)
                ->where(function ($query) {
                    $query->whereNull('expired_at')
                        ->orWhere('expired_at', '>=', time());
                })
                ->exists();
            if (!$hasSamePlan && (int) $user->plan_id === (int) $order->plan_id && ($user->expired_at === null || $user->expired_at > time())) {
                $hasSamePlan = true;
            }
            $order->type = $hasSamePlan ? Order::TYPE_RENEWAL : Order::TYPE_NEW_PURCHASE;
        } else if ($user->plan_id !== NULL && $order->plan_id !== $user->plan_id && ($user->expired_at > time() || $user->expired_at === NULL)) {
            if (!(int) admin_setting('plan_change_enable', 1))
                throw new ApiException('目前不允许更改订阅，请联系客服或提交工单操作');
            $order->type = Order::TYPE_UPGRADE;
            if ((int) admin_setting('surplus_enable', 1))
                $this->getSurplusValue($user, $order);
            if ($order->surplus_amount >= $order->total_amount) {
                $order->surplus_credit = (int) ($order->surplus_amount - $order->total_amount);
                $order->total_amount = 0;
            } else {
                $order->total_amount = (int) ($order->total_amount - $order->surplus_amount);
            }
        } else if (($user->expired_at === null || $user->expired_at > time()) && $order->plan_id == $user->plan_id) { // 用户订阅未过期或按流量订阅 且购买订阅与当前订阅相同 === 续费
            $order->type = Order::TYPE_RENEWAL;
        } else { // 新购
            $order->type = Order::TYPE_NEW_PURCHASE;
        }
    }

    public function setVipDiscount(User $user)
    {
        $order = $this->order;
        if ($user->discount) {
            $order->discount_amount = $order->discount_amount + ($order->total_amount * ($user->discount / 100));
        }
        $order->total_amount = $order->total_amount - $order->discount_amount;
    }

    public function setInvite(User $user): void
    {
        $order = $this->order;
        if ($user->invite_user_id && ($order->total_amount <= 0))
            return;
        $order->invite_user_id = $user->invite_user_id;
        $inviter = User::find($user->invite_user_id);
        if (!$inviter)
            return;
        $commissionType = (int) $inviter->commission_type;
        if ($commissionType === User::COMMISSION_TYPE_SYSTEM) {
            $commissionType = (bool) admin_setting('commission_first_time_enable', true) ? User::COMMISSION_TYPE_ONETIME : User::COMMISSION_TYPE_PERIOD;
        }
        $isCommission = false;
        switch ($commissionType) {
            case User::COMMISSION_TYPE_PERIOD:
                $isCommission = true;
                break;
            case User::COMMISSION_TYPE_ONETIME:
                $isCommission = !$this->haveValidOrder($user);
                break;
        }

        if (!$isCommission)
            return;
        if ($inviter->commission_rate) {
            $order->commission_balance = $order->total_amount * ($inviter->commission_rate / 100);
        } else {
            $order->commission_balance = $order->total_amount * (admin_setting('invite_commission', 10) / 100);
        }
    }

    private function haveValidOrder(User $user): Order|null
    {
        return Order::where('user_id', $user->id)
            ->whereNotIn('status', [Order::STATUS_PENDING, Order::STATUS_CANCELLED])
            ->first();
    }

    private function getSurplusValue(User $user, Order $order)
    {
        if ($user->expired_at === NULL) {
            $lastOneTimeOrder = Order::where('user_id', $user->id)
                ->where('period', Plan::PERIOD_ONETIME)
                ->where('status', Order::STATUS_COMPLETED)
                ->orderBy('id', 'DESC')
                ->first();
            if (!$lastOneTimeOrder)
                return;
            $nowUserTraffic = Helper::transferToGB($user->transfer_enable);
            if (!$nowUserTraffic)
                return;
            $paidTotalAmount = ($lastOneTimeOrder->total_amount + $lastOneTimeOrder->balance_amount);
            if (!$paidTotalAmount)
                return;
            $trafficUnitPrice = $paidTotalAmount / $nowUserTraffic;
            $notUsedTraffic = $nowUserTraffic - Helper::transferToGB($user->u + $user->d);
            $result = $trafficUnitPrice * $notUsedTraffic;
            $order->surplus_amount = (int) ($result > 0 ? $result : 0);
            $order->surplus_order_ids = Order::where('user_id', $user->id)
                ->where('period', '!=', Plan::PERIOD_RESET_TRAFFIC)
                ->where('status', Order::STATUS_COMPLETED)
                ->pluck('id')
                ->all();
        } else {
            $orders = Order::query()
                ->where('user_id', $user->id)
                ->whereNotIn('period', [Plan::PERIOD_RESET_TRAFFIC, Plan::PERIOD_ONETIME])
                ->where('status', Order::STATUS_COMPLETED)
                ->get();

            if ($orders->isEmpty()) {
                $order->surplus_amount = 0;
                $order->surplus_order_ids = [];
                return;
            }

            $orderAmountSum = $orders->sum(fn($item) => $item->total_amount + $item->balance_amount + $item->surplus_amount - $item->surplus_credit);
            $orderMonthSum = $orders->sum(fn($item) => self::STR_TO_TIME[PlanService::getPeriodKey($item->period)] ?? 0);
            $firstOrderAt = $orders->min('created_at');
            $expiredAt = Carbon::createFromTimestamp($firstOrderAt)->addMonths($orderMonthSum);

            $now = now();
            $totalSeconds = $expiredAt->timestamp - $firstOrderAt;
            $remainSeconds = max(0, $expiredAt->timestamp - $now->timestamp);
            $cycleRatio = $totalSeconds > 0 ? $remainSeconds / $totalSeconds : 0;

            $plan = Plan::find($user->plan_id);
            $totalTraffic = $plan?->transfer_enable * $orderMonthSum;
            $usedTraffic = Helper::transferToGB($user->u + $user->d);
            $remainTraffic = max(0, $totalTraffic - $usedTraffic);
            $trafficRatio = $totalTraffic > 0 ? $remainTraffic / $totalTraffic : 0;

            $ratio = $cycleRatio;
            if (admin_setting('change_order_event_id', 0) == 1) {
                $ratio = min($cycleRatio, $trafficRatio);
            }


            $order->surplus_amount = (int) max(0, $orderAmountSum * $ratio);
            $order->surplus_order_ids = $orders->pluck('id')->all();
        }
    }

    public function paid(string $callbackNo)
    {
        $order = $this->order;
        if ($order->status !== Order::STATUS_PENDING)
            return true;
        $order->status = Order::STATUS_PROCESSING;
        $order->paid_at = time();
        $order->callback_no = $callbackNo;
        if (!$order->save())
            return false;
        try {
            OrderHandleJob::dispatchSync($order->trade_no);
        } catch (\Exception $e) {
            Log::error($e);
            return false;
        }
        return true;
    }

    public function cancel(): bool
    {
        $order = $this->order;
        HookManager::call('order.cancel.before', $order);
        try {
            DB::beginTransaction();
            $order->status = Order::STATUS_CANCELLED;
            if (!$order->save()) {
                throw new \Exception('Failed to save order status.');
            }
            if ($order->balance_amount) {
                $userService = new UserService();
                if (!$userService->addBalance($order->user_id, $order->balance_amount)) {
                    throw new \Exception('Failed to add balance.');
                }
            }
            DB::commit();
            HookManager::call('order.cancel.after', $order);
            return true;
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error($e);
            return false;
        }
    }

    private function setSpeedLimit($speedLimit)
    {
        $this->user->speed_limit = $speedLimit;
    }

    private function setDeviceLimit($deviceLimit)
    {
        $this->user->device_limit = $deviceLimit;
    }

    private function buyByPeriod(Order $order, Plan $plan)
    {
        // change plan process
        if ((int) $order->type === Order::TYPE_UPGRADE) {
            $this->user->expired_at = time();
        }
        $hasAvailableSubscriptions = app(SubscriptionService::class)->hasAvailableSubscriptions($this->user);
        $this->user->transfer_enable = $plan->transfer_enable * 1073741824;
        // 从一次性转换到循环或者新购的时候，重置流量
        if (!$hasAvailableSubscriptions && ($this->user->expired_at === NULL || $order->type === Order::TYPE_NEW_PURCHASE))
            app(TrafficResetService::class)->performReset($this->user, TrafficResetLog::SOURCE_ORDER);
        $this->user->plan_id = $plan->id;
        $this->user->group_id = $plan->group_id;
        $this->user->expired_at = $this->getTime($order->period, $this->user->expired_at);
    }

    private function buyByOneTime(Plan $plan)
    {
        app(TrafficResetService::class)->performReset($this->user, TrafficResetLog::SOURCE_ORDER);
        $this->user->transfer_enable = $plan->transfer_enable * 1073741824;
        $this->user->plan_id = $plan->id;
        $this->user->group_id = $plan->group_id;
        $this->user->expired_at = NULL;
    }

    private function buyForwardingPlan(Order $order, Plan $plan): void
    {
        $config = $plan->product_config ?? [];
        $tunnelId = (int) ($config['tunnel_id'] ?? 0);
        if (!$tunnelId || !DB::table('flux_tunnels')->where('id', $tunnelId)->where('enabled', true)->exists()) {
            throw new ApiException('转发套餐绑定的隧道不可用');
        }
        $now = time();
        $current = DB::table('flux_user_tunnels')->where('user_id', $this->user->id)->where('tunnel_id', $tunnelId)->first();
        $baseExpiry = $current?->expires_at && (int) $current->expires_at > $now ? (int) $current->expires_at : $now;
        $expiry = $order->period === Plan::PERIOD_ONETIME ? null : $this->getTime($order->period, $baseExpiry);
        $trafficGb = (float) ($config['traffic_limit_gb'] ?? $plan->transfer_enable ?? 0);
        $trafficLimit = $trafficGb > 0 ? (int) round($trafficGb * 1073741824) : 0;
        $payload = [
            'speed_limit_id' => !empty($config['speed_limit_id']) ? (int) $config['speed_limit_id'] : null,
            'forward_limit' => max(1, (int) ($config['forward_limit'] ?? 1)),
            'traffic_limit' => $trafficLimit,
            'reset_at' => $now,
            'expires_at' => $expiry,
            'enabled' => true,
            'updated_at' => now(),
        ];
        if ($current) {
            DB::table('flux_user_tunnels')->where('id', $current->id)->update($payload);
        } else {
            DB::table('flux_user_tunnels')->insert($payload + [
                'user_id' => $this->user->id,
                'tunnel_id' => $tunnelId,
                'upload_bytes' => 0,
                'download_bytes' => 0,
                'created_at' => now(),
            ]);
        }
    }

    private function buyDigitalProduct(Order $order, Plan $plan): void
    {
        $item = \App\Models\DigitalProductItem::where('plan_id', $plan->id)
            ->where('status', \App\Models\DigitalProductItem::AVAILABLE)
            ->lockForUpdate()->first();
        if (!$item) throw new ApiException('该数字商品库存不足');
        $item->status = \App\Models\DigitalProductItem::SOLD;
        $item->order_id = $order->id;
        $item->user_id = $this->user->id;
        $item->sold_at = time();
        $item->save();
    }

    /**
     * 计算套餐到期时间
     * @param string $periodKey
     * @param int $timestamp
     * @return int
     * @throws ApiException
     */
    private function getTime(string $periodKey, ?int $timestamp = null): int
    {
        $timestamp = $timestamp < time() ? time() : $timestamp;
        $periodKey = PlanService::getPeriodKey($periodKey);

        if (isset(self::STR_TO_TIME[$periodKey])) {
            $months = self::STR_TO_TIME[$periodKey];
            return Carbon::createFromTimestamp($timestamp)->addMonths($months)->timestamp;
        }

        throw new ApiException('无效的套餐周期');
    }

    private function openEvent($eventId)
    {
        switch ((int) $eventId) {
            case 0:
                break;
            case 1:
                app(TrafficResetService::class)->performReset($this->user, TrafficResetLog::SOURCE_ORDER);
                break;
        }
    }

    protected function applyCoupon(string $couponCode): void
    {
        $couponService = new CouponService($couponCode);
        if (!$couponService->use($this->order)) {
            throw new ApiException(__('Coupon failed'));
        }
        $this->order->coupon_id = $couponService->getId();
    }

    protected function applyCouponForQuote(string $couponCode)
    {
        $couponService = new CouponService($couponCode);
        $couponService->setPlanId($this->order->plan_id);
        $couponService->setUserId($this->order->user_id);
        $couponService->setPeriod($this->order->period);
        $couponService->check();

        $coupon = $couponService->getCoupon();
        switch ($coupon->type) {
            case 1:
                $this->order->discount_amount = $coupon->value;
                break;
            case 2:
                $this->order->discount_amount = $this->order->total_amount * ($coupon->value / 100);
                break;
        }

        if ($this->order->discount_amount > $this->order->total_amount) {
            $this->order->discount_amount = $this->order->total_amount;
        }

        $this->order->coupon_id = $couponService->getId();

        return $coupon;
    }

    /**
     * Summary of handleUserBalance
     * @param User $user
     * @param UserService $userService
     * @return void
     */
    protected function handleUserBalance(User $user, UserService $userService): void
    {
        $remainingBalance = $user->balance - $this->order->total_amount;

        if ($remainingBalance >= 0) {
            if (!$userService->addBalance($this->order->user_id, -$this->order->total_amount)) {
                throw new ApiException(__('Insufficient balance'));
            }
            $this->order->balance_amount = $this->order->total_amount;
            $this->order->total_amount = 0;
        } else {
            if (!$userService->addBalance($this->order->user_id, -$user->balance)) {
                throw new ApiException(__('Insufficient balance'));
            }
            $this->order->balance_amount = $user->balance;
            $this->order->total_amount = $this->order->total_amount - $user->balance;
        }
    }

    protected function applyBalanceForQuote(User $user): void
    {
        $balance = max(0, (int) $user->balance);
        if ($balance <= 0 || $this->order->total_amount <= 0) {
            return;
        }

        $balanceAmount = min($balance, (int) $this->order->total_amount);
        $this->order->balance_amount = $balanceAmount;
        $this->order->total_amount = (int) $this->order->total_amount - $balanceAmount;
    }
}
