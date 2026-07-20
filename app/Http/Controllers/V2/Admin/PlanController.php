<?php

namespace App\Http\Controllers\V2\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\PlanSave;
use App\Models\Order;
use App\Models\Plan;
use App\Models\User;
use App\Services\SubscriptionTransferService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PlanController extends Controller
{
    public function fetch(Request $request)
    {
        $plans = Plan::when($request->filled('product_type'), fn ($query) => $query->where('product_type', $request->input('product_type')))
            ->orderBy('sort', 'ASC')
            ->with([
                'group:id,name'
            ])
            ->withCount([
                'users',
                'users as active_users_count' => function ($query) {
                    $query->where(function ($q) {
                        $q->where('expired_at', '>', time())
                          ->orWhereNull('expired_at');
                    });
                }
            ])
            ->get();

        if ($request->input('product_type') === 'forwarding') {
            $plans->each(function (Plan $plan): void {
                $tunnelId = (int) data_get($plan->product_config, 'tunnel_id');
                $active = $tunnelId > 0
                    ? DB::table('flux_user_tunnels')
                        ->where('tunnel_id', $tunnelId)
                        ->where('enabled', true)
                        ->where(function ($query) {
                            $query->whereNull('expires_at')->orWhere('expires_at', '>', time());
                        })
                        ->count()
                    : 0;
                $plan->setAttribute('active_users_count', $active);
                $plan->setAttribute('users_count', $active);
            });
        }

        return $this->success($plans);
    }

    public function save(PlanSave $request)
    {
        $params = $request->validated();
        $params['product_type'] = $params['product_type'] ?? 'subscription';
        if ($params['product_type'] === 'forwarding') {
            $config = $params['product_config'] ?? [];
            if (empty($config['tunnel_id'])) return $this->fail([422, '转发套餐必须绑定隧道']);
            $params['group_id'] = null;
            $params['reset_traffic_method'] = Plan::RESET_TRAFFIC_NEVER;
            // 传统套餐的容量字段不适用于转发授权；0 在旧逻辑中代表“售罄”，这里统一为不限。
            if (empty($params['capacity_limit'])) $params['capacity_limit'] = null;
        } elseif ($params['product_type'] === 'digital') {
            $params['group_id'] = null;
            $params['reset_traffic_method'] = Plan::RESET_TRAFFIC_NEVER;
            $params['capacity_limit'] = null;
            if (empty($params['product_config']['delivery_type'])) {
                $params['product_config']['delivery_type'] = 'text';
            }
        } else {
            $params['product_config'] = null;
        }
        
        if ($request->input('id')) {
            $plan = Plan::find($request->input('id'));
            if (!$plan) {
                return $this->fail([400202, '该订阅不存在']);
            }
            
            DB::beginTransaction();
            try {
                if ($request->input('force_update')) {
                    User::where('plan_id', $plan->id)->update([
                        'group_id' => $params['group_id'],
                        'transfer_enable' => $params['transfer_enable'] * 1073741824,
                        'speed_limit' => $params['speed_limit'],
                        'device_limit' => $params['device_limit'],
                    ]);
                }
                $plan->update($params);
                DB::commit();
                return $this->success(true);
            } catch (\Exception $e) {
                DB::rollBack();
                Log::error($e);
                return $this->fail([500, '保存失败']);
            }
        }
        if (!Plan::create($params)) {
            return $this->fail([500, '创建失败']);
        }
        return $this->success(true);
    }

    public function transferPrice(Request $request)
    {
        $params = $request->validate([
            'id' => 'required|integer|exists:v2_plan,id',
            'transfer_price' => 'nullable|integer|min:0|max:100000000',
        ]);

        $plan = Plan::findOrFail($params['id']);
        $plan->transfer_price = $request->input('transfer_price') === null
            ? null
            : (int) $params['transfer_price'];
        $plan->save();

        return $this->success([
            'id' => (int) $plan->id,
            'transfer_price' => $plan->transfer_price,
            'effective_transfer_price' => app(SubscriptionTransferService::class)->fee($plan),
        ]);
    }

    public function drop(Request $request)
    {
        if (Order::where('plan_id', $request->input('id'))->first()) {
            return $this->fail([400201, '该订阅下存在订单无法删除']);
        }
        if (User::where('plan_id', $request->input('id'))->first()) {
            return $this->fail([400201, '该订阅下存在用户无法删除']);
        }
        
        $plan = Plan::find($request->input('id'));
        if (!$plan) {
            return $this->fail([400202, '该订阅不存在']);
        }
        
        return $this->success($plan->delete());
    }

    public function update(Request $request)
    {
        $updateData = $request->only([
            'show',
            'renew',
            'sell'
        ]);

        $plan = Plan::find($request->input('id'));
        if (!$plan) {
            return $this->fail([400202, '该订阅不存在']);
        }

        try {
            $plan->update($updateData);
        } catch (\Exception $e) {
            Log::error($e);
            return $this->fail([500, '保存失败']);
        }

        return $this->success(true);
    }

    public function sort(Request $request)
    {
        $params = $request->validate([
            'ids' => 'required|array'
        ]);

        try {
            DB::beginTransaction();
            foreach ($params['ids'] as $k => $v) {
                if (!Plan::find($v)->update(['sort' => $k + 1])) {
                    throw new \Exception();
                }
            }
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error($e);
            return $this->fail([500, '保存失败']);
        }
        return $this->success(true);
    }
}
