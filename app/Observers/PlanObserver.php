<?php

namespace App\Observers;

use App\Models\Plan;
use App\Models\User;
use App\Services\NodeSyncService;
use App\Services\TrafficResetService;
use Illuminate\Support\Facades\Log;

class PlanObserver
{
    public bool $afterCommit = true;

    /**
     * reset user  next_reset_at
     */
    public function updated(Plan $plan): void
    {
        if ($plan->wasChanged('group_id')) {
            $this->syncPlanUsersGroup($plan);
        }

        if ($plan->wasChanged('reset_traffic_method')) {
            $this->resetNextResetAt($plan);
        }
    }

    private function syncPlanUsersGroup(Plan $plan): void
    {
        $oldGroupId = $plan->getOriginal('group_id') ? (int) $plan->getOriginal('group_id') : null;
        $newGroupId = $plan->group_id ? (int) $plan->group_id : null;

        $query = User::where('plan_id', $plan->id);
        if ($newGroupId === null) {
            $query->whereNotNull('group_id');
        } else {
            $query->where(function ($query) use ($newGroupId) {
                $query->where('group_id', '!=', $newGroupId)
                    ->orWhereNull('group_id');
            });
        }

        $updated = $query->update([
            'group_id' => $newGroupId,
            'updated_at' => time(),
        ]);

        if ($oldGroupId) {
            NodeSyncService::notifyUsersUpdatedByGroup($oldGroupId);
        }
        if ($newGroupId) {
            NodeSyncService::notifyUsersUpdatedByGroup($newGroupId);
        }

        Log::info('plan group changed, synced users to nodes', [
            'plan_id' => $plan->id,
            'old_group_id' => $oldGroupId,
            'new_group_id' => $newGroupId,
            'users_updated' => $updated,
        ]);
    }

    private function resetNextResetAt(Plan $plan): void
    {
        $trafficResetService = app(TrafficResetService::class);
        User::where('plan_id', $plan->id)
            ->where('banned', 0)
            ->where(function ($query) {
                $query->where('expired_at', '>', time())
                    ->orWhereNull('expired_at');
            })
            ->lazyById(500)
            ->each(function (User $user) use ($trafficResetService) {
                $nextResetTime = $trafficResetService->calculateNextResetTime($user);
                $user->update([
                    'next_reset_at' => $nextResetTime?->timestamp,
                ]);
            });
    }
}
