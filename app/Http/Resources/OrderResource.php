<?php

namespace App\Http\Resources;

use App\Models\Order;
use App\Services\PlanService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Order
 */
class OrderResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            ...parent::toArray($request),
            'period' => PlanService::getLegacyPeriod((string)$this->period),
            'discount_amount' => (int) $this->discount_amount,
            'group_buy_activity_id' => $this->group_buy_activity_id ? (int) $this->group_buy_activity_id : null,
            'group_buy_group_id' => $this->group_buy_group_id ? (int) $this->group_buy_group_id : null,
            'group_buy_discount_amount' => (int) $this->group_buy_discount_amount,
            'balance_amount' => (int) $this->balance_amount,
            'surplus_amount' => (int) $this->surplus_amount,
            'handling_amount' => (int) $this->handling_amount,
            'plan' => $this->whenLoaded('plan', fn() => PlanResource::make($this->plan)),
            'payment' => $this->whenLoaded('payment', fn() => $this->payment ? [
                'id' => $this->payment->id,
                'name' => $this->payment->name,
                'payment' => $this->payment->payment,
                'icon' => $this->payment->icon,
            ] : null),
            'digital_delivery' => $this->when(
                $this->relationLoaded('digitalItems'),
                fn() => $this->digitalItems->map(fn($item) => [
                    'id' => $item->id,
                    'content' => $item->content,
                    'delivered_at' => $item->sold_at,
                ])->values()
            ),
        ];
    }
}
