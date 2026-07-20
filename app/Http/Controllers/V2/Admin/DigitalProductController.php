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
        $plans = Plan::where('product_type', 'digital')->orderBy('sort')->get();
        $plans->each(function (Plan $plan): void {
            $plan->setAttribute('stock_count', DigitalProductItem::where('plan_id', $plan->id)->where('status', DigitalProductItem::AVAILABLE)->count());
            $plan->setAttribute('sold_count', DigitalProductItem::where('plan_id', $plan->id)->where('status', DigitalProductItem::SOLD)->count());
        });
        return $this->success($plans);
    }

    public function save(Request $request)
    {
        $data = $request->validate([
            'id' => 'nullable|integer|exists:v2_plan,id',
            'name' => 'required|string|max:255',
            'content' => 'nullable|string',
            'prices' => 'required|array',
            'prices.*' => 'nullable|numeric|min:0',
            'show' => 'boolean', 'sell' => 'boolean', 'sort' => 'integer|min:0',
            'product_config' => 'nullable|array',
            'product_config.delivery_type' => 'nullable|string|in:text,code,link,account',
        ]);
        $data['product_type'] = 'digital';
        $data['transfer_enable'] = 0;
        $data['reset_traffic_method'] = Plan::RESET_TRAFFIC_NEVER;
        $data['group_id'] = null;
        $data['capacity_limit'] = null;
        $data['product_config'] = array_merge(['delivery_type' => 'text'], $data['product_config'] ?? []);
        $plan = !empty($data['id']) ? Plan::findOrFail($data['id']) : new Plan();
        unset($data['id']);
        $plan->fill($data);
        $plan->save();
        return $this->success($plan->fresh());
    }

    public function stock(Request $request)
    {
        $request->validate(['plan_id' => 'required|integer|exists:v2_plan,id']);
        return $this->success(DigitalProductItem::where('plan_id', $request->integer('plan_id'))->latest('id')->get());
    }

    public function importStock(Request $request)
    {
        $data = $request->validate([
            'plan_id' => 'required|integer|exists:v2_plan,id',
            'content' => 'required|string|max:5000000',
        ]);
        $plan = Plan::where('id', $data['plan_id'])->where('product_type', 'digital')->firstOrFail();
        $lines = collect(preg_split('/\r\n|\r|\n/', $data['content']))->map(fn($line) => trim($line))->filter()->values();
        if ($lines->isEmpty()) return $this->fail([422, '没有可导入的库存内容']);
        $now = time();
        DB::transaction(function () use ($lines, $plan, $now): void {
            $lines->chunk(500)->each(function ($chunk) use ($plan, $now): void {
                $rows = $chunk->map(fn($content) => ['plan_id' => $plan->id, 'content' => $content, 'status' => DigitalProductItem::AVAILABLE, 'created_at' => $now, 'updated_at' => $now])->all();
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
