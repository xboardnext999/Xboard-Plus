<?php

namespace App\Http\Controllers\V1\Guest;

use App\Http\Controllers\Controller;
use App\Http\Resources\PlanResource;
use App\Models\Plan;
use App\Models\DigitalProductCategory;
use App\Models\DigitalProductFaq;
use App\Services\PlanService;
use Auth;
use Illuminate\Http\Request;

class PlanController extends Controller
{

    protected $planService;
    public function __construct(PlanService $planService)
    {
        $this->planService = $planService;
    }
    public function fetch(Request $request)
    {
        $plan = $this->planService->getAvailablePlans($request->input('product_type', 'subscription'));
        return $this->success(PlanResource::collection($plan));
    }

    public function digitalBanner()
    {
        return $this->success(admin_setting('digital_store_banner', [
            'image_url' => '', 'title' => '数字商品中心',
            'subtitle' => '精选数字资产，安全购买，支付完成后快速交付。',
            'button_text' => '了解更多', 'link_url' => '#digital-products',
        ]));
    }

    public function digitalCategories()
    {
        $categories = DigitalProductCategory::where('enabled', true)
            ->withCount(['plans as product_count' => fn($query) => $query
                ->where('product_type', 'digital')->where('show', true)->where('sell', true)])
            ->orderBy('sort')->orderBy('id')->get(['id', 'name']);
        return $this->success($categories);
    }

    public function digitalFaqs()
    {
        return $this->success(DigitalProductFaq::where('enabled', true)
            ->orderBy('sort')->orderBy('id')->get(['id', 'title', 'content']));
    }
}
