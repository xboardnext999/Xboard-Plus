<?php

namespace Plugin\XboardNext\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Support\RedisGuard;
use Plugin\XboardNext\Services\PaymentService;
use App\Services\TelegramService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class PaymentController extends Controller
{
    protected $telegramService;
    protected $redis;

    public function __construct(TelegramService $telegramService)
    {
        $this->telegramService = $telegramService;
        $this->redis = $this->makeRedisConnection();
    }

    public function notify($method, $uuid, Request $request)
    {
        Log::error('支付回调接口请求参数：' . json_encode($request->input()));
        $tradeNo = $this->getOrderNo($request);
        try {
            $paymentService = new PaymentService($method, null, $uuid);
            $verify = $paymentService->notify($request->input());
            if (!$verify) {
                $this->sendNext($tradeNo, 'PAY_CANCEL', '签名验证失败');
                return $this->fail([422, 'verify error']);
            }
            $key = $tradeNo . '_sendNext';
            $str = $this->stateGet($key);
            if ($str == "Y") {
                return (isset($verify['custom_result']) ? $verify['custom_result'] : 'success');
            }
            $this->stateSet($key, "Y", 60);
            $this->sendNext($verify['trade_no'], 'PAY_DOING', '付款成功，待充值');
            $this->sendMsg($verify['trade_no'], $verify['callback_no'], $uuid);
            return (isset($verify['custom_result']) ? $verify['custom_result'] : 'success');
        } catch (\Exception $e) {
            $this->sendNext($tradeNo, 'PAY_CANCEL', '签名数据解析异常');
            Log::error($e);
            return $this->fail([500, 'fail']);
        }
    }

    private function sendMsg($tradeNo, $callbackNo, $uuid)
    {
        try {
            $paymentModel = Payment::where('uuid', $uuid)->first();
            if (!$paymentModel) {
                return '支付接口不存在';
            }

            $payment = $paymentModel->toArray();
            if (!$payment) {
                return '支付接口不存在';
            }
            $balance = $this->stateGet($tradeNo);
            $message = sprintf(
                "💰用户充值成功: 收款%s元\n" .
                "———————————————\n" .
                "支付接口：%s\n" .
                "支付渠道：%s\n" .
                "支付订单：%s\n" .
                "本站订单：`%s`",
                $balance,
                $payment['payment'],
                $payment['name'],
                $callbackNo,
                $tradeNo
            );
            $this->telegramService->sendMessageWithAdmin($message, true);
        } catch (\Exception $e) {
            Log::error($e);
            return $e;
        }
        return true;
    }

    private function sendNext($tradeNo, $status, $msg)
    {
        try {
            $params = [
                'tradeNo' => $tradeNo,
                'status' => $status,
                'msg' => $msg
            ];
            $origin = $this->stateGet('xboard_next_origin');
            if (!$origin) {
                Log::error('支付回调接口调用NEXT状态更新接口异常，接口域名为空：' . json_encode($params));
                return false;
            }
            $ch = curl_init();
            if ($ch === false) {
                Log::error('支付回调接口调用NEXT状态更新接口异常：curl 初始化失败');
                return false;
            }
            curl_setopt($ch, CURLOPT_URL, $origin . '/api/openapi/usconf/client/user/amount/pay' . '?' . http_build_query($params));
            curl_setopt($ch, CURLOPT_HTTPGET, true);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            $response = curl_exec($ch);
            if (curl_errno($ch)) {
                $errorMsg = curl_error($ch);
                curl_close($ch);
                Log::error('支付回调接口调用NEXT状态更新接口异常：' . $errorMsg);
                return $errorMsg;
            } else {
                curl_close($ch);
                //$data = json_decode($response, true);
                Log::error('支付回调接口调用NEXT状态更新接口成功：' . $response);
                return $response;
            }
        } catch (\Exception $e) {
            Log::error($e);
            return $e;
        }
    }

    private function getOrderNo($request)
    {
        try {
            $orderNo = $request->input('out_trade_no');
            if ($orderNo !== null) {
                return $orderNo;
            }

            // 先尝试从GET参数获取
            $orderNo = $request->query->get('out_trade_no');
            if ($orderNo !== null) {
                return $orderNo;
            }

            // 如果GET没有，则从POST获取
            $orderNo = $request->request->get('out_trade_no');
            if ($orderNo !== null) {
                return $orderNo;
            }
        } catch (\Exception $e) {
            Log::error($e);
        }
        return "ERROR:out_trade_no";
    }

    private function makeRedisConnection()
    {
        return RedisGuard::connection();
    }

    private function stateGet(string $key): mixed
    {
        if ($this->redis) {
            return $this->redis->get($key);
        }

        return Cache::get($this->stateKey($key));
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
