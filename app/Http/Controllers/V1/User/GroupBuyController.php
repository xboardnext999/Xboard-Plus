<?php

namespace App\Http\Controllers\V1\User;

use App\Http\Controllers\Controller;
use App\Models\GroupBuyActivity;
use App\Models\GroupBuyGroup;
use App\Services\GroupBuyService;
use Illuminate\Http\Request;

class GroupBuyController extends Controller
{
    public function fetch(Request $request)
    {
        $request->validate([
            'plan_id' => 'nullable|integer',
            'activity_id' => 'nullable|integer',
        ]);

        $service = app(GroupBuyService::class);
        $activities = $service->availableActivities($request->input('plan_id') ? (int) $request->input('plan_id') : null);
        $groups = $service->publicGroups($request->input('activity_id') ? (int) $request->input('activity_id') : null);

        return $this->success([
            'activities' => $activities->map(fn(GroupBuyActivity $activity) => $this->formatActivity($activity))->values(),
            'groups' => $groups->map(fn(GroupBuyGroup $group) => $this->formatGroup($group))->values(),
        ]);
    }

    public function create(Request $request)
    {
        $request->validate([
            'activity_id' => 'required|integer',
        ]);

        $activity = GroupBuyActivity::findOrFail($request->input('activity_id'));
        $group = app(GroupBuyService::class)->createGroup($request->user(), $activity);

        return $this->success($this->formatGroup($group));
    }

    public function join(Request $request)
    {
        $request->validate([
            'group_id' => 'required|integer',
        ]);

        $group = GroupBuyGroup::findOrFail($request->input('group_id'));
        $group = app(GroupBuyService::class)->joinGroup($request->user(), $group);

        return $this->success($this->formatGroup($group));
    }

    private function formatActivity(GroupBuyActivity $activity): array
    {
        return [
            'id' => $activity->id,
            'plan_id' => $activity->plan_id,
            'plan_name' => $activity->plan?->name,
            'period' => $activity->period,
            'title' => $activity->title,
            'group_size' => $activity->group_size,
            'discount_type' => $activity->discount_type,
            'discount_value' => $activity->discount_value,
            'started_at' => $activity->started_at,
            'ended_at' => $activity->ended_at,
            'expire_minutes' => $activity->expire_minutes,
        ];
    }

    private function formatGroup(GroupBuyGroup $group): array
    {
        $activity = $group->activity;

        return [
            'id' => $group->id,
            'activity_id' => $group->activity_id,
            'plan_id' => $activity?->plan_id,
            'plan_name' => $activity?->plan?->name,
            'period' => $activity?->period,
            'title' => $activity?->title,
            'status' => $group->status,
            'required_count' => $group->required_count,
            'current_count' => $group->current_count,
            'expired_at' => $group->expired_at,
        ];
    }
}
