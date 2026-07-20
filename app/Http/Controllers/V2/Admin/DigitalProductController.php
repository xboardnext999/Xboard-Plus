<?php

namespace App\Http\Controllers\V2\Admin;

use App\Http\Controllers\Controller;
use App\Models\DigitalProductItem;
use App\Models\Plan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DigitalProductController extends Controller
{
    public function fetch(Request $request)
    {
        $plans = Plan::where('product_type', 'digital')
            ->withCount([
                'digitalItems as stock_count' => fn($query) => $query->where('status', DigitalProductItem::AVAILABLE),
                'digitalItems as sold_count' => fn($query) => $query->where('status', DigitalProductItem::SOLD),
            ])->orderBy('sort')->get();
        return $this->success($plans);
    }

    public function save(Request $request)
    {
        $data = $request->validate([
            'id' => 'nullable|integer|exists:v2_plan,id',
            'name' => 'required|string|max:255',
            'content' => 'nullable|string',
            'prices' => 'nullable|array',
            'prices.*' => 'nullable|numeric|min:0',
            'show' => 'boolean', 'sell' => 'boolean', 'sort' => 'integer|min:0',
            'product_config' => 'nullable|array',
            'product_config.delivery_type' => 'nullable|string|in:text,code,link,account',
            'product_config.packages' => 'nullable|array|max:50',
            'product_config.packages.*.id' => 'required|string|max:64',
            'product_config.packages.*.name' => 'required|string|max:100',
            'product_config.packages.*.price' => 'required|numeric|min:0',
        ]);
        $data['product_type'] = 'digital';
        $data['transfer_enable'] = 0;
        $data['reset_traffic_method'] = Plan::RESET_TRAFFIC_NEVER;
        $data['group_id'] = null;
        $data['capacity_limit'] = null;
        $config = array_merge(['delivery_type' => 'text', 'packages' => []], $data['product_config'] ?? []);
        $config['packages'] = collect($config['packages'])->map(fn($package) => [
            'id' => preg_replace('/[^A-Za-z0-9_-]/', '-', (string) $package['id']),
            'name' => trim($package['name']),
            'price' => (float) $package['price'],
        ])->filter(fn($package) => $package['price'] > 0)->values()->all();
        if (empty($config['packages']) && !collect($data['prices'] ?? [])->contains(fn($price) => (float) $price > 0)) {
            return $this->fail([422, '请至少设置一个有效销售套餐或价格']);
        }
        $data['product_config'] = $config;
        $plan = !empty($data['id']) ? Plan::findOrFail($data['id']) : new Plan();
        unset($data['id']);
        $plan->fill($data);
        $plan->save();
        return $this->success($plan->fresh());
    }

    public function stock(Request $request)
    {
        $request->validate(['plan_id' => 'required|integer|exists:v2_plan,id']);
        $query = DigitalProductItem::where('plan_id', $request->integer('plan_id'))->latest('id');
        if ($request->filled('status')) $query->where('status', $request->input('status'));
        if ($request->filled('keyword')) $query->where('content', 'like', '%' . trim((string) $request->input('keyword')) . '%');
        return $this->paginate($query->paginate(
            perPage: min(100, max(10, $request->integer('pageSize', 20))),
            page: max(1, $request->integer('current', 1))
        ));
    }

    public function deliveries(Request $request)
    {
        $query = DigitalProductItem::with([
            'plan:id,name,product_config',
            'user:id,email',
            'order:id,trade_no,total_amount',
        ])->where('status', DigitalProductItem::SOLD)->latest('sold_at');
        if ($request->filled('plan_id')) $query->where('plan_id', $request->integer('plan_id'));
        if ($request->filled('keyword')) {
            $keyword = trim((string) $request->input('keyword'));
            $query->where(function ($query) use ($keyword) {
                $query->where('content', 'like', "%{$keyword}%")
                    ->orWhereHas('user', fn($user) => $user->where('email', 'like', "%{$keyword}%"))
                    ->orWhereHas('order', fn($order) => $order->where('trade_no', 'like', "%{$keyword}%"));
            });
        }
        return $this->paginate($query->paginate(
            perPage: min(100, max(10, $request->integer('pageSize', 20))),
            page: max(1, $request->integer('current', 1))
        ));
    }

    public function importStock(Request $request)
    {
        $data = $request->validate([
            'plan_id' => 'required|integer|exists:v2_plan,id',
            'package_id' => 'nullable|string|max:64',
            'content' => 'required|string|max:5000000',
        ]);
        $plan = Plan::where('id', $data['plan_id'])->where('product_type', 'digital')->firstOrFail();
        $lines = collect(preg_split('/\r\n|\r|\n/', $data['content']))->map(fn($line) => trim($line))->filter()->values();
        $packageId = $data['package_id'] ?? null;
        if ($packageId && !collect((array) data_get($plan->product_config, 'packages', []))->firstWhere('id', $packageId)) return $this->fail([422, '套餐不存在']);
        if ($lines->isEmpty()) return $this->fail([422, '没有可导入的库存内容']);
        $now = time();
        DB::transaction(function () use ($lines, $plan, $now, $packageId): void {
            $lines->chunk(500)->each(function ($chunk) use ($plan, $now, $packageId): void {
                $rows = $chunk->map(fn($content) => ['plan_id' => $plan->id, 'package_id' => $packageId, 'content' => $content, 'status' => DigitalProductItem::AVAILABLE, 'created_at' => $now, 'updated_at' => $now])->all();
                DigitalProductItem::insert($rows);
            });
        });
        return $this->success(['imported' => $lines->count()]);
    }

    public function deleteStock(Request $request)
    {
        $item = DigitalProductItem::where('id', $request->integer('id'))->where('status', DigitalProductItem::AVAILABLE)->first();
        if (!$item) return $this->fail([404, '库存不存在或已售出']);
        $item->delete();
        return $this->success(true);
    }
}
