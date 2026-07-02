<?php

namespace App\Services;

use App\Models\Server;
use App\Models\User;

class TrafficExceededService
{
    public function checkUsers(array $userIds): array
    {
        $pendingUserIds = collect($userIds)
            ->map(fn($id) => (int) $id)
            ->filter(fn(int $id) => $id > 0)
            ->unique()
            ->values()
            ->all();

        if (empty($pendingUserIds)) {
            return [
                'checked' => 0,
                'exceeded' => 0,
                'notified_nodes' => 0,
            ];
        }

        $exceededUsers = User::toBase()
            ->whereIn('id', $pendingUserIds)
            ->whereRaw('u + d >= transfer_enable')
            ->where('transfer_enable', '>', 0)
            ->where('banned', 0)
            ->select(['id', 'group_id'])
            ->get();

        $notifiedCount = 0;

        foreach ($exceededUsers->groupBy('group_id') as $groupId => $users) {
            if (!$groupId) {
                continue;
            }

            $userIdsInGroup = $users->pluck('id')->toArray();
            $servers = ServerService::whereGroupIdsContain(Server::query(), $groupId)->get();

            foreach ($servers as $server) {
                if (!NodeSyncService::isNodeOnline($server->id)) {
                    continue;
                }

                if (NodeSyncService::push($server->id, 'sync.user.delta', [
                    'action' => 'remove',
                    'users' => array_map(fn($id) => ['id' => $id], $userIdsInGroup),
                ])) {
                    $notifiedCount++;
                }
            }
        }

        return [
            'checked' => count($pendingUserIds),
            'exceeded' => $exceededUsers->count(),
            'notified_nodes' => $notifiedCount,
        ];
    }
}
