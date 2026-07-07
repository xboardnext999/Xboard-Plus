<?php

namespace App\Http\Controllers\V2\Admin;

use App\Http\Controllers\Controller;
use App\Models\GroupBuyActivity;
use App\Models\GroupBuyGroup;
use App\Models\Plan;
use App\Services\PlanService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class GroupBuyController extends Controller
{
    public function fetch(Request $request)
    {
        $current = (int) $request->input('current', $request->input('page', 1));
        $pageSize = (int) $request->input('pageSize', $request->input('per_page', 10));
        $pageSize = max(1, min(100, $pageSize));

        $builder = GroupBuyActivity::with(['plan:id,name,prices'])
            ->withCount([
                'groups',
                'groups as open_groups_count' => function ($query) {
                    $query->where('status', GroupBuyGroup::STATUS_OPEN);
                },
                'groups as completed_groups_count' => function ($query) {
                    $query->where('status', GroupBuyGroup::STATUS_COMPLETED);
                },
                'groups as expired_groups_count' => function ($query) {
                    $query->where('status', GroupBuyGroup::STATUS_EXPIRED);
                },
            ]);

        if ($request->filled('keyword')) {
            $keyword = trim((string) $request->input('keyword'));
            $builder->where(function ($query) use ($keyword) {
                $query->where('title', 'like', "%{$keyword}%")
                    ->orWhereHas('plan', function ($planQuery) use ($keyword) {
                        $planQuery->where('name', 'like', "%{$keyword}%");
                    });
            });
        }

        if ($request->filled('plan_id')) {
            $builder->where('plan_id', (int) $request->input('plan_id'));
        }

        if ($request->filled('status') && $request->input('status') !== 'all') {
            $builder->where('status', (int) $request->input('status'));
        }

        $page = $builder->orderByDesc('id')->paginate($pageSize, ['*'], 'page', $current);

        return $this->success([
            'items' => collect($page->items())->map(fn($activity) => $this->activityPayload($activity))->values(),
            'total' => $page->total(),
            'current_page' => $page->currentPage(),
            'per_page' => $page->perPage(),
            'last_page' => $page->lastPage(),
            'plans' => $this->planOptions(),
            'periods' => Plan::getAvailablePeriods(),
        ]);
    }

    public function save(Request $request)
    {
        $params = $request->validate([
            'id' => 'nullable|integer',
            'plan_id' => 'required|integer',
            'period' => 'required|string|max:40',
            'title' => 'nullable|string|max:100',
            'group_size' => 'required|integer|min:2|max:100',
            'discount_type' => 'required|integer|in:1,2',
            'discount_value' => 'required|integer|min:0',
            'started_at' => 'nullable',
            'ended_at' => 'nullable',
            'expire_minutes' => 'required|integer|min:1|max:10080',
            'status' => 'nullable|integer|in:0,1',
        ]);

        $plan = Plan::find((int) $params['plan_id']);
        if (!$plan) {
            return $this->fail([400202, '套餐不存在']);
        }

        $period = PlanService::getPeriodKey((string) $params['period']);
        if (!in_array($period, PlanService::getNewPeriods(), true)) {
            return $this->fail([400, '订阅周期不支持']);
        }

        $price = $plan->prices[$period] ?? null;
        if (!$price || $price <= 0) {
            return $this->fail([400, '该套餐未配置当前周期价格']);
        }

        if ((int) $params['discount_type'] === GroupBuyActivity::DISCOUNT_PERCENT && (int) $params['discount_value'] > 100) {
            return $this->fail([400, '折扣比例不能超过100%']);
        }

        $startedAt = $this->parseTime($params['started_at'] ?? null);
        $endedAt = $this->parseTime($params['ended_at'] ?? null);
        if ($startedAt && $endedAt && $endedAt < $startedAt) {
            return $this->fail([400, '结束时间不能早于开始时间']);
        }

        $payload = [
            'plan_id' => (int) $params['plan_id'],
            'period' => $period,
            'title' => trim((string) ($params['title'] ?? '')) ?: "{$plan->name} 拼团",
            'group_size' => (int) $params['group_size'],
            'discount_type' => (int) $params['discount_type'],
            'discount_value' => (int) $params['discount_value'],
            'started_at' => $startedAt,
            'ended_at' => $endedAt,
            'expire_minutes' => (int) $params['expire_minutes'],
            'status' => (int) ($params['status'] ?? GroupBuyActivity::STATUS_ENABLED),
        ];

        if (!empty($params['id'])) {
            $activity = GroupBuyActivity::find((int) $params['id']);
            if (!$activity) {
                return $this->fail([400202, '拼团活动不存在']);
            }
        } else {
            $activity = null;
        }

        try {
            DB::beginTransaction();
            if ($activity) {
                $activity->update($payload);
            } else {
                $activity = GroupBuyActivity::create($payload);
            }
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error($e);
            return $this->fail([500, '保存失败']);
        }

        return $this->success($this->activityPayload($activity->fresh(['plan:id,name,prices'])));
    }

    public function update(Request $request)
    {
        $params = $request->validate([
            'id' => 'required|integer',
            'status' => 'required|integer|in:0,1',
        ]);

        $activity = GroupBuyActivity::find((int) $params['id']);
        if (!$activity) {
            return $this->fail([400202, '拼团活动不存在']);
        }

        $activity->status = (int) $params['status'];
        if (!$activity->save()) {
            return $this->fail([500, '保存失败']);
        }

        return $this->success(true);
    }

    public function drop(Request $request)
    {
        $params = $request->validate([
            'id' => 'required|integer',
        ]);

        $activity = GroupBuyActivity::find((int) $params['id']);
        if (!$activity) {
            return $this->fail([400202, '拼团活动不存在']);
        }

        if (GroupBuyGroup::where('activity_id', $activity->id)->exists()) {
            return $this->fail([400, '该活动已有拼团队伍，不能删除，可先停用']);
        }

        if (!$activity->delete()) {
            return $this->fail([500, '删除失败']);
        }

        return $this->success(true);
    }

    public function groups(Request $request)
    {
        $current = (int) $request->input('current', $request->input('page', 1));
        $pageSize = (int) $request->input('pageSize', $request->input('per_page', 20));
        $pageSize = max(1, min(100, $pageSize));

        $builder = GroupBuyGroup::with([
            'activity:id,title',
            'leader:id,email',
            'members.user:id,email',
            'members.order:id,trade_no,status,total_amount',
        ])
            ->when($request->filled('activity_id'), fn($query) => $query->where('activity_id', (int) $request->input('activity_id')))
            ->when($request->filled('status') && $request->input('status') !== 'all', fn($query) => $query->where('status', (int) $request->input('status')))
            ->orderByDesc('id');

        $page = $builder->paginate($pageSize, ['*'], 'page', $current);

        return $this->success([
            'items' => collect($page->items())->map(fn($group) => $this->groupPayload($group))->values(),
            'total' => $page->total(),
            'current_page' => $page->currentPage(),
            'per_page' => $page->perPage(),
            'last_page' => $page->lastPage(),
        ]);
    }

    private function activityPayload(GroupBuyActivity $activity): array
    {
        $plan = $activity->plan;
        $periods = Plan::getAvailablePeriods();
        $periodLabel = $periods[$activity->period]['name'] ?? $activity->period;
        $periodPrice = $plan && isset($plan->prices[$activity->period])
            ? (int) round($plan->prices[$activity->period] * 100)
            : 0;

        return [
            'id' => $activity->id,
            'plan_id' => $activity->plan_id,
            'plan_name' => $plan->name ?? '-',
            'period' => $activity->period,
            'period_label' => $periodLabel,
            'period_price' => $periodPrice,
            'title' => $activity->title,
            'group_size' => $activity->group_size,
            'discount_type' => $activity->discount_type,
            'discount_value' => $activity->discount_value,
            'discount_label' => $this->discountLabel((int) $activity->discount_type, (int) $activity->discount_value),
            'started_at' => $activity->started_at,
            'ended_at' => $activity->ended_at,
            'expire_minutes' => $activity->expire_minutes,
            'status' => $activity->status,
            'status_label' => (int) $activity->status === GroupBuyActivity::STATUS_ENABLED ? '启用' : '停用',
            'is_available' => $activity->isAvailable(),
            'groups_count' => (int) ($activity->groups_count ?? 0),
            'open_groups_count' => (int) ($activity->open_groups_count ?? 0),
            'completed_groups_count' => (int) ($activity->completed_groups_count ?? 0),
            'expired_groups_count' => (int) ($activity->expired_groups_count ?? 0),
            'created_at' => $activity->created_at,
            'updated_at' => $activity->updated_at,
        ];
    }

    private function groupPayload(GroupBuyGroup $group): array
    {
        return [
            'id' => $group->id,
            'activity_id' => $group->activity_id,
            'activity_title' => $group->activity->title ?? '-',
            'leader_email' => $group->leader->email ?? '-',
            'status' => $group->status,
            'status_label' => [
                GroupBuyGroup::STATUS_OPEN => '进行中',
                GroupBuyGroup::STATUS_COMPLETED => '已成团',
                GroupBuyGroup::STATUS_EXPIRED => '已过期',
            ][$group->status] ?? '未知',
            'required_count' => $group->required_count,
            'current_count' => $group->current_count,
            'expired_at' => $group->expired_at,
            'created_at' => $group->created_at,
            'members' => $group->members->map(function ($member) {
                return [
                    'id' => $member->id,
                    'email' => $member->user->email ?? '-',
                    'order_trade_no' => $member->order->trade_no ?? null,
                    'order_status' => $member->order->status ?? null,
                    'status' => $member->status,
                    'status_label' => $member->status === 2 ? '已支付' : '已加入',
                    'created_at' => $member->created_at,
                ];
            })->values(),
        ];
    }

    private function planOptions()
    {
        return Plan::orderBy('sort', 'ASC')
            ->get(['id', 'name', 'prices'])
            ->map(function (Plan $plan) {
                return [
                    'id' => $plan->id,
                    'name' => $plan->name,
                    'prices' => $plan->prices ?? [],
                    'active_periods' => array_keys($plan->getActivePeriods()),
                ];
            })
            ->values();
    }

    private function discountLabel(int $type, int $value): string
    {
        if ($type === GroupBuyActivity::DISCOUNT_FIXED) {
            return '减 ¥' . number_format($value / 100, 2);
        }

        return "{$value}% 折扣";
    }

    private function parseTime($value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_numeric($value)) {
            return (int) $value;
        }

        $timestamp = strtotime((string) $value);
        return $timestamp ?: null;
    }
}
