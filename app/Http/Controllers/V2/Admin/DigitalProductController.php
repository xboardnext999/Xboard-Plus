<?php

namespace App\Http\Controllers\V2\Admin;

use App\Http\Controllers\Controller;
use App\Models\DigitalProductItem;
use App\Models\DigitalProductCategory;
use App\Models\DigitalProductFaq;
use App\Models\Plan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class DigitalProductController extends Controller
{
    private function defaultBanner(): array
    {
        return ['image_url' => '', 'title' => '数字商品中心', 'subtitle' => '精选数字资产，安全购买，支付完成后快速交付。', 'button_text' => '了解更多', 'link_url' => '#digital-products'];
    }

    public function banner()
    {
        return $this->success(array_merge($this->defaultBanner(), (array) admin_setting('digital_store_banner', [])));
    }

    public function saveBanner(Request $request)
    {
        $data = $request->validate([
            'image_url' => 'nullable|string|max:2048', 'title' => 'required|string|max:100',
            'subtitle' => 'nullable|string|max:255', 'button_text' => 'nullable|string|max:30',
            'link_url' => 'nullable|string|max:2048',
        ]);
        $banner = array_merge($this->defaultBanner(), $data);
        admin_setting(['digital_store_banner' => $banner]);
        return $this->success($banner);
    }

    public function uploadBanner(Request $request)
    {
        return $this->storeImage($request, 'digital-banners', 'banner');
    }

    public function categories()
    {
        return $this->success(DigitalProductCategory::withCount('plans')->orderBy('sort')->orderBy('id')->get());
    }

    public function saveCategory(Request $request)
    {
        $data = $request->validate([
            'id' => 'nullable|integer|exists:v2_digital_product_category,id',
            'name' => 'required|string|max:50',
            'enabled' => 'required|boolean',
        ]);
        $data['name'] = trim($data['name']);
        if (DigitalProductCategory::where('name', $data['name'])->when($data['id'] ?? null, fn($query, $id) => $query->where('id', '<>', $id))->exists()) {
            return $this->fail([422, '分类名称已存在']);
        }
        $category = !empty($data['id']) ? DigitalProductCategory::findOrFail($data['id']) : new DigitalProductCategory(['sort' => DigitalProductCategory::max('sort') + 1]);
        $category->fill(['name' => $data['name'], 'enabled' => $data['enabled']])->save();
        return $this->success($category->fresh()->loadCount('plans'));
    }

    public function sortCategories(Request $request)
    {
        $data = $request->validate(['ids' => 'required|array|max:100', 'ids.*' => 'required|integer']);
        if (DigitalProductCategory::count() !== count(array_unique($data['ids'])) || DigitalProductCategory::whereIn('id', $data['ids'])->count() !== count(array_unique($data['ids']))) return $this->fail([422, '分类排序数据无效']);
        DB::transaction(fn() => collect($data['ids'])->each(fn($id, $index) => DigitalProductCategory::where('id', $id)->update(['sort' => $index + 1])));
        return $this->categories();
    }

    public function deleteCategory(Request $request)
    {
        $data = $request->validate(['id' => 'required|integer|exists:v2_digital_product_category,id']);
        $category = DigitalProductCategory::withCount('plans')->findOrFail($data['id']);
        if ($category->plans_count > 0) return $this->fail([422, '该分类下仍有商品，请先调整商品分类']);
        if (DigitalProductCategory::count() <= 1) return $this->fail([422, '至少保留一个商品分类']);
        $category->delete();
        return $this->success(true);
    }

    public function faqs()
    {
        return $this->success(DigitalProductFaq::orderBy('sort')->orderBy('id')->get());
    }

    public function saveFaq(Request $request)
    {
        $data = $request->validate([
            'id' => 'nullable|integer|exists:v2_digital_product_faq,id',
            'title' => 'required|string|max:150',
            'content' => 'required|string|max:5000',
            'enabled' => 'required|boolean',
            'sort' => 'required|integer|min:0|max:9999',
        ]);
        $faq = !empty($data['id']) ? DigitalProductFaq::findOrFail($data['id']) : new DigitalProductFaq();
        unset($data['id']);
        $faq->fill($data)->save();
        return $this->success($faq->fresh());
    }

    public function deleteFaq(Request $request)
    {
        $data = $request->validate(['id' => 'required|integer|exists:v2_digital_product_faq,id']);
        DigitalProductFaq::where('id', $data['id'])->delete();
        return $this->success(true);
    }

    public function sort(Request $request)
    {
        $data = $request->validate(['ids' => 'required|array|max:1000', 'ids.*' => 'required|integer']);
        $ids = Plan::where('product_type', 'digital')->whereIn('id', $data['ids'])->pluck('id')->all();
        if (count($ids) !== count(array_unique($data['ids']))) return $this->fail([422, '商品排序数据无效']);
        DB::transaction(function () use ($data): void {
            foreach ($data['ids'] as $sort => $id) Plan::where('id', $id)->where('product_type', 'digital')->update(['sort' => $sort + 1]);
        });
        return $this->success(true);
    }

    public function status(Request $request)
    {
        $data = $request->validate(['id' => 'required|integer', 'enabled' => 'required|boolean']);
        $plan = Plan::where('id', $data['id'])->where('product_type', 'digital')->firstOrFail();
        $plan->show = $data['enabled'];
        $plan->sell = $data['enabled'];
        $plan->save();
        return $this->success(['id' => $plan->id, 'show' => $plan->show, 'sell' => $plan->sell]);
    }

    public function fetch(Request $request)
    {
        $plans = Plan::where('product_type', 'digital')
            ->with('digitalCategory')
            ->withCount([
                'digitalItems as stock_count' => fn($query) => $query->where('status', DigitalProductItem::AVAILABLE),
                'digitalItems as sold_count' => fn($query) => $query->where('status', DigitalProductItem::SOLD),
            ])->orderBy('sort')->get();
        $stockByPackage = DigitalProductItem::whereIn('plan_id', $plans->pluck('id'))
            ->where('status', DigitalProductItem::AVAILABLE)
            ->selectRaw("plan_id, COALESCE(package_id, '') package_key, COUNT(*) aggregate")
            ->groupBy('plan_id', 'package_id')->get()->groupBy('plan_id');
        $plans->each(function (Plan $plan) use ($stockByPackage): void {
            $rows = $stockByPackage->get($plan->id, collect());
            $common = (int) ($rows->firstWhere('package_key', '')?->aggregate ?? 0);
            $config = $plan->product_config ?: [];
            $config['category'] = $plan->digitalCategory?->name ?? ($config['category'] ?? '数字商品');
            $config['packages'] = collect($config['packages'] ?? [])->map(function ($package) use ($rows, $common) {
                $package['stock_count'] = (int) ($rows->firstWhere('package_key', (string) ($package['id'] ?? ''))?->aggregate ?? 0) + $common;
                return $package;
            })->values()->all();
            $plan->product_config = $config;
        });
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
            'product_config.category' => 'nullable|string|max:50',
            'digital_category_id' => 'required|integer|exists:v2_digital_product_category,id',
            'product_config.image_url' => 'nullable|string|max:2048',
            'product_config.detail_markdown' => 'nullable|string|max:500000',
            'product_config.gallery' => 'nullable|array|max:20',
            'product_config.gallery.*' => 'required|string|max:2048',
            'product_config.featured' => 'nullable|boolean',
            'product_config.packages' => 'nullable|array|max:50',
            'product_config.packages.*.id' => 'required|string|max:64',
            'product_config.packages.*.name' => 'required|string|max:100',
            'product_config.packages.*.price' => 'required|numeric|min:0',
            'product_config.packages.*.original_price' => 'nullable|numeric|min:0',
            'product_config.packages.*.description' => 'nullable|string|max:200',
        ]);
        $data['product_type'] = 'digital';
        $data['transfer_enable'] = 0;
        $data['reset_traffic_method'] = Plan::RESET_TRAFFIC_NEVER;
        $data['group_id'] = null;
        $data['capacity_limit'] = null;
        $category = DigitalProductCategory::where('id', $data['digital_category_id'])->where('enabled', true)->first();
        if (!$category) return $this->fail([422, '请选择有效的商品分类']);
        $config = array_merge(['delivery_type' => 'code', 'category' => '数字商品', 'image_url' => '', 'detail_markdown' => '', 'gallery' => [], 'featured' => false, 'packages' => []], $data['product_config'] ?? []);
        $config['category'] = $category->name;
        $config['gallery'] = collect($config['gallery'] ?? [])->map(fn($url) => trim((string) $url))->filter()->unique()->take(20)->values()->all();
        $config['packages'] = collect($config['packages'])->map(fn($package) => [
            'id' => preg_replace('/[^A-Za-z0-9_-]/', '-', (string) $package['id']),
            'name' => trim($package['name']),
            'price' => (float) $package['price'],
            'original_price' => (float) ($package['original_price'] ?? 0),
            'description' => trim((string) ($package['description'] ?? '')),
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

    public function uploadCover(Request $request)
    {
        return $this->storeImage($request, 'digital-products', 'product');
    }

    private function storeImage(Request $request, string $directory, string $prefix)
    {
        $request->validate(['file' => 'required|image|mimes:jpg,jpeg,png,webp,gif|max:5120']);
        $file = $request->file('file');
        if (!$file || !$file->isValid()) return $this->fail([400, '图片上传失败']);
        $extension = strtolower($file->getClientOriginalExtension() ?: $file->extension() ?: 'webp');
        $filename = $prefix . '_' . time() . '_' . Str::random(10) . '.' . $extension;
        $path = Storage::disk('public')->putFileAs($directory, $file, $filename);
        if (!$path) return $this->fail([400, '图片上传失败']);
        return $this->success(['url' => '/storage/' . $directory . '/' . $filename]);
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
