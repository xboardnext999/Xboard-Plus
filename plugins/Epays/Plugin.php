<?php

namespace Plugin\Epays;

use App\Services\Plugin\AbstractPlugin;
use App\Contracts\PaymentInterface;

class Plugin extends AbstractPlugin implements PaymentInterface
{
    public function boot(): void
    {
        $this->filter('available_payment_methods', function ($methods) {
            if ($this->getConfig('enabled', true)) {
                $methods['EPays'] = [
                    'name' => $this->getConfig('display_name', '易支付'),
                    'icon' => $this->getConfig('icon', '💳'),
                    'plugin_code' => $this->getPluginCode(),
                    'type' => 'plugin'
                ];
            }
            return $methods;
        });
    }

    public function form(): array
    {
        return [
            'url' => [
                'label' => '支付网关地址',
                'type' => 'string',
                'required' => true,
                'description' => '请填写完整的支付网关地址，包括协议（http或https）'
            ],
            'pid' => [
                'label' => '商户ID',
                'type' => 'string',
                'description' => '请填写商户ID',
                'required' => true
            ],
            'key' => [
                'label' => '通信密钥',
                'type' => 'string',
                'required' => true,
                'description' => '请填写通信密钥'
            ],
            'interface' => [
                'label' => 'mapi支付接口',
                'type' => 'string',
                'description' => 'submit/mapi (可为空，默认submit收银台)'
            ],
            'type' => [
                'label' => '支付类型',
                'type' => 'string',
                'description' => 'alipay/wxpay/qqpay选一种，(submit 为空，mapi 必填)'
            ],
        ];
    }

    public function pay($order): array
    {
        $params = [
            'money' => $order['total_amount'] / 100,
            'name' => $order['trade_no'],
            'notify_url' => $order['notify_url'],
            'return_url' => $order['return_url'],
            'out_trade_no' => $order['trade_no'],
            'pid' => $this->getConfig('pid')
        ];

        if ($paymentType = $this->getConfig('type')) {
            $params['type'] = $paymentType;
        }

        //增加对mapi 接口适配, 使用mapi支付接口，在v2b管理后台，微信和支付宝需要单独配置
        $interface = $this->getConfig('interface', '');
        if ($interface == 'mapi') {
            //前端需要传入必填参数：device 访问设备，clientip 访问IP
            //$params['type'] = $this->getConfig('type');
            $params['device'] = $order['device'] ?? 'pc';
            $params['clientip'] = $order['clientip'] ?? '0.0.0.0';
        }

        ksort($params);
        $str = stripslashes(urldecode(http_build_query($params))) . $this->getConfig('key');
        $params['sign'] = md5($str);
        $params['sign_type'] = 'MD5';

        if ($interface == 'mapi') {
            //mapi 请求支付的时候需要使用POST方式请求
            /*$data = [
                'url' => $this->getConfig('url') . '/mapi.php',
                'params' => $params
            ];
            return [
                'type' => 0, // 0: qrcode
                'data' => $data
            ];*/
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $this->getConfig('url') . '/mapi.php');
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params));
            curl_setopt($ch, CURLOPT_HTTPHEADER, array(
                'Content-Type: application/x-www-form-urlencoded'
            ));

            $response = curl_exec($ch);
            $data = [];
            if(curl_errno($ch)) {
                echo 'Error:' . curl_error($ch);
                $errorMsg = curl_error($ch);
                curl_close($ch);
                throw new Exception("获取二维码失败: " . $errorMsg);
            } else {
                $data = json_decode($response, true);
                curl_close($ch);
                if ($data['code'] != 1) {
                    throw new Exception("获取二维码失败: " . $data['msg']);
                }
            }
            return [
                'type' => 0, // 0: qrcode
                'data' => $data['qrcode']
            ];
        } else {
            return [
                'type' => 1,
                'data' => $this->getConfig('url') . '/submit.php?' . http_build_query($params)
            ];
        }
    }

    public function notify($params): array
    {
        $sign = $params['sign'];
        unset($params['sign'], $params['sign_type']);
        ksort($params);
        $str = stripslashes(urldecode(http_build_query($params))) . $this->getConfig('key');

        if ($sign !== md5($str)) {
            return false;
        }

        return [
            'trade_no' => $params['out_trade_no'],
            'callback_no' => $params['trade_no']
        ];
    }
}
