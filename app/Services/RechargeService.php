<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Recharge;
use App\Models\User;
use App\Services\Plugin\HookManager;
use App\Utils\Helper;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class RechargeService
{
    public function __construct(
        public Recharge $recharge
    ) {
    }

    public static function create(User $user, int $amount): Recharge
    {
        if ($amount <= 0) {
            throw new ApiException(__('Invalid recharge amount'));
        }

        return DB::transaction(function () use ($user, $amount) {
            HookManager::call('recharge.create.before', [$user, $amount]);

            $recharge = Recharge::create([
                'user_id' => $user->id,
                'trade_no' => Helper::generateOrderNo(),
                'amount' => $amount,
                'status' => Recharge::STATUS_PENDING,
            ]);

            HookManager::call('recharge.create.after', $recharge);

            return $recharge;
        });
    }

    public function paid(string $callbackNo): bool
    {
        try {
            DB::transaction(function () use ($callbackNo) {
                $recharge = Recharge::lockForUpdate()->find($this->recharge->id);

                if (!$recharge) {
                    throw new \RuntimeException('充值记录不存在');
                }

                if ($recharge->status === Recharge::STATUS_COMPLETED) {
                    return;
                }

                if ($recharge->status !== Recharge::STATUS_PENDING) {
                    throw new \RuntimeException('当前充值记录状态不可入账');
                }

                HookManager::call('recharge.paid.before', $recharge);

                $user = User::lockForUpdate()->find($recharge->user_id);
                if (!$user) {
                    throw new \RuntimeException('用户不存在');
                }

                $user->balance += $recharge->amount;
                if (!$user->save()) {
                    throw new \RuntimeException('用户余额保存失败');
                }

                $recharge->status = Recharge::STATUS_COMPLETED;
                $recharge->paid_at = time();
                $recharge->callback_no = $callbackNo;
                if (!$recharge->save()) {
                    throw new \RuntimeException('充值记录保存失败');
                }

                HookManager::call('recharge.paid.after', $recharge);
            });

            return true;
        } catch (\Throwable $e) {
            Log::error($e);
            return false;
        }
    }

    public function cancel(): bool
    {
        try {
            DB::transaction(function () {
                $recharge = Recharge::lockForUpdate()->find($this->recharge->id);

                if (!$recharge) {
                    throw new \RuntimeException('充值记录不存在');
                }

                if ($recharge->status !== Recharge::STATUS_PENDING) {
                    throw new \RuntimeException('只能取消待支付的充值记录');
                }

                $recharge->status = Recharge::STATUS_CANCELLED;
                if (!$recharge->save()) {
                    throw new \RuntimeException('充值记录保存失败');
                }
            });

            return true;
        } catch (\Throwable $e) {
            Log::error($e);
            return false;
        }
    }
}
