<?php

namespace App\Http\Controllers\V2\Admin;

use App\Http\Controllers\Controller;
use App\Models\Plugin as PluginModel;
use App\Models\Server;
use App\Models\ServerGroup;
use App\Models\User;
use App\Services\AuthService;
use App\Services\DeviceStateService;
use App\Services\NodeSyncDiagnosticService;
use App\Services\ServerService;
use App\Utils\CacheKey;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class NodeSyncDiagnosticController extends Controller
{
    private $groupNameCache = null;

    public function dashboard(Request $request)
    {
        $key = trim((string) $request->query('key', ''));

        return response($this->dashboardHtml($key))
            ->header('Content-Type', 'text/html; charset=UTF-8')
            ->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            ->header('Pragma', 'no-cache')
            ->header('Expires', '0');
    }

    public function summary(Request $request): JsonResponse
    {
        if (!$this->authorized($request)) {
            return $this->json(['message' => 'diagnostic key invalid or not configured'], 403);
        }

        $nodeId = (int) $request->query('node_id', 0);
        if ($nodeId > 0) {
            $server = Server::query()->find($nodeId);

            return $this->json([
                'data' => [
                    'last_valid_snapshot' => $server ? $this->snapshotForServer($server, false) : $this->safeSnapshot(Cache::get(NodeSyncDiagnosticService::SNAPSHOT_PREFIX . $nodeId)),
                    'last_blocked_snapshot' => $server ? $this->snapshotForServer($server, true) : $this->safeSnapshot(Cache::get(NodeSyncDiagnosticService::BLOCKED_PREFIX . $nodeId)),
                ],
            ]);
        }

        return $this->json([
            'data' => $this->snapshotItems($request->boolean('include_hidden', false)),
        ]);
    }

    public function check(Request $request): JsonResponse
    {
        if (!$this->authorized($request)) {
            return $this->json(['message' => 'diagnostic key invalid or not configured'], 403);
        }

        $nodeId = (int) $request->query('node_id', 0);
        if ($nodeId <= 0) {
            return $this->json(['message' => 'node_id is required'], 422);
        }

        $node = Server::query()->find($nodeId);
        if (!$node) {
            return $this->json(['message' => 'node not found'], 404);
        }

        $user = $this->findUser($request);
        if (!$user) {
            return $this->json(['message' => 'user not found'], 404);
        }

        $groupIds = NodeSyncDiagnosticService::normalizeGroupIds($node->group_ids);
        $usedTraffic = (int) $user->u + (int) $user->d;
        $transferEnable = (int) $user->transfer_enable;
        $inNodeGroups = in_array((int) $user->group_id, $groupIds, true);
        $banned = (bool) $user->banned;
        $expired = $user->expired_at !== null && (int) $user->expired_at < time();
        $trafficExceeded = $transferEnable <= 0 || $usedTraffic >= $transferEnable;
        $currentSyncUsers = ServerService::getAvailableUsers($node);
        $includedInCurrentSync = $currentSyncUsers->contains(function ($syncUser) use ($user) {
            return (int) data_get($syncUser, 'id') === (int) $user->id
                || (string) data_get($syncUser, 'uuid') === (string) $user->uuid;
        });
        $available = $includedInCurrentSync;
        $reason = $this->reason($inNodeGroups, $banned, $expired, $trafficExceeded);
        if ($reason === 'ok' && !$includedInCurrentSync) {
            $reason = 'not_in_current_sync';
        }
        $snapshot = Cache::get(NodeSyncDiagnosticService::SNAPSHOT_PREFIX . $node->id);
        $includedInLastSync = null;

        if (is_array($snapshot) && is_array($snapshot['uuids'] ?? null)) {
            $includedInLastSync = in_array((string) $user->uuid, $snapshot['uuids'], true);
        }

        $config = $this->nodeSyncDiagnosticConfig();
        $includeIdentity = $this->toBool($config['include_user_identity'] ?? false);

        return $this->json([
            'data' => [
                'node' => [
                    'id' => (int) $node->id,
                    'name' => (string) $node->name,
                    'type' => (string) $node->type,
                    'machine_id' => $node->machine_id ? (int) $node->machine_id : null,
                    'group_ids' => $groupIds,
                    'group_names' => $this->groupNamesForIds($groupIds),
                ],
                'user' => [
                    'id' => (int) $user->id,
                    'xray_email' => $this->xrayEmail((int) $user->id),
                    'uuid' => (string) $user->uuid,
                    'email' => $includeIdentity ? (string) $user->email : $this->maskEmail((string) $user->email),
                    'group_id' => $user->group_id ? (int) $user->group_id : null,
                    'plan_id' => $user->plan_id ? (int) $user->plan_id : null,
                    'banned' => $banned,
                    'expired_at' => $user->expired_at ? (int) $user->expired_at : null,
                    'expired_at_raw' => $user->expired_at === null ? null : (int) $user->expired_at,
                    'expired_at_text' => $this->formatExpiredAt($user->expired_at === null ? null : (int) $user->expired_at),
                    'used_traffic' => $usedTraffic,
                    'transfer_enable' => $transferEnable,
                ],
                'result' => [
                    'in_node_groups' => $inNodeGroups,
                    'expired' => $expired,
                    'traffic_exceeded' => $trafficExceeded,
                    'available_now' => $available,
                    'included_in_current_sync' => $includedInCurrentSync,
                    'included_in_last_sync' => $includedInLastSync,
                    'reason' => $reason,
                    'reason_label' => $this->reasonLabel($reason),
                    'suggestion' => $this->suggestion($reason, $includedInLastSync),
                ],
                'last_snapshot' => $this->safeSnapshot($snapshot),
                'last_blocked_snapshot' => $this->safeSnapshot(Cache::get(NodeSyncDiagnosticService::BLOCKED_PREFIX . $node->id)),
            ],
        ]);
    }

    public function adminSnapshots(Request $request): JsonResponse
    {
        $rows = $this->snapshotRows($request->boolean('include_hidden', false));
        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $needle = Str::lower($search);
            $rows = array_values(array_filter($rows, function (array $row) use ($needle) {
                return str_contains(Str::lower((string) $row['node_name']), $needle)
                    || str_contains((string) $row['node_id'], $needle)
                    || str_contains(Str::lower((string) $row['node_type']), $needle)
                    || str_contains(Str::lower((string) $row['node_status']), $needle)
                    || str_contains((string) ($row['machine_id'] ?? ''), $needle)
                    || str_contains(Str::lower((string) ($row['group_ids'] ?? '')), $needle)
                    || str_contains((string) ($row['group_id_values'] ?? ''), $needle);
            }));
        }

        $nodeType = trim((string) $request->query('node_type', ''));
        if ($nodeType !== '') {
            $rows = array_values(array_filter($rows, fn(array $row) => $row['node_type'] === $nodeType));
        }

        $nodeStatus = trim((string) $request->query('node_status', ''));
        if ($nodeStatus !== '') {
            $rows = array_values(array_filter($rows, fn(array $row) => $row['node_status'] === $nodeStatus));
        }

        $syncStatus = trim((string) $request->query('sync_status', ''));
        if ($syncStatus !== '') {
            $rows = array_values(array_filter($rows, fn(array $row) => $row['abnormal_status'] === $syncStatus));
        }

        $sortField = (string) $request->query('sort_field', '');
        $sortOrder = Str::lower((string) $request->query('sort_order', 'desc')) === 'asc' ? 'asc' : 'desc';
        $sortable = ['node_id', 'machine_id', 'fetched_users', 'previous_users', 'added', 'removed', 'synced_at', 'online_users', 'online_connections'];
        if (in_array($sortField, $sortable, true)) {
            usort($rows, function (array $a, array $b) use ($sortField, $sortOrder) {
                $result = ($a[$sortField] ?? 0) <=> ($b[$sortField] ?? 0);
                return $sortOrder === 'asc' ? $result : -$result;
            });
        }

        $total = count($rows);
        $current = max(1, (int) $request->query('current', 1));
        $pageSize = max(1, min(100, (int) $request->query('pageSize', 20)));

        return $this->json([
            'data' => array_slice($rows, ($current - 1) * $pageSize, $pageSize),
            'total' => $total,
        ]);
    }

    public function denyWrite(): JsonResponse
    {
        return $this->json(['message' => 'Node sync diagnostic is read-only'], 405);
    }

    public function nodeUsers(Request $request): JsonResponse
    {
        if (!$this->authorized($request)) {
            return $this->json(['message' => 'diagnostic key invalid or not configured'], 403);
        }

        return $this->json([
            'data' => $this->nodeUsersPayload($request),
        ]);
    }

    public function nodeAccess(Request $request): JsonResponse
    {
        if (!$this->authorized($request)) {
            return $this->json(['message' => 'diagnostic key invalid or not configured'], 403);
        }

        return $this->json([
            'data' => $this->nodeAccessPayload($request),
        ]);
    }

    public function adminNodeUsers(Request $request): JsonResponse
    {
        return $this->json([
            'data' => $this->nodeUsersPayload($request),
        ]);
    }

    public function adminNodeAccess(Request $request): JsonResponse
    {
        return $this->json([
            'data' => $this->nodeAccessPayload($request),
        ]);
    }

    private function json(array $payload, int $status = 200): JsonResponse
    {
        return response()->json($payload, $status)
            ->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            ->header('Pragma', 'no-cache')
            ->header('Expires', '0');
    }

    private function snapshotItems(bool $includeHidden = false): array
    {
        return $this->serverQuery($includeHidden)
            ->get()
            ->map(function (Server $server) {
                return [
                    'node_id' => (int) $server->id,
                    'last_valid_snapshot' => $this->snapshotForServer($server, false),
                    'last_blocked_snapshot' => $this->snapshotForServer($server, true),
                ];
            })
            ->values()
            ->all();
    }

    private function snapshotRows(bool $includeHidden = false): array
    {
        $rows = [];
        foreach ($this->serverQuery($includeHidden)->get() as $server) {
            $nodeId = (int) $server->id;
            $validSnapshot = Cache::get(NodeSyncDiagnosticService::SNAPSHOT_PREFIX . $nodeId);
            $blockedSnapshot = Cache::get(NodeSyncDiagnosticService::BLOCKED_PREFIX . $nodeId);
            $snapshot = is_array($validSnapshot) ? $validSnapshot : (is_array($blockedSnapshot) ? $blockedSnapshot : null);
            $snapshot ??= $this->fallbackSnapshot($server);

            $blocked = is_array($blockedSnapshot);
            $abnormal = (bool) data_get($snapshot, 'abnormal.detected', false);
            $nodeStatus = $this->nodeStatusValue((int) $server->available_status);
            $groupIds = NodeSyncDiagnosticService::normalizeGroupIds($snapshot['group_ids'] ?? $server->group_ids);
            $groupNames = $this->groupNamesForIds($groupIds);
            $rows[] = [
                'node_id' => $nodeId,
                'node_name' => (string) $server->name,
                'node_type' => (string) $server->type,
                'machine_id' => (int) ($server->machine_id ?? 0),
                'sort' => (int) ($server->sort ?? 0),
                'show' => (bool) $server->show,
                'enabled' => (bool) $server->enabled,
                'node_status' => $nodeStatus,
                'online_users' => (int) $server->online,
                'online_connections' => (int) $server->online_conn,
                'last_check_at' => (int) ($server->last_check_at ?? 0),
                'last_push_at' => (int) ($server->last_push_at ?? 0),
                'group_ids' => implode(',', $groupNames),
                'group_id_values' => implode(',', $groupIds),
                'group_names' => implode(',', $groupNames),
                'group_users' => (int) ($snapshot['group_users'] ?? 0),
                'available_users' => (int) ($snapshot['available_users'] ?? 0),
                'fetched_users' => (int) ($snapshot['fetched_users'] ?? 0),
                'previous_users' => (int) ($snapshot['previous_users'] ?? 0),
                'added' => (int) ($snapshot['added'] ?? 0),
                'removed' => (int) ($snapshot['removed'] ?? 0),
                'excluded_banned' => (int) ($snapshot['excluded_banned'] ?? 0),
                'excluded_expired' => (int) ($snapshot['excluded_expired'] ?? 0),
                'excluded_traffic' => (int) ($snapshot['excluded_traffic'] ?? 0),
                'abnormal_status' => $blocked ? 'blocked' : ($abnormal ? 'warning' : 'normal'),
                'abnormal_reason' => implode('; ', (array) data_get($snapshot, 'abnormal.reasons', [])),
                'request_path' => (string) ($snapshot['request_path'] ?? ''),
                'synced_at' => (int) ($snapshot['synced_at'] ?? 0),
            ];
        }

        return $rows;
    }

    private function serverQuery(bool $includeHidden)
    {
        return Server::query()
            ->when(!$includeHidden, fn($query) => $query->where('show', true))
            ->orderBy('sort', 'ASC')
            ->orderBy('id', 'ASC');
    }

    private function snapshotForServer(Server $server, bool $blocked): ?array
    {
        $snapshot = Cache::get(($blocked ? NodeSyncDiagnosticService::BLOCKED_PREFIX : NodeSyncDiagnosticService::SNAPSHOT_PREFIX) . $server->id);
        if (!is_array($snapshot)) {
            return $blocked ? null : $this->fallbackSnapshot($server);
        }

        $snapshot = $this->safeSnapshot($snapshot);
        $snapshot['node_status'] = $this->nodeStatusValue((int) $server->available_status);
        $snapshot['online_users'] = (int) $server->online;
        $snapshot['online_connections'] = (int) $server->online_conn;
        $snapshot['show'] = (bool) $server->show;
        $snapshot['enabled'] = (bool) $server->enabled;
        $snapshot['sort'] = (int) ($server->sort ?? 0);
        $snapshot['last_check_at'] = (int) ($server->last_check_at ?? 0);
        $snapshot['last_push_at'] = (int) ($server->last_push_at ?? 0);
        $snapshot = $this->withGroupNames($snapshot, $server);

        return $snapshot;
    }

    private function fallbackSnapshot(Server $server): array
    {
        $groupIds = NodeSyncDiagnosticService::normalizeGroupIds($server->group_ids);

        return [
            'node_id' => (int) $server->id,
            'node_name' => (string) $server->name,
            'node_type' => (string) $server->type,
            'machine_id' => $server->machine_id ? (int) $server->machine_id : null,
            'group_ids' => $groupIds,
            'group_names' => $this->groupNamesForIds($groupIds),
            'group_label' => $this->groupLabel($groupIds),
            'group_users' => 0,
            'available_users' => 0,
            'fetched_users' => 0,
            'returned_users' => 0,
            'excluded_banned' => 0,
            'excluded_expired' => 0,
            'excluded_traffic' => 0,
            'uuid_cache_enabled' => false,
            'synced_at' => 0,
            'request_path' => '',
            'previous_users' => 0,
            'added' => 0,
            'removed' => 0,
            'added_samples' => [],
            'removed_samples' => [],
            'bootstrap' => true,
            'abnormal' => [
                'detected' => false,
                'reasons' => [],
            ],
        ];
    }

    private function withGroupNames(array $snapshot, Server $server): array
    {
        $groupIds = NodeSyncDiagnosticService::normalizeGroupIds($snapshot['group_ids'] ?? $server->group_ids);
        $snapshot['group_ids'] = $groupIds;
        $snapshot['group_names'] = $this->groupNamesForIds($groupIds);
        $snapshot['group_label'] = $this->groupLabel($groupIds);

        return $snapshot;
    }

    private function groupNamesForIds(array $groupIds): array
    {
        $map = $this->groupNameMap();

        return collect($groupIds)
            ->map(function (int $groupId) use ($map) {
                $name = trim((string) ($map[$groupId] ?? ''));
                return $name !== '' ? $name : '#' . $groupId;
            })
            ->values()
            ->all();
    }

    private function groupLabel(array $groupIds): string
    {
        return implode(',', $this->groupNamesForIds($groupIds));
    }

    private function groupNameMap(): array
    {
        if (is_array($this->groupNameCache)) {
            return $this->groupNameCache;
        }

        $this->groupNameCache = ServerGroup::query()
            ->pluck('name', 'id')
            ->map(fn($name) => (string) $name)
            ->all();

        return $this->groupNameCache;
    }

    private function nodeStatusValue(int $availableStatus): string
    {
        return match ($availableStatus) {
            Server::STATUS_ONLINE => 'online',
            Server::STATUS_ONLINE_NO_PUSH => 'online_no_push',
            default => 'offline',
        };
    }

    private function nodeUsersPayload(Request $request): array
    {
        $nodeId = (int) $request->query('node_id', 0);
        if ($nodeId <= 0) {
            return [
                'node' => null,
                'users' => [],
                'total' => 0,
                'message' => 'node_id is required',
            ];
        }

        $node = Server::query()->find($nodeId);
        if (!$node) {
            return [
                'node' => null,
                'users' => [],
                'total' => 0,
                'message' => 'node not found',
            ];
        }

        $groupIds = NodeSyncDiagnosticService::normalizeGroupIds($node->group_ids);
        $snapshot = Cache::get(NodeSyncDiagnosticService::SNAPSHOT_PREFIX . $node->id);
        $snapshotUuids = is_array($snapshot) && is_array($snapshot['uuids'] ?? null)
            ? array_flip($snapshot['uuids'])
            : null;

        $currentSyncUsers = ServerService::getAvailableUsers($node);
        $currentSyncIds = array_flip($currentSyncUsers
            ->map(fn($user) => (int) data_get($user, 'id'))
            ->filter(fn(int $id) => $id > 0)
            ->values()
            ->all());
        $currentSyncUuids = array_flip($currentSyncUsers
            ->map(fn($user) => (string) data_get($user, 'uuid'))
            ->filter(fn(string $uuid) => $uuid !== '')
            ->values()
            ->all());
        $nodeDevices = app(DeviceStateService::class)->getNodeDevices((int) $node->id);
        $recentAccessByUser = $this->recentAccessByUser($node);
        $users = empty($groupIds)
            ? collect()
            : User::query()
                ->whereIn('group_id', $groupIds)
                ->select(['id', 'email', 'uuid', 'group_id', 'plan_id', 'banned', 'expired_at', 'transfer_enable', 'u', 'd', 'speed_limit', 'device_limit', 'online_count', 'last_online_at'])
                ->orderBy('id', 'ASC')
                ->get();

        $nodeType = $node->type;
        $nodeId = (int) $node->id;
        $kernelLabel = $this->kernelLabel($node);
        $rows = $users->map(function (User $user) use ($nodeType, $nodeId, $groupIds, $snapshotUuids, $currentSyncIds, $currentSyncUuids, $nodeDevices, $recentAccessByUser, $kernelLabel) {
            $usedTraffic = (int) $user->u + (int) $user->d;
            $transferEnable = (int) $user->transfer_enable;
            $inNodeGroups = in_array((int) $user->group_id, $groupIds, true);
            $banned = (bool) $user->banned;
            $expired = $user->expired_at !== null && (int) $user->expired_at < time();
            $trafficExceeded = $transferEnable <= 0 || $usedTraffic >= $transferEnable;
            $includedInCurrentSync = isset($currentSyncIds[(int) $user->id])
                || isset($currentSyncUuids[(string) $user->uuid]);
            $available = $includedInCurrentSync;
            $reason = $this->reason($inNodeGroups, $banned, $expired, $trafficExceeded);
            if ($reason === 'ok' && !$includedInCurrentSync) {
                $reason = 'not_in_current_sync';
            }
            $includedInLastSync = $snapshotUuids === null ? null : isset($snapshotUuids[(string) $user->uuid]);
            $connections = (int) Cache::get(CacheKey::get("USER_ONLINE_CONN_{$nodeType}_{$nodeId}", $user->id), 0);
            $reportedNodeDeviceCount = count((array) ($nodeDevices[(int) $user->id] ?? []));
            $recentAccessAt = (int) ($recentAccessByUser[(int) $user->id] ?? 0);
            $nodeDeviceCount = $reportedNodeDeviceCount;
            $nodeDeviceSource = 'reported';
            if ($nodeDeviceCount <= 0 && ($connections > 0 || $recentAccessAt > 0)) {
                $nodeDeviceCount = 1;
                $nodeDeviceSource = $connections > 0 ? 'connection' : 'access';
            }
            $online = $connections > 0 || $nodeDeviceCount > 0 || $recentAccessAt > 0;

            return [
                'id' => (int) $user->id,
                'xray_email' => $this->xrayEmail((int) $user->id),
                'kernel' => $kernelLabel,
                'email' => (string) $user->email,
                'email_masked' => $this->maskEmail((string) $user->email),
                'uuid' => (string) $user->uuid,
                'group_id' => $user->group_id ? (int) $user->group_id : null,
                'plan_id' => $user->plan_id ? (int) $user->plan_id : null,
                'online' => $online,
                'connections' => $connections,
                'node_devices' => $nodeDeviceCount,
                'reported_node_devices' => $reportedNodeDeviceCount,
                'node_devices_inferred' => $nodeDeviceCount > $reportedNodeDeviceCount,
                'node_devices_source' => $nodeDeviceSource,
                'online_count' => (int) ($user->online_count ?? 0),
                'last_online_at' => $this->timestampValue($user->last_online_at ?? null),
                'recent_access_at' => $recentAccessAt ?: null,
                'available_now' => $available,
                'included_in_current_sync' => $includedInCurrentSync,
                'included_in_last_sync' => $includedInLastSync,
                'reason' => $reason,
                'reason_label' => $this->reasonLabel($reason),
                'used_traffic' => $usedTraffic,
                'transfer_enable' => $transferEnable,
                'speed_limit' => $user->speed_limit,
                'device_limit' => $user->device_limit,
                'expired_at' => $user->expired_at ? (int) $user->expired_at : null,
                'expired_at_raw' => $user->expired_at === null ? null : (int) $user->expired_at,
                'expired_at_text' => $this->formatExpiredAt($user->expired_at === null ? null : (int) $user->expired_at),
                'status' => !$available ? 'unavailable' : ($online ? 'online' : 'offline'),
            ];
        })->values();

        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $needle = Str::lower($search);
            $rows = $rows->filter(function (array $row) use ($needle) {
                return str_contains((string) $row['id'], $needle)
                    || str_contains(Str::lower((string) $row['xray_email']), $needle)
                    || str_contains(Str::lower((string) $row['email']), $needle)
                    || str_contains(Str::lower((string) $row['uuid']), $needle);
            })->values();
        }

        $status = trim((string) $request->query('status', ''));
        if ($status !== '') {
            $rows = $rows->filter(function (array $row) use ($status) {
                return match ($status) {
                    'online' => $row['online'] === true,
                    'offline' => $row['online'] === false && $row['available_now'] === true,
                    'unavailable' => $row['available_now'] === false,
                    'current_sync' => $row['included_in_current_sync'] === true,
                    'not_current_sync' => $row['included_in_current_sync'] === false,
                    'synced' => $row['included_in_last_sync'] === true,
                    'not_synced' => $row['included_in_last_sync'] === false,
                    default => true,
                };
            })->values();
        }

        return [
            'node' => [
                'id' => (int) $node->id,
                'name' => (string) $node->name,
                'type' => (string) $node->type,
                'kernel' => $kernelLabel,
                'machine_id' => $node->machine_id ? (int) $node->machine_id : null,
                'group_ids' => $groupIds,
                'group_names' => $this->groupNamesForIds($groupIds),
                'status' => $this->nodeStatusValue((int) $node->available_status),
                'online_users' => (int) $node->online,
                'online_connections' => (int) $node->online_conn,
            ],
            'summary' => [
                'total' => $rows->count(),
                'online' => $rows->where('online', true)->count(),
                'offline' => $rows->filter(fn(array $row) => !$row['online'] && $row['available_now'])->count(),
                'unavailable' => $rows->where('available_now', false)->count(),
                'current_sync' => $rows->where('included_in_current_sync', true)->count(),
                'not_current_sync' => $rows->where('included_in_current_sync', false)->count(),
                'synced' => $rows->where('included_in_last_sync', true)->count(),
                'not_synced' => $rows->where('included_in_last_sync', false)->count(),
            ],
            'users' => $rows->take(1000)->all(),
        ];
    }

    private function nodeAccessPayload(Request $request): array
    {
        $nodeId = (int) $request->query('node_id', 0);
        if ($nodeId <= 0) {
            return [
                'node' => null,
                'access' => [],
                'total' => 0,
                'message' => 'node_id is required',
            ];
        }

        $node = Server::query()->find($nodeId);
        if (!$node) {
            return [
                'node' => null,
                'access' => [],
                'total' => 0,
                'message' => 'node not found',
            ];
        }

        $cacheKey = CacheKey::get('SERVER_' . strtoupper((string) $node->type) . '_ACCESS_LOG', $node->id);
        $rows = Cache::get($cacheKey, []);
        if (!is_array($rows)) {
            $rows = [];
        }

        $userIds = collect($rows)
            ->map(fn($row) => (int) data_get($row, 'user_id'))
            ->filter(fn(int $userId) => $userId > 0)
            ->unique()
            ->values()
            ->all();
        $users = empty($userIds)
            ? collect()
            : User::query()->whereIn('id', $userIds)->get(['id', 'email'])->keyBy('id');

        $rows = collect($rows)->map(function ($row) use ($users) {
            $userId = (int) data_get($row, 'user_id');
            $upload = max(0, (int) data_get($row, 'upload', 0));
            $download = max(0, (int) data_get($row, 'download', 0));
            return [
                'session_id' => (string) data_get($row, 'session_id', ''),
                'user_id' => $userId,
                'email' => (string) data_get($users->get($userId), 'email', ''),
                'xray_email' => (string) data_get($row, 'xray_email', 'user@' . $userId),
                'source' => (string) data_get($row, 'source', ''),
                'network' => (string) data_get($row, 'network', ''),
                'destination' => (string) data_get($row, 'destination', ''),
                'timestamp' => (int) data_get($row, 'timestamp', 0),
                'upload' => $upload,
                'download' => $download,
                'total' => $upload + $download,
            ];
        });

        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $needle = Str::lower($search);
            $rows = $rows->filter(function (array $row) use ($needle) {
                return str_contains((string) $row['user_id'], $needle)
                    || str_contains(Str::lower((string) $row['email']), $needle)
                    || str_contains(Str::lower((string) $row['xray_email']), $needle)
                    || str_contains(Str::lower((string) $row['source']), $needle)
                    || str_contains(Str::lower((string) $row['destination']), $needle);
            })->values();
        }

        $userId = (int) $request->query('user_id', 0);
        if ($userId > 0) {
            $rows = $rows->where('user_id', $userId)->values();
        }

        $rows = $rows->sortByDesc('timestamp')->values();
        $limit = max(1, min(200, (int) $request->query('limit', 100)));

        return [
            'node' => [
                'id' => (int) $node->id,
                'name' => (string) $node->name,
                'type' => (string) $node->type,
            ],
            'total' => $rows->count(),
            'access' => $rows->take($limit)->all(),
        ];
    }

    private function recentAccessByUser(Server $node, int $activeSeconds = 60): array
    {
        $cacheKey = CacheKey::get('SERVER_' . strtoupper((string) $node->type) . '_ACCESS_LOG', $node->id);
        $rows = Cache::get($cacheKey, []);
        if (!is_array($rows)) {
            return [];
        }

        $cutoff = time() - max(30, $activeSeconds);
        $active = [];
        foreach ($rows as $row) {
            $userId = (int) data_get($row, 'user_id');
            $timestamp = (int) data_get($row, 'timestamp', 0);
            if ($userId <= 0 || $timestamp < $cutoff) {
                continue;
            }
            $active[$userId] = max((int) ($active[$userId] ?? 0), $timestamp);
        }

        return $active;
    }

    private function findUser(Request $request): ?User
    {
        $query = User::query();

        if ($uuid = trim((string) $request->query('uuid', ''))) {
            return $query->where('uuid', $uuid)->first();
        }

        if ($userId = (int) $request->query('user_id', 0)) {
            return $query->where('id', $userId)->first();
        }

        if ($email = trim((string) $request->query('email', ''))) {
            return $query->where('email', strtolower($email))->first();
        }

        return null;
    }

    private function reason(bool $inNodeGroups, bool $banned, bool $expired, bool $trafficExceeded): string
    {
        if (!$inNodeGroups) {
            return 'group_mismatch';
        }
        if ($banned) {
            return 'banned';
        }
        if ($expired) {
            return 'expired';
        }
        if ($trafficExceeded) {
            return 'traffic_exceeded';
        }
        return 'ok';
    }

    private function reasonLabel(string $reason): string
    {
        return match ($reason) {
            'group_mismatch' => '权限组不匹配',
            'banned' => '已封禁',
            'expired' => '套餐已过期',
            'traffic_exceeded' => '流量已用尽',
            'not_in_current_sync' => '当前名单未包含',
            default => '可用',
        };
    }

    private function kernelLabel(Server $node): string
    {
        $reported = $this->reportedKernelLabel($node);
        if ($reported !== '') {
            return $reported;
        }

        $network = Str::lower((string) data_get($node->protocol_settings, 'network', data_get($node, 'network', '')));
        if (in_array($network, ['xhttp', 'splithttp'], true)) {
            return 'Xray';
        }

        return 'SingBox';
    }

    private function reportedKernelLabel(Server $node): string
    {
        $nodeType = strtoupper((string) $node->type);
        $cacheKeys = [
            CacheKey::get("SERVER_{$nodeType}_METRICS", $node->id),
            CacheKey::get("SERVER_{$nodeType}_LOAD_STATUS", $node->id),
        ];

        foreach ($cacheKeys as $cacheKey) {
            $data = Cache::get($cacheKey, []);
            if (!is_array($data)) {
                continue;
            }
            foreach (['effective_kernel', 'kernel_type', 'kernel'] as $key) {
                $label = $this->normalizeKernelLabel((string) data_get($data, $key, ''));
                if ($label !== '') {
                    return $label;
                }
            }
        }

        return '';
    }

    private function normalizeKernelLabel(string $kernel): string
    {
        $kernel = trim($kernel);
        if ($kernel === '') {
            return '';
        }

        $normalized = Str::lower(str_replace(['-', '_', ' '], '', $kernel));
        if (str_contains($normalized, 'xray')) {
            return 'Xray';
        }
        if (str_contains($normalized, 'singbox')) {
            return 'SingBox';
        }

        return $kernel;
    }

    private function suggestion(string $reason, ?bool $includedInLastSync): string
    {
        if ($reason !== 'ok') {
            return match ($reason) {
                'group_mismatch' => '检查用户 group_id 与节点 group_ids，确认套餐/权限组是否真正写入数据库。',
                'banned' => '解除封禁后等待节点下一次同步，或重启节点验证。',
                'expired' => '检查 expired_at 和套餐续费状态。',
                'traffic_exceeded' => '检查用户 u+d 是否小于 transfer_enable，必要时重置流量。',
                'not_in_current_sync' => '用户基础状态看起来正常，但面板当前下发名单仍未包含它；检查插件过滤、权限组缓存或面板同步逻辑。',
                default => '检查用户状态。',
            };
        }

        if ($includedInLastSync === false) {
            return '用户当前符合条件，但不在最近一次同步快照内；重点检查节点端是否拉取到最新用户列表，或面板 Hook/缓存是否异常。';
        }

        if ($includedInLastSync === true) {
            return '用户已在最近一次同步快照内；若仍无法连接，重点检查节点端热更新、内核用户列表和客户端 UUID。';
        }

        return '用户当前符合条件；未开启或未保存 UUID 快照，无法判断最近一次同步是否包含该 UUID。';
    }

    private function safeSnapshot(mixed $snapshot): ?array
    {
        if (!is_array($snapshot)) {
            return null;
        }
        unset($snapshot['uuids']);

        return $snapshot;
    }

    private function authorized(Request $request): bool
    {
        $authorization = $request->input('auth_data') ?: $request->header('authorization');
        if ($authorization) {
            $user = AuthService::findUserByBearerToken((string) $authorization);
            if ($user && $user->is_admin) {
                return true;
            }
        }

        $config = $this->nodeSyncDiagnosticConfig();
        $expected = trim((string) ($config['diagnostic_key'] ?? ''));
        if ($expected === '' || $expected === 'change-me') {
            return false;
        }

        return hash_equals($expected, trim((string) $request->query('key', '')));
    }

    private function nodeSyncDiagnosticConfig(): array
    {
        $defaults = [
            'diagnostic_key' => '',
            'include_user_identity' => false,
        ];

        $plugin = PluginModel::query()
            ->where('code', 'node_sync_diagnostic')
            ->first();

        if (!$plugin || empty($plugin->config)) {
            return $defaults;
        }

        $config = json_decode($plugin->config, true);
        return array_merge($defaults, is_array($config) ? $config : []);
    }

    private function maskEmail(string $email): string
    {
        if (!str_contains($email, '@')) {
            return '***';
        }

        [$name, $domain] = explode('@', $email, 2);
        $prefix = mb_substr($name, 0, 2);

        return $prefix . '***@' . $domain;
    }

    private function xrayEmail(int $userId): string
    {
        return 'user@' . $userId;
    }

    private function timestampValue(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        if ($value instanceof \DateTimeInterface) {
            return $value->getTimestamp();
        }
        if (is_numeric($value)) {
            return (int) $value;
        }

        $timestamp = strtotime((string) $value);
        return $timestamp === false ? null : $timestamp;
    }

    private function formatExpiredAt(?int $expiredAt): string
    {
        if ($expiredAt === null) {
            return '长期有效(NULL)';
        }
        if ($expiredAt <= 0) {
            return $expiredAt . '（节点同步会按已过期处理）';
        }

        return date('Y-m-d H:i:s', $expiredAt);
    }

    private function toBool(mixed $value): bool
    {
        if (is_bool($value)) {
            return $value;
        }
        if (is_numeric($value)) {
            return (int) $value === 1;
        }
        if (is_string($value)) {
            return in_array(strtolower($value), ['1', 'true', 'yes', 'on'], true);
        }
        return (bool) $value;
    }

    private function dashboardHtml(string $key): string
    {
        $summaryUrl = json_encode('/api/v1/node-sync-diagnostic/summary?key=' . rawurlencode($key), JSON_UNESCAPED_SLASHES);
        $nodeUsersUrl = json_encode('/api/v1/node-sync-diagnostic/node-users', JSON_UNESCAPED_SLASHES);
        $accessUrl = json_encode('/api/v1/node-sync-diagnostic/access', JSON_UNESCAPED_SLASHES);
        $keyJson = json_encode($key, JSON_UNESCAPED_UNICODE);

        $html = <<<'HTML'
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>节点数据分析</title>
  <style>
    :root {
      --background:0 0% 100%;
      --foreground:222.2 84% 4.9%;
      --card:0 0% 100%;
      --card-foreground:222.2 84% 4.9%;
      --primary:222.2 47.4% 11.2%;
      --primary-foreground:210 40% 98%;
      --muted:210 40% 96.1%;
      --muted-foreground:215.4 16.3% 46.9%;
      --border:214.3 31.8% 91.4%;
      --input:214.3 31.8% 91.4%;
      --ring:222.2 84% 4.9%;
      --radius:.5rem;
      --ok:#059669;
      --warn:#d97706;
      --bad:#dc2626;
    }
    * { box-sizing: border-box; }
    body { margin:0; background:hsl(var(--background)); color:hsl(var(--foreground)); font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; -webkit-font-smoothing:antialiased; }
    .wrap { width:100%; margin:0; padding:0 0 24px; }
    .top { display:block; margin-bottom:16px; }
    h1 { margin:0; font-size:1.5rem; line-height:2rem; font-weight:700; letter-spacing:-.025em; }
    h3 { margin:0 0 8px; font-size:1rem; line-height:1.5rem; font-weight:600; letter-spacing:-.025em; }
    .muted { color:hsl(var(--muted-foreground)); }
    .page-subtitle { margin-top:.5rem; font-size:.875rem; line-height:1.25rem; }
    .btn { display:inline-flex; align-items:center; justify-content:center; white-space:nowrap; height:36px; border:1px solid transparent; border-radius:calc(var(--radius) - 2px); background:hsl(var(--primary)); color:hsl(var(--primary-foreground)); padding:0 16px; cursor:pointer; font-size:.875rem; line-height:1.25rem; font-weight:500; box-shadow:0 1px 2px rgba(0,0,0,.05); transition:background-color .15s ease,color .15s ease,border-color .15s ease; }
    .btn:hover { background:hsl(var(--primary) / .9); }
    .btn.secondary, .btn.ghost { background:hsl(var(--background)); color:hsl(var(--foreground)); border-color:hsl(var(--input)); }
    .btn.secondary:hover, .btn.ghost:hover { background:hsl(var(--muted)); }
    .btn.small { min-width:64px; height:32px; padding:0 12px; font-size:.75rem; line-height:1rem; }
    .grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:16px; margin-bottom:16px; }
    .card { background:hsl(var(--card)); color:hsl(var(--card-foreground)); border:1px solid hsl(var(--border)); border-radius:var(--radius); padding:16px; box-shadow:0 1px 2px rgba(0,0,0,.05); }
    .card > .muted:first-child { font-size:.875rem; line-height:1.25rem; font-weight:500; }
    .metric { font-size:1.25rem; line-height:1.75rem; font-weight:700; margin-top:4px; }
    .rolling-metric { display:inline-flex; align-items:baseline; min-width:190px; font-size:1.25rem; overflow:hidden; }
    .roll-char { position:relative; display:inline-block; width:.64em; height:1.18em; overflow:hidden; vertical-align:bottom; }
    .roll-char.wide { width:auto; min-width:.34em; }
    .roll-old, .roll-new { display:block; height:1.18em; line-height:1.18; }
    .roll-new { position:absolute; left:0; top:100%; }
    .roll-char.static .roll-new { position:static; }
    .roll-char.changed .roll-old { animation:rollOld .42s cubic-bezier(.22,.61,.36,1) forwards; }
    .roll-char.changed .roll-new { animation:rollNew .42s cubic-bezier(.22,.61,.36,1) forwards; }
    @keyframes rollOld { to { transform:translateY(-100%); } }
    @keyframes rollNew { to { transform:translateY(-100%); } }
    .tools-card { background:hsl(var(--card)); border:1px solid hsl(var(--border)); border-radius:var(--radius); padding:12px; margin:16px 0; box-shadow:0 1px 2px rgba(0,0,0,.05); }
    .toolbar { display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin:0; }
    .toolbar + .toolbar { margin-top:10px; padding-top:10px; border-top:1px solid #eef2f7; }
    .toolbar .spacer { flex:1 1 auto; min-width:16px; }
    .toolbar.compact input, .toolbar.compact select { height:32px; }
    .toolbar label { display:inline-flex; align-items:center; gap:6px; height:32px; font-size:.875rem; line-height:1.25rem; white-space:nowrap; }
    .mini-toolbar input, .mini-toolbar select { height:32px; }
    .tool-search { min-width:260px; flex:1 1 260px; }
    .uuid-input { min-width:160px; }
    input, select { height:36px; border:1px solid hsl(var(--input)); border-radius:calc(var(--radius) - 2px); padding:0 12px; min-width:180px; background:transparent; color:hsl(var(--foreground)); font-size:.875rem; line-height:1.25rem; box-shadow:0 1px 2px rgba(0,0,0,.05); transition:border-color .15s ease,box-shadow .15s ease; }
    input::placeholder { color:hsl(var(--muted-foreground)); }
    input:focus, select:focus { outline:none; box-shadow:0 0 0 1px hsl(var(--ring)); }
    input[type="checkbox"] { width:16px; height:16px; min-width:auto; accent-color:hsl(var(--primary)); box-shadow:none; }
    table { width:100%; border-collapse:separate; border-spacing:0; background:hsl(var(--card)); border:1px solid hsl(var(--border)); border-radius:var(--radius); overflow:hidden; font-size:.875rem; line-height:1.25rem; }
    th, td { height:40px; padding:8px 12px; border-bottom:1px solid hsl(var(--border)); text-align:left; white-space:nowrap; vertical-align:middle; }
    th { background:hsl(var(--background)); color:hsl(var(--muted-foreground)); font-size:.875rem; line-height:1.25rem; font-weight:500; }
    tr:last-child td { border-bottom:0; }
    .name { white-space:normal; min-width:220px; font-weight:500; }
    .tag { display:inline-flex; align-items:center; border-radius:999px; padding:2px 8px; font-size:.75rem; line-height:1rem; font-weight:500; background:#eff6ff; color:#1d4ed8; }
    .status-badge { display:inline-flex; align-items:center; justify-content:center; min-width:48px; height:24px; padding:0 9px; border-radius:7px; font-size:.75rem; line-height:1rem; font-weight:500; }
    .status-badge.ok { background:#ecfdf5; color:#047857; }
    .status-badge.warn { background:#fff7ed; color:#c2410c; }
    .status-badge.bad { background:#fef2f2; color:#dc2626; }
    .ok { color:var(--ok); font-weight:700; }
    .warn { color:var(--warn); font-weight:700; }
    .bad { color:var(--bad); font-weight:700; }
    .mono { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }
    .mini-toolbar { display:flex; flex-wrap:wrap; gap:10px; margin:12px 0 12px; }
    .panel { margin-top:16px; }
    .detail-card { padding:0; overflow:hidden; }
    .tabs { display:inline-flex; align-items:center; gap:6px; padding:4px; border:1px solid hsl(var(--border)); border-radius:var(--radius); background:hsl(var(--muted)); }
    .tab-btn { border:0; border-radius:6px; background:transparent; color:#475569; height:32px; padding:0 12px; cursor:pointer; font-weight:500; }
    .tab-btn.active { background:hsl(var(--background)); color:hsl(var(--foreground)); box-shadow:0 1px 2px rgba(0,0,0,.05); }
    .tab-panel { display:block; padding:16px; }
    .table-wrap { width:100%; max-height:520px; overflow:auto; border:1px solid hsl(var(--border)); border-radius:var(--radius); background:hsl(var(--card)); }
    .table-wrap table { border:0; border-radius:0; min-width:980px; }
    .data-table th { height:40px; color:hsl(var(--muted-foreground)); font-size:.875rem; font-weight:500; background:hsl(var(--background)); border-bottom:1px solid hsl(var(--border)); vertical-align:middle; }
    .data-table td { height:40px; font-size:.875rem; font-weight:400; border-bottom:1px solid hsl(var(--border)); padding-top:6px; padding-bottom:6px; vertical-align:middle; }
    .data-table tr:last-child td { border-bottom:0; }
    .id-pill { display:inline-flex; align-items:center; justify-content:center; min-width:54px; height:24px; padding:0 9px; border:1px solid hsl(var(--border)); border-radius:7px; background:hsl(var(--background)); box-shadow:0 1px 2px rgba(0,0,0,.05); font-size:.75rem; line-height:1rem; font-weight:500; color:hsl(var(--foreground)); }
    .user-cell { display:inline-flex; align-items:center; gap:8px; min-width:190px; font-weight:400; vertical-align:middle; }
    .status-dot { width:13px; height:13px; border-radius:999px; background:#d1d5db; border:2px solid #f3f4f6; flex:0 0 auto; }
    .status-dot.online { background:#22c55e; border-color:#dcfce7; }
    .count-pill { display:inline-flex; align-items:center; justify-content:center; min-width:56px; height:24px; padding:0 9px; border:1px solid hsl(var(--border)); border-radius:7px; background:hsl(var(--muted)); font-size:.75rem; line-height:1rem; font-weight:500; }
    .status-pill { display:inline-flex; align-items:center; justify-content:center; min-width:56px; height:24px; padding:0 9px; border-radius:7px; background:hsl(var(--background)); box-shadow:0 1px 2px rgba(0,0,0,.05); font-size:.75rem; line-height:1rem; font-weight:500; }
    .status-pill.ok { color:hsl(var(--foreground)); }
    .status-pill.bad { color:#dc2626; }
    .sync-pill { display:inline-flex; align-items:center; justify-content:center; min-width:56px; height:24px; padding:0 9px; border-radius:7px; background:#eff6ff; color:#1d4ed8; font-size:.75rem; line-height:1rem; font-weight:500; }
    .sync-pill.ok { background:#ecfdf5; color:#047857; }
    .sync-pill.wait { background:#fff7ed; color:#c2410c; }
    .sync-pill.muted-pill { background:#f1f5f9; color:#64748b; }
    .table-message { text-align:center; color:hsl(var(--muted-foreground)); padding:24px 12px; }
    .access-table th, .access-table td { vertical-align:middle; }
    .access-table .target { white-space:normal; min-width:280px; word-break:break-all; }
    .access-table .email { min-width:210px; }
    .access-table .ip { min-width:130px; }
    .access-table .traffic { min-width:90px; text-align:right; }
    .row-action { text-align:right; }
    .node-table .group-cell { display:block; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .node-table .btn { white-space:nowrap; }
    pre { margin:0; max-height:420px; overflow:auto; background:#0f172a; color:#e5e7eb; padding:14px; border-radius:8px; font-size:12px; }
    @media (max-width: 1200px) { .grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
    @media (max-width: 900px) { .grid { grid-template-columns:1fr; } .wrap { padding:0 0 28px; } table { display:block; overflow:auto; } .tabs { width:100%; overflow:auto; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <div>
        <h1>节点数据分析</h1>
        <div class="muted page-subtitle">查看节点最近一次用户同步快照，并按 UUID 排查用户是否下发到节点。</div>
      </div>
    </div>
    <div class="grid">
      <div class="card"><div class="muted">节点数</div><div class="metric rolling-metric" id="m-nodes">-</div></div>
      <div class="card"><div class="muted">同步用户总数</div><div class="metric rolling-metric" id="m-users">-</div></div>
      <div class="card"><div class="muted">异常节点</div><div class="metric rolling-metric" id="m-bad">-</div></div>
      <div class="card"><div class="muted">实时同步中</div><div class="metric rolling-metric" id="m-last">-</div></div>
    </div>
    <div class="tools-card">
      <div class="toolbar compact">
      <input id="filter" class="tool-search" placeholder="搜索节点 ID / 名称 / 协议 / 权限组" oninput="renderTable()">
      <select id="typeFilter" onchange="renderTable()"><option value="">全部协议</option></select>
      <select id="nodeStatusFilter" onchange="renderTable()"><option value="">全部节点状态</option><option value="online">在线</option><option value="online_no_push">未上报</option><option value="offline">离线</option></select>
      <select id="syncStatusFilter" onchange="renderTable()"><option value="">全部同步状态</option><option value="normal">正常</option><option value="warning">异常</option><option value="blocked">已拦截</option></select>
      <label class="muted"><input id="includeHidden" type="checkbox" onchange="loadSummary()"> 显示隐藏节点</label>
      <label class="muted"><input id="autoRefresh" type="checkbox" checked onchange="resetAutoRefresh()"> 实时更新</label>
      </div>
    </div>
    <table class="node-table">
      <thead><tr><th>节点</th><th>协议</th><th>机器</th><th>权限组</th><th>同步用户</th><th>在线</th><th>连接</th><th>新增</th><th>移除</th><th>同步状态</th><th>同步时间</th><th>操作</th></tr></thead>
      <tbody id="rows"><tr><td colspan="12" class="muted">加载中...</td></tr></tbody>
    </table>
    <div class="panel">
      <div class="card detail-card">
        <div id="tab-users" class="tab-panel active">
        <h3 id="user-title">用户状态</h3>
        <div id="user-summary" class="muted">选择节点后展示用户状态。</div>
        <div class="mini-toolbar">
          <input id="userFilter" placeholder="搜索用户 ID / 邮箱 / UUID" oninput="renderUsers()">
          <select id="userStatusFilter" onchange="renderUsers()">
            <option value="">全部用户</option>
            <option value="online">在线</option>
            <option value="normal">正常</option>
            <option value="unavailable">不可用</option>
            <option value="synced">已同步</option>
            <option value="pending_sync">待同步</option>
            <option value="not_synced">未同步</option>
          </select>
        </div>
        <div class="table-wrap">
          <table class="data-table user-table">
            <thead><tr><th>ID</th><th>邮箱</th><th>内核</th><th>在线设备</th><th>状态</th><th>同步状态</th><th>到期</th><th>流量</th><th>操作</th></tr></thead>
            <tbody id="users"><tr><td colspan="9" class="table-message">还没有选择节点。</td></tr></tbody>
          </table>
        </div>
        </div>
      </div>
    </div>
    <div class="panel">
      <div class="card detail-card">
        <div id="tab-access" class="tab-panel">
        <h3 id="access-title">实时日志</h3>
        <div id="access-summary" class="muted">选择节点后展示节点实时访问日志。</div>
        <div class="mini-toolbar">
          <input id="accessFilter" placeholder="搜索邮箱 / 用户 IP / 访问网站" oninput="renderAccess()">
        </div>
        <div class="table-wrap">
          <table class="data-table access-table">
            <thead><tr><th>时间</th><th>ID</th><th>邮箱</th><th>用户 IP</th><th>协议</th><th>访问网站和端口</th><th>上传</th><th>下载</th><th>总计</th></tr></thead>
            <tbody id="access"><tr><td colspan="9" class="table-message">还没有选择节点。</td></tr></tbody>
          </table>
        </div>
        </div>
      </div>
    </div>
  </div>
  <script>
    const summaryUrl = __SUMMARY_URL__;
    const nodeUsersUrl = __NODE_USERS_URL__;
    const accessUrl = __ACCESS_URL__;
    const key = __KEY__;
    let snapshots = [];
    let currentUserPayload = null;
    let currentAccessPayload = null;
    let currentNodeId = 0;
    let refreshTimer = null;
    let refreshRunning = false;
    const fmtTime = ts => ts ? new Date(ts * 1000).toLocaleString() : '-';
    const pick = item => item.last_valid_snapshot || item.last_blocked_snapshot || {};
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    const fmtBytes = bytes => {
      bytes = Number(bytes || 0);
      if (bytes < 1024) return bytes + ' B';
      const units = ['KB','MB','GB','TB','PB'];
      let value = bytes / 1024;
      let index = 0;
      while (value >= 1024 && index < units.length - 1) { value /= 1024; index++; }
      return value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2) + ' ' + units[index];
    };

    function freshUrl(url) {
      return url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
    }

    function authToken() {
      try {
        const raw = localStorage.getItem('XBOARD_ACCESS_TOKEN');
        if (!raw) return '';
        const parsed = JSON.parse(raw);
        return parsed && parsed.value ? parsed.value : '';
      } catch (error) {
        return '';
      }
    }

    function switchTab(name) {
      ['users', 'access'].forEach(tab => {
        const panel = document.getElementById(`tab-${tab}`);
        const button = document.getElementById(`tab-btn-${tab}`);
        if (panel) panel.classList.toggle('active', tab === name);
        if (button) button.classList.toggle('active', tab === name);
      });
    }

    async function fetchJson(url) {
      const headers = {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      };
      const token = authToken();
      if (token) {
        headers.Authorization = token;
      }
      const res = await fetch(freshUrl(url), {
        cache: 'no-store',
        headers,
      });
      return [res, await res.json()];
    }

    function updateRollingMetric(id, text) {
      const el = document.getElementById(id);
      const next = String(text ?? '-');
      if (!el || el.dataset.value === next) return;
      const previous = el.dataset.value || '';
      el.dataset.value = next;
      const width = Math.max(previous.length, next.length);
      const oldText = previous.padStart(width, ' ');
      const newText = next.padStart(width, ' ');
      const charHtml = ch => esc(ch).replace(/ /g, '&nbsp;');
      if (!previous) {
        el.innerHTML = [...newText].map(ch => `<span class="roll-char static${/[0-9]/.test(ch) ? '' : ' wide'}"><span class="roll-new">${charHtml(ch)}</span></span>`).join('');
        return;
      }
      el.innerHTML = [...newText].map((ch, index) => {
        const oldCh = oldText[index] || ' ';
        const changed = oldCh !== ch;
        const wide = /[0-9]/.test(oldCh) || /[0-9]/.test(ch) ? '' : ' wide';
        return changed
          ? `<span class="roll-char changed${wide}"><span class="roll-old">${charHtml(oldCh)}</span><span class="roll-new">${charHtml(ch)}</span></span>`
          : `<span class="roll-char static${wide}"><span class="roll-new">${charHtml(ch)}</span></span>`;
      }).join('');
    }

    async function loadSummary() {
      const [res, json] = await fetchJson(summaryUrl + (document.getElementById('includeHidden').checked ? '&include_hidden=1' : ''));
      if (!res.ok) {
        document.getElementById('rows').innerHTML = '<tr><td colspan="12" class="bad">' + esc(json.message || '读取失败') + '</td></tr>';
        return;
      }
      snapshots = json.data || [];
      fillTypeFilter();
      renderTable();
    }

    async function refreshNow() {
      if (refreshRunning) return;
      refreshRunning = true;
      try {
        await loadSummary();
        if (currentNodeId > 0) {
          await Promise.all([loadNodeUsers(currentNodeId, true), loadNodeAccess(currentNodeId, true)]);
        }
      } catch (error) {
        updateRollingMetric('m-last', '同步失败');
        console.error(error);
      } finally {
        refreshRunning = false;
      }
    }

    function resetAutoRefresh() {
      if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
      }
      if (!document.getElementById('autoRefresh').checked) {
        return;
      }
      refreshTimer = setInterval(() => refreshNow(), 3000);
    }

    function fillTypeFilter() {
      const select = document.getElementById('typeFilter');
      const current = select.value;
      const types = [...new Set(snapshots.map(item => pick(item).node_type).filter(Boolean))].sort();
      select.innerHTML = '<option value="">全部协议</option>' + types.map(type => `<option value="${esc(type)}">${esc(type)}</option>`).join('');
      select.value = types.includes(current) ? current : '';
    }

    function groupText(s) {
      const names = Array.isArray(s.group_names) ? s.group_names.filter(Boolean) : [];
      if (names.length) {
        return names.join(',');
      }
      if (s.group_label) {
        return String(s.group_label);
      }
      const ids = Array.isArray(s.group_ids) ? s.group_ids : String(s.group_ids || '').split(',').filter(Boolean);
      return ids.length ? ids.join(',') : '-';
    }

    function renderTable() {
      const q = document.getElementById('filter').value.toLowerCase();
      const type = document.getElementById('typeFilter').value;
      const nodeStatus = document.getElementById('nodeStatusFilter').value;
      const syncStatus = document.getElementById('syncStatusFilter').value;
      const rows = snapshots.filter(item => {
        const s = pick(item);
        const abnormal = (s.abnormal || {}).detected;
        const currentSyncStatus = item.last_blocked_snapshot ? 'blocked' : abnormal ? 'warning' : 'normal';
        const groupLabel = groupText(s).toLowerCase();
        const matchedSearch = !q || String(s.node_id || '').includes(q) || String(s.node_name || '').toLowerCase().includes(q) || String(s.node_type || '').toLowerCase().includes(q) || groupLabel.includes(q);
        return matchedSearch && (!type || s.node_type === type) && (!nodeStatus || s.node_status === nodeStatus) && (!syncStatus || currentSyncStatus === syncStatus);
      });
      const totalUsers = rows.reduce((sum, item) => sum + Number(pick(item).fetched_users || 0), 0);
      const bad = rows.filter(item => (pick(item).abnormal || {}).detected || item.last_blocked_snapshot).length;
      const last = rows.reduce((max, item) => Math.max(max, Number(pick(item).synced_at || 0)), 0);
      updateRollingMetric('m-nodes', rows.length);
      updateRollingMetric('m-users', totalUsers);
      updateRollingMetric('m-bad', bad);
      updateRollingMetric('m-last', fmtTime(last));
      document.getElementById('rows').innerHTML = rows.map(item => {
        const s = pick(item);
        const abnormal = (s.abnormal || {}).detected;
        const status = item.last_blocked_snapshot ? '<span class="status-badge bad">已拦截</span>' : abnormal ? '<span class="status-badge warn">异常</span>' : '<span class="status-badge ok">正常</span>';
        const nodeId = Number(s.node_id || item.node_id);
        const groups = groupText(s);
        return `<tr><td class="name"><span class="mono">#${esc(nodeId)}</span> ${esc(s.node_name || '-')}</td><td><span class="tag">${esc(s.node_type || '-')}</span></td><td>${esc(s.machine_id || '-')}</td><td><span class="group-cell" title="${esc(groups)}">${esc(groups)}</span></td><td>${esc(s.fetched_users ?? '-')}</td><td>${esc(s.online_users ?? 0)}</td><td>${esc(s.online_connections ?? 0)}</td><td>${esc(s.added ?? '-')}</td><td>${esc(s.removed ?? '-')}</td><td>${status}</td><td>${esc(fmtTime(s.synced_at))}</td><td><button class="btn secondary small" onclick="loadNodeUsers(${nodeId})">查看用户</button></td></tr>`;
      }).join('') || '<tr><td colspan="12" class="muted">没有数据</td></tr>';
    }

    function nodeNameById(nodeId) {
      const item = snapshots.find(item => Number((pick(item).node_id || item.node_id)) === Number(nodeId));
      return item ? (pick(item).node_name || '') : '';
    }

    async function loadNodeUsers(nodeId, silent = false) {
      currentNodeId = Number(nodeId);
      const nodeName = nodeNameById(nodeId);
      document.getElementById('user-title').textContent = `用户状态 #${nodeId} ${nodeName || ''}`;
      if (!silent) {
        setUserMessage('加载中...');
      }
      const url = `${nodeUsersUrl}?node_id=${encodeURIComponent(nodeId)}&key=${encodeURIComponent(key)}`;
      const [res, json] = await fetchJson(url);
      if (!res.ok || !json.data) {
        setUserMessage(json.message || JSON.stringify(json), 'bad');
        return;
      }
      currentUserPayload = json.data;
      renderUsers();
      if (!silent) {
        document.getElementById('accessFilter').value = '';
        await loadNodeAccess(nodeId);
      }
    }

    function setUserMessage(message, cls = 'table-message') {
      document.getElementById('users').innerHTML = `<tr><td colspan="9" class="${esc(cls)}">${esc(message)}</td></tr>`;
    }

    function renderUsers() {
      if (!currentUserPayload) return;
      const data = currentUserPayload;
      const q = document.getElementById('userFilter').value.trim().toLowerCase();
      const status = document.getElementById('userStatusFilter').value;
      const users = (data.users || []).filter(user => {
        const matchedSearch = !q || String(user.id).includes(q) || String(user.xray_email || '').toLowerCase().includes(q) || String(user.email || '').toLowerCase().includes(q) || String(user.uuid || '').toLowerCase().includes(q);
        const matchedStatus = !status
          || (status === 'online' && user.online)
          || (status === 'normal' && user.available_now)
          || (status === 'unavailable' && !user.available_now)
          || (status === 'synced' && user.included_in_last_sync === true)
          || (status === 'pending_sync' && user.included_in_current_sync === true && user.included_in_last_sync !== true)
          || (status === 'not_synced' && user.included_in_current_sync === false);
        return matchedSearch && matchedStatus;
      });
      const pendingSync = (data.users || []).filter(user => user.included_in_current_sync === true && user.included_in_last_sync !== true).length;
      document.getElementById('user-summary').textContent = `当前 ${users.length} / 总数 ${data.summary.total}，在线 ${data.summary.online}，正常 ${data.summary.current_sync}，不可用 ${data.summary.unavailable}，已同步 ${data.summary.synced}，待同步 ${pendingSync}，未同步 ${data.summary.not_current_sync}`;
      if (users.length === 0) {
        setUserMessage('没有匹配的用户。');
        return;
      }
      document.getElementById('users').innerHTML = users.map(user => {
        const onlineClass = user.online ? 'online' : '';
        const deviceLimit = user.device_limit || user.deviceLimit || '∞';
        const statusClass = user.available_now ? 'ok' : 'bad';
        const statusText = user.available_now ? (user.online ? '在线' : '正常') : (user.reason_label || '不可用');
        let syncText = '未知';
        let syncClass = 'muted-pill';
        if (user.included_in_last_sync === true) {
          syncText = '已同步';
          syncClass = 'ok';
        } else if (user.included_in_current_sync === true) {
          syncText = '待同步';
          syncClass = 'wait';
        } else if (user.included_in_current_sync === false) {
          syncText = '未同步';
        }
        const kernel = user.kernel || (data.node && data.node.kernel) || '-';
        const deviceTitle = user.node_devices_inferred
          ? (user.node_devices_source === 'connection' ? '由节点连接数推断' : '由最近 60 秒实时日志推断')
          : '由节点设备明细上报';
        return `<tr><td><span class="id-pill">${esc(user.id)}</span></td><td><span class="user-cell"><span class="status-dot ${onlineClass}"></span>${esc(user.email || '-')}</span></td><td><span class="tag">${esc(kernel)}</span></td><td><span class="count-pill" title="${esc(deviceTitle)}">${esc(user.node_devices ?? 0)} / ${esc(deviceLimit)}</span></td><td><span class="status-pill ${statusClass}">${esc(statusText)}</span></td><td><span class="sync-pill ${syncClass}">${esc(syncText)}</span></td><td class="mono">${esc(user.expired_at_text || '-')}</td><td class="mono">${esc(fmtBytes(user.used_traffic))} / ${esc(fmtBytes(user.transfer_enable))}</td><td class="row-action"><button class="btn secondary small" data-user-id="${esc(user.id)}" data-email="${esc(user.email || '')}" onclick="viewUserAccess(this.dataset.userId, this.dataset.email)">实时日志</button></td></tr>`;
      }).join('');
    }

    async function viewUserAccess(userId, email) {
      if (!currentNodeId) return;
      const filter = String(email || userId || '').trim();
      document.getElementById('accessFilter').value = filter;
      setAccessMessage('加载中...');
      await loadNodeAccess(currentNodeId, true);
      document.getElementById('access-title').textContent = `实时日志 #${currentNodeId} ${nodeNameById(currentNodeId) || ''} ${filter ? '｜' + filter : ''}`;
      document.getElementById('tab-access').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function loadNodeAccess(nodeId, silent = false) {
      currentNodeId = Number(nodeId);
      const nodeName = nodeNameById(nodeId);
      document.getElementById('access-title').textContent = `实时日志 #${nodeId} ${nodeName || ''}`;
      if (!silent) {
        setAccessMessage('加载中...');
      }
      const url = `${accessUrl}?node_id=${encodeURIComponent(nodeId)}&key=${encodeURIComponent(key)}&limit=100`;
      const [res, json] = await fetchJson(url);
      if (!res.ok || !json.data) {
        setAccessMessage(json.message || JSON.stringify(json), 'bad');
        return;
      }
      currentAccessPayload = json.data;
      renderAccess();
    }

    function accessTarget(row) {
      const raw = String(row.destination || '').trim();
      let protocol = String(row.network || '').trim().toLowerCase();
      let target = raw;
      const matched = raw.match(/^([a-z0-9+.-]+):(.+)$/i);
      if (matched && ['tcp', 'udp', 'quic'].includes(matched[1].toLowerCase())) {
        protocol = protocol || matched[1].toLowerCase();
        target = matched[2];
      }
      return {
        protocol: protocol || '-',
        target: target || '-',
      };
    }

    function setAccessMessage(message, cls = 'table-message') {
      document.getElementById('access').innerHTML = `<tr><td colspan="9" class="${esc(cls)}">${esc(message)}</td></tr>`;
    }

    function renderAccess() {
      if (!currentAccessPayload) return;
      const q = document.getElementById('accessFilter').value.trim().toLowerCase();
      const rows = (currentAccessPayload.access || []).filter(row => {
        const target = accessTarget(row);
        return !q
          || String(row.user_id || '').includes(q)
          || String(row.email || '').toLowerCase().includes(q)
          || String(row.xray_email || '').toLowerCase().includes(q)
          || String(row.source || '').toLowerCase().includes(q)
          || String(target.protocol || '').toLowerCase().includes(q)
          || String(target.target || '').toLowerCase().includes(q)
          || String(row.destination || '').toLowerCase().includes(q);
      });
      document.getElementById('access-summary').textContent = `当前 ${rows.length} / 最近 ${currentAccessPayload.total} 条，数据来自节点上报的实时访问日志`;
      if (rows.length === 0) {
        const hasRecords = (currentAccessPayload.access || []).length > 0;
        setAccessMessage(hasRecords ? '没有匹配的访问记录。' : '暂无访问记录。需要节点端升级到支持 access 上报的版本，并等待下一次 report。');
        return;
      }
      document.getElementById('access').innerHTML = rows.map(row => {
        const target = accessTarget(row);
        const upload = Number(row.upload || 0);
        const download = Number(row.download || 0);
        const total = Number(row.total || (upload + download));
        return `<tr><td class="mono">${esc(fmtTime(row.timestamp))}</td><td><span class="id-pill">${esc(row.user_id || '-')}</span></td><td class="email"><span class="user-cell"><span class="status-dot online"></span>${esc(row.email || '-')}</span></td><td class="mono ip">${esc(row.source || '-')}</td><td><span class="tag">${esc(target.protocol)}</span></td><td class="target mono">${esc(target.target)}</td><td class="mono traffic">${esc(fmtBytes(upload))}</td><td class="mono traffic">${esc(fmtBytes(download))}</td><td class="mono traffic">${esc(fmtBytes(total))}</td></tr>`;
      }).join('');
    }

    refreshNow();
    resetAutoRefresh();
  </script>
</body>
</html>
HTML;

        return str_replace(
            ['__SUMMARY_URL__', '__NODE_USERS_URL__', '__ACCESS_URL__', '__KEY__'],
            [$summaryUrl, $nodeUsersUrl, $accessUrl, $keyJson],
            $html
        );
    }
}
