<?php

namespace Plugin\XboardNext\Controllers;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UserUpdate;
use App\Models\Payment;
use App\Models\User;
use App\Support\RedisGuard;
use Plugin\XboardNext\Services\PaymentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class AmountController extends Controller
{

    protected $redis;

    public function __construct()
    {
        $this->redis = $this->makeRedisConnection();
    }

    public function save(UserUpdate $request)
    {
        $decodedData = base64_decode(base64_decode(base64_decode($request->header('auth-param'))));
        $json = json_decode($decodedData, true);
        if (json_last_error() != JSON_ERROR_NONE) {
            Log::error("JSON解析失败: " . json_last_error_msg() . "\n");
            return $this->fail([401, '非法操作, 请联系管理员']);
        }
        $params = $request->validated();
        $id = $request->user()->id;
        $email = $request->user()->email;
        if ($json['email'] != $email || $json['balance'] != $request->input('balance')) {
            return $this->fail([400, '非法操作, 请确认']);
        }
        $user = User::find($id);
        if (!$user || $json['email'] != $user->email) {
            return $this->fail([400202, '用户不存在']);
        }
        try {
            $rechargeBalance = (float) $json['balance'];
            $currentBalance = (int) ($user->balance ?? 0);
            $params['balance'] = $currentBalance + (int) round($rechargeBalance * 100);
            $user->update($params);
        } catch (\Exception $e) {
            Log::error($e);
            return $this->fail([500, '保存失败']);
        }
        return $this->success(true);
    }

    public function checkout(Request $request)
    {
        $tradeNo = $request->input('trade_no');
        $method = $request->input('method');
        $balance = $request->input('balance');
        $origin = $request->input('origin');
        if (empty($tradeNo) || empty($method) || empty($balance) || empty($origin)) {
            return $this->fail([422, __('Invalid parameter')]);
        }
        $this->stateSet('xboard_next_origin', $origin);
        $this->stateSet($tradeNo, $balance);
        $decodedData = base64_decode(base64_decode(base64_decode($request->header('auth-param'))));
        $json = json_decode($decodedData, true);
        if (json_last_error() != JSON_ERROR_NONE) {
            Log::error("JSON解析失败: " . json_last_error_msg() . "\n");
            return $this->fail([401, '非法操作, 请联系管理员']);
        }
        $id = $request->user()->id;
        $email = $request->user()->email;
        if ($json['email'] != $email || $json['balance'] != $balance) {
            return $this->fail([400, '非法操作, 请确认']);
        }
        $payment = Payment::find($method);
        if (!$payment || !$payment->enable) {
            return $this->fail([400, __('Payment method is not available')]);
        }
        $paymentService = new PaymentService($payment->payment, $payment->id);
        $notifyUrl = url("/api/us/client/v1/custom/payment/notify/{$payment->payment}/{$payment->uuid}");
        $parseUrl = parse_url($notifyUrl);
        $notifyUrl = $origin . $parseUrl['path'];
        $returnUrl = $origin . '/amount_detail#/' . $tradeNo . '/' . $balance;
        $result = $paymentService->pay([
            'notify_url' => $notifyUrl,
            'return_url' => $returnUrl,
            'trade_no' => $tradeNo,
            'total_amount' => $balance * 100,
            'user_id' => $id,
            'stripe_token' => $request->input('token')
        ]);
        return $this->success([
            'type' => $result['type'],
            'data' => $result['data']
        ]);
    }

    private function makeRedisConnection()
    {
        return RedisGuard::connection();
    }

    private function stateSet(string $key, mixed $value, ?int $seconds = null): void
    {
        if ($this->redis) {
            if ($seconds !== null) {
                $this->redis->setex($key, $seconds, $value);
                return;
            }

            $this->redis->set($key, $value);
            return;
        }

        $cacheKey = $this->stateKey($key);
        if ($seconds !== null) {
            Cache::put($cacheKey, $value, $seconds);
            return;
        }

        Cache::forever($cacheKey, $value);
    }

    private function stateKey(string $key): string
    {
        return 'xboard_next:' . $key;
    }
}
