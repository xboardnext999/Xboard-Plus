<?php

namespace Plugin\XboardNext\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use App\Models\Order;
use App\Models\Plan;
use App\Models\User;
use App\Models\ServerGroup;
use App\Services\ServerService;
use App\Utils\Dict;
use App\Utils\Helper;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CustomController extends Controller
{
    public function groups(Request $request)
    {
        return $this->success(ServerGroup::get());
    }

    public function nodes(Request $request)
    {
        return $this->success(ServerService::getAllServers());
    }

    public function nodesUpdate(Request $request)
    {
        $table = 'v2_server';
        $host = $request->input('host');
        $port = $request->input('port');
        $id = $request->input('id');
        $sql = "UPDATE {$table} SET host = ?, port = ? WHERE id = ?";
        try {
            DB::beginTransaction();
            DB::statement($sql, [$host, $port, $id]);
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('节点更新失败: ' . $e->getMessage());
            return $this->fail(500, $e->getMessage() . ' sql: ' . $sql);
        }
        return $this->success(true);
    }

    public function users(Request $request)
    {
        $current = $request->input('current') ? $request->input('current') : 1;
        $pageSize = $request->input('pageSize') >= 1 ? $request->input('pageSize') : 10;
        $sortType = in_array($request->input('sort_type'), ['ASC', 'DESC']) ? $request->input('sort_type') : 'DESC';
        $sort = $request->input('sort') ? $request->input('sort') : 'created_at';
        $userModel = User::orderBy($sort, $sortType);
        if ($email = $request->input('email')) {
            $userModel->where('email', 'like', '%' . $email . '%');
        }
        $total = $userModel->count();
        $res = $userModel->forPage($current, $pageSize)->get();
        $plan = Plan::get();
        for ($i = 0; $i < count($res); $i++) {
            for ($k = 0; $k < count($plan); $k++) {
                if ($plan[$k]['id'] == $res[$i]['plan_id']) {
                    $res[$i]['plan_name'] = $plan[$k]['name'];
                }
            }
            $res[$i]['subscribe_url'] = Helper::getSubscribeUrl( $res[$i]['token']);
        }
        return response([
            'data' => $res,
            'total' => $total
        ]);
    }

    public function coupons(Request $request)
    {
        $current = $request->input('current') ? $request->input('current') : 1;
        $pageSize = $request->input('pageSize') >= 10 ? $request->input('pageSize') : 10;
        $sortType = in_array($request->input('sort_type'), ['ASC', 'DESC']) ? $request->input('sort_type') : 'DESC';
        $sort = $request->input('sort') ? $request->input('sort') : 'id';
        $builder = Coupon::orderBy($sort, $sortType);
        $total = $builder->count();
        $coupons = $builder->forPage($current, $pageSize)->get();
        return response([
            'data' => $coupons,
            'total' => $total
        ]);
    }

    public function config(Request $request)
    {
        $key = $request->input('key');
        $data = [
            'invite' => [
                'commission_withdraw_limit' => admin_setting('commission_withdraw_limit', 100),
                'commission_withdraw_method' => admin_setting('commission_withdraw_method', Dict::WITHDRAW_METHOD_WHITELIST_DEFAULT)
            ],
            'site' => [],
            'subscribe' => [],
            'frontend' => [],
            'server' => [],
            'email' => [],
            'telegram' => [],
            'app' => [],
            'safe' => []
        ];
        if ($key && isset($data[$key])) {
            return $this->success([
                $key => $data[$key]
            ]);
        };
        return $this->success($data);
    }

    public function getCustomStats(Request $request)
    {
        $todayOrders = Order::where('created_at', '>=', strtotime('today'))
            ->whereNotIn('status', [0, 2])
            ->count();

        $errorNodes = 0;
        $servers = ServerService::getAllServers();
        foreach ($servers as $item) {
            if ($item['show'] && $item['available_status'] == 0) {
                $errorNodes++;
            }
        }

        $data = [
            'todayOrders' => $todayOrders,
            'errorNodes' => $errorNodes
        ];
        return $this->success($data);
    }
}
