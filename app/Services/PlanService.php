<?php

namespace App\Services;

use App\Models\Plan;
use App\Models\User;
use App\Models\UserSubscription;
use App\Exceptions\ApiException;
use Illuminate\Database\Eloquent\Collection;
use App\Models\DigitalProductItem;

class PlanService
{
    public Plan $plan;

    public function __construct(Plan $plan)
    {
        $this->plan = $plan;
    }

    /**
     * 获取所有可销售的订阅计划列表
     * 条件：show 和 sell 为 true，且容量充足
     *
     * @return Collection
     */
    public function getAvailablePlans(?string $productType = 'subscription'): Collection
    {
        $plans = Plan::when($productType, fn ($query) => $query->where('product_type', $productType))
            ->when($productType === 'digital', fn($query) => $query->withCount([
                'digitalItems as stock_count' => fn($items) => $items->where('status', \App\Models\DigitalProductItem::AVAILABLE),
                'digitalItems as sold_count' => fn($items) => $items->where('status', \App\Models\DigitalProductItem::SOLD),
            ]))
            ->where('show', true)
            ->where('sell', true)
            ->orderBy('sort')
            ->get()
            ->filter(function ($plan) {
                return $this->hasCapacity($plan);
            });
        if ($productType === 'digital' && $plans->isNotEmpty()) {
            $stocks = DigitalProductItem::whereIn('plan_id', $plans->pluck('id'))->where('status', DigitalProductItem::AVAILABLE)
                ->selectRaw("plan_id, COALESCE(package_id, '') package_key, COUNT(*) aggregate")
                ->groupBy('plan_id', 'package_id')->get()->groupBy('plan_id');
            $plans->each(function (Plan $plan) use ($stocks): void {
                $rows = $stocks->get($plan->id, collect());
                $common = (int) ($rows->firstWhere('package_key', '')?->aggregate ?? 0);
                $config = $plan->product_config ?: [];
                $config['packages'] = collect($config['packages'] ?? [])->map(function ($package) use ($rows, $common) {
                    $package['stock_count'] = (int) ($rows->firstWhere('package_key', (string) ($package['id'] ?? ''))?->aggregate ?? 0) + $common;
                    return $package;
                })->values()->all();
                $plan->product_config = $config;
            });
        }
        return $plans;
    }

    /**
     * 获取指定订阅计划的可用状态
     * 条件：renew 和 sell 为 true
     *
     * @param int $planId
     * @return Plan|null
     */
    public function getAvailablePlan(int $planId): ?Plan
    {
        return Plan::where('id', $planId)
            ->where('sell', true)
            ->where('renew', true)
            ->first();
    }

    /**
     * 检查指定计划是否可用于指定用户
     * 
     * @param Plan $plan
     * @param User $user
     * @return bool
     */
    public function isPlanAvailableForUser(Plan $plan, User $user): bool
    {
        // 如果是续费
        if ($user->plan_id === $plan->id) {
            return $plan->renew;
        }

        // 如果是新购
        return $plan->show && $plan->sell && $this->hasCapacity($plan);
    }

    public function validatePurchase(User $user, string $period): void
    {
        if (!$this->plan) {
            throw new ApiException(__('Subscription plan does not exist'));
        }

        if ($this->plan->isForwarding()) {
            $this->validateForwardingPurchase($user, $period);
            return;
        }
        if ($this->plan->isDigital()) {
            $this->validateDigitalPurchase($period);
            return;
        }

        // 转换周期格式为新版格式
        $periodKey = self::getPeriodKey($period);
        $price = $this->plan->prices[$periodKey] ?? null;

        if ($price === null) {
            throw new ApiException(__('This payment period cannot be purchased, please choose another period'));
        }

        if ($periodKey === Plan::PERIOD_RESET_TRAFFIC) {
            $this->validateResetTrafficPurchase($user);
            return;
        }

        if ($user->plan_id !== $this->plan->id && !$this->hasCapacity($this->plan)) {
            throw new ApiException(__('Current product is sold out'));
        }

        $this->validatePlanAvailability($user);
    }

    protected function validateForwardingPurchase(User $user, string $period): void
    {
        $periodKey = self::getPeriodKey($period);
        if ($periodKey === Plan::PERIOD_RESET_TRAFFIC) throw new ApiException('转发套餐不支持流量重置周期');
        if (!isset(($this->plan->prices ?? [])[$periodKey]) || (float) $this->plan->prices[$periodKey] <= 0) throw new ApiException(__('This payment period cannot be purchased, please choose another period'));
        $config = $this->plan->product_config ?? [];
        if (empty($config['tunnel_id'])) throw new ApiException('该转发套餐尚未配置隧道');
        if (!$this->plan->show || !$this->plan->sell) throw new ApiException(__('This subscription has been sold out, please choose another subscription'));
        if (!$this->hasCapacity($this->plan)) throw new ApiException(__('Current product is sold out'));
    }

    protected function validateDigitalPurchase(string $period): void
    {
        $periodKey = self::getPeriodKey($period);
        if (self::priceForPeriod($this->plan, $periodKey) === null) {
            throw new ApiException(__('This payment period cannot be purchased, please choose another period'));
        }
        if (!$this->plan->show || !$this->plan->sell) throw new ApiException('该数字商品暂不可购买');
        $selectedPackage = collect((array) data_get($this->plan->product_config, 'packages', []))->firstWhere('id', $periodKey);
        if (!\App\Models\DigitalProductItem::where('plan_id', $this->plan->id)->where('status', \App\Models\DigitalProductItem::AVAILABLE)
            ->when($selectedPackage, fn($query) => $query->where(function ($query) use ($selectedPackage) {
                $query->where('package_id', $selectedPackage['id'])->orWhereNull('package_id');
            }))
            ->exists()) {
            throw new ApiException('该数字商品库存不足');
        }
    }

    public static function priceForPeriod(Plan $plan, string $period): ?float
    {
        $key = self::getPeriodKey($period);
        $price = ($plan->prices ?? [])[$key] ?? null;
        if ($price !== null && (float) $price > 0) return (float) $price;
        if ($plan->isDigital()) {
            foreach ((array) data_get($plan->product_config, 'packages', []) as $package) {
                if ((string) ($package['id'] ?? '') === (string) $period || (string) ($package['slug'] ?? '') === (string) $period) {
                    return (float) ($package['price'] ?? 0) > 0 ? (float) $package['price'] : null;
                }
            }
        }
        return null;
    }

    /**
     * 智能转换周期格式为新版格式
     * 如果是新版格式直接返回，如果是旧版格式则转换为新版格式
     *
     * @param string $period
     * @return string
     */
    public static function getPeriodKey(string $period): string
    {
        // 如果是新版格式直接返回
        if (in_array($period, self::getNewPeriods())) {
            return $period;
        }

        // 如果是旧版格式则转换为新版格式
        return Plan::LEGACY_PERIOD_MAPPING[$period] ?? $period;
    }
    /**
     * 只能转换周期格式为旧版本
     */
    public static function convertToLegacyPeriod(string $period): string
    {
        $flippedMapping = array_flip(Plan::LEGACY_PERIOD_MAPPING);
        return $flippedMapping[$period] ?? $period;
    }

    /**
     * 获取所有支持的新版周期格式
     *
     * @return array
     */
    public static function getNewPeriods(): array
    {
        return array_values(Plan::LEGACY_PERIOD_MAPPING);
    }

    /**
     * 获取旧版周期格式
     *
     * @param string $period
     * @return string
     */
    public static function getLegacyPeriod(string $period): string
    {
        $flipped = array_flip(Plan::LEGACY_PERIOD_MAPPING);
        return $flipped[$period] ?? $period;
    }

    protected function validateResetTrafficPurchase(User $user): void
    {
        if (!app(UserService::class)->isAvailable($user) || $this->plan->id !== $user->plan_id) {
            throw new ApiException(__('Subscription has expired or no active subscription, unable to purchase Data Reset Package'));
        }
    }

    protected function validatePlanAvailability(User $user): void
    {
        if ((!$this->plan->show && !$this->plan->renew) || (!$this->plan->show && $user->plan_id !== $this->plan->id)) {
            throw new ApiException(__('This subscription has been sold out, please choose another subscription'));
        }

        if (!$this->plan->renew && $user->plan_id == $this->plan->id) {
            throw new ApiException(__('This subscription cannot be renewed, please change to another subscription'));
        }

        if (!$this->plan->show && $this->plan->renew && !app(UserService::class)->isAvailable($user)) {
            throw new ApiException(__('This subscription has expired, please change to another subscription'));
        }
    }

    public function hasCapacity(Plan $plan): bool
    {
        if ($plan->capacity_limit === null) {
            return true;
        }

        $activeSubscriptionCount = UserSubscription::where('plan_id', $plan->id)
            ->where('status', UserSubscription::STATUS_ACTIVE)
            ->where(function ($query) {
                $query->where('expired_at', '>=', time())
                    ->orWhereNull('expired_at');
            })
            ->count();
        $legacyUserCount = User::where('plan_id', $plan->id)
            ->where(function ($query) {
                $query->where('expired_at', '>=', time())
                    ->orWhereNull('expired_at');
            })
            ->whereNotExists(function ($query) {
                $query->selectRaw(1)
                    ->from('v2_user_subscription')
                    ->whereColumn('v2_user_subscription.user_id', 'v2_user.id');
            })
            ->count();
        $activeUserCount = $activeSubscriptionCount + $legacyUserCount;

        return ($plan->capacity_limit - $activeUserCount) > 0;
    }

    public function getAvailablePeriods(Plan $plan): array
    {
        return array_filter(
            $plan->getActivePeriods(),
            fn($period) => isset($plan->prices[$period]) && $plan->prices[$period] > 0
        );
    }

    public function canResetTraffic(Plan $plan): bool
    {
        return $plan->reset_traffic_method !== Plan::RESET_TRAFFIC_NEVER
            && $plan->getResetTrafficPrice() > 0;
    }
}
