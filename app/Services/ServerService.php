<?php

namespace App\Services;

use App\Models\Server;
use App\Models\ServerMachine;
use App\Models\ServerRoute;
use App\Models\User;
use App\Services\Plugin\HookManager;
use App\Utils\CacheKey;
use App\Utils\Helper;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Collection;

class ServerService
{

    /**
     * 获取所有服务器列表
     * @return Collection
     */
    public static function getAllServers(): Collection
    {
        $query = Server::orderBy('sort', 'ASC');

        return $query->get()->append([
            'last_check_at',
            'last_push_at',
            'online',
            'is_online',
            'available_status',
            'cache_key',
            'load_status',
            'metrics',
            'online_conn'
        ]);
    }

    /**
     * 获取机器下所有已启用节点
     */
    public static function getMachineNodes(ServerMachine $machine): Collection
    {
        return Server::where('machine_id', $machine->id)
            ->where('enabled', true)
            ->orderBy('sort', 'ASC')
            ->get();
    }

    /**
     * 获取指定用户可用的服务器列表
     * @param User $user
     * @return array
     */
    public static function getAvailableServers(User $user): array
    {
        $groupId = (int) $user->group_id;
        if ($groupId <= 0) {
            return [];
        }

        $servers = self::whereGroupIdsContain(Server::query(), $groupId)
            ->where('show', true)
            ->where(function ($query) {
                $query->whereNull('transfer_enable')
                    ->orWhere('transfer_enable', 0)
                    ->orWhereRaw('u + d < transfer_enable');
            })
            ->orderBy('sort', 'ASC')
            ->get()
            ->append(['last_check_at', 'last_push_at', 'online', 'is_online', 'available_status', 'cache_key', 'server_key']);

        $servers = collect($servers)->map(function ($server) use ($user) {
            // 判断动态端口
            if (str_contains($server->port, '-')) {
                $port = $server->port;
                $server->port = (int) Helper::randomPort($port);
                $server->ports = $port;
            } else {
                $server->port = (int) $server->port;
            }
            $server->password = $server->generateServerPassword($user);
            $server->rate = $server->getCurrentRate();
            return $server;
        })->toArray();

        return $servers;
    }

    /**
     * 根据权限组获取可用的用户列表
     * @param array $groupIds
     * @return Collection
     */
    public static function getAvailableUsers(Server $node)
    {
        $groupIds = self::normalizeGroupIds($node->group_ids);
        if (empty($groupIds)) {
            return collect();
        }
        $users = User::toBase()
            ->whereIn('group_id', $groupIds)
            ->whereRaw('u + d < transfer_enable')
            ->where(function ($query) {
                $query->where('expired_at', '>=', time())
                    ->orWhere('expired_at', NULL);
            })
            ->where('banned', 0)
            ->select([
                'id',
                'uuid',
                'speed_limit',
                'device_limit'
            ])
            ->get();
        return HookManager::filter('server.users.get', $users, $node);
    }

    public static function whereGroupIdsContain(Builder $query, int|string|null $groupId): Builder
    {
        $groupId = (int) $groupId;
        if ($groupId <= 0) {
            return $query->whereRaw('1 = 0');
        }

        return $query->where(function (Builder $query) use ($groupId) {
            $query->whereJsonContains('group_ids', $groupId)
                ->orWhereJsonContains('group_ids', (string) $groupId);
        });
    }

    public static function logUserSyncSnapshot(Server $node, int $returnedCount): array
    {
        $groupIds = self::normalizeGroupIds($node->group_ids);
        if (empty($groupIds)) {
            Log::warning('server user sync snapshot: node has no groups', [
                'node_id' => $node->id,
                'node_name' => $node->name,
                'returned_users' => $returnedCount,
            ]);
            return [
                'group_ids' => [],
                'group_users' => 0,
                'available_users' => 0,
                'returned_users' => $returnedCount,
                'excluded_banned' => 0,
                'excluded_expired' => 0,
                'excluded_traffic' => 0,
            ];
        }

        $baseQuery = User::query()->whereIn('group_id', $groupIds);
        $activeQuery = fn() => User::query()
            ->whereIn('group_id', $groupIds)
            ->where('banned', 0)
            ->where(function ($query) {
                $query->where('expired_at', '>=', time())
                    ->orWhereNull('expired_at');
            });

        $groupUsers = (clone $baseQuery)->count();
        $bannedUsers = (clone $baseQuery)->where('banned', 1)->count();
        $expiredUsers = (clone $baseQuery)
            ->where('banned', 0)
            ->whereNotNull('expired_at')
            ->where('expired_at', '<', time())
            ->count();
        $trafficExceededUsers = $activeQuery()
            ->whereRaw('u + d >= transfer_enable')
            ->count();
        $availableUsers = $activeQuery()
            ->whereRaw('u + d < transfer_enable')
            ->count();

        $snapshot = [
            'node_id' => $node->id,
            'node_name' => $node->name,
            'node_type' => $node->type,
            'group_ids' => $groupIds,
            'group_users' => $groupUsers,
            'available_users' => $availableUsers,
            'returned_users' => $returnedCount,
            'excluded_banned' => $bannedUsers,
            'excluded_expired' => $expiredUsers,
            'excluded_traffic' => $trafficExceededUsers,
        ];

        Log::info('server user sync snapshot', $snapshot);

        return $snapshot;
    }

    public static function getNodeUserDebugHeaders(Server $node, ?string $uuid): array
    {
        $uuid = trim((string) $uuid);
        if ($uuid === '') {
            return [];
        }

        $groupIds = self::normalizeGroupIds($node->group_ids);
        $user = User::query()
            ->where('uuid', $uuid)
            ->first(['id', 'uuid', 'group_id', 'plan_id', 'banned', 'expired_at', 'transfer_enable', 'u', 'd']);

        if (!$user) {
            return [
                'X-Debug-User-Found' => '0',
                'X-Debug-User-Reason' => 'not_found',
            ];
        }

        $usedTraffic = (int) $user->u + (int) $user->d;
        $transferEnable = (int) $user->transfer_enable;
        $inNodeGroups = in_array((int) $user->group_id, $groupIds, true);
        $banned = (bool) $user->banned;
        $expired = $user->expired_at !== null && (int) $user->expired_at < time();
        $trafficExceeded = $transferEnable <= 0 || $usedTraffic >= $transferEnable;
        $availableForNode = $inNodeGroups && !$banned && !$expired && !$trafficExceeded;

        $reason = 'ok';
        if (!$inNodeGroups) {
            $reason = 'group_mismatch';
        } elseif ($banned) {
            $reason = 'banned';
        } elseif ($expired) {
            $reason = 'expired';
        } elseif ($trafficExceeded) {
            $reason = 'traffic_exceeded';
        }

        return [
            'X-Debug-User-Found' => '1',
            'X-Debug-User-Id' => (string) $user->id,
            'X-Debug-User-Group' => (string) ($user->group_id ?? ''),
            'X-Debug-User-Plan' => (string) ($user->plan_id ?? ''),
            'X-Debug-User-In-Node-Groups' => $inNodeGroups ? '1' : '0',
            'X-Debug-User-Banned' => $banned ? '1' : '0',
            'X-Debug-User-Expired' => $expired ? '1' : '0',
            'X-Debug-User-Traffic-Exceeded' => $trafficExceeded ? '1' : '0',
            'X-Debug-User-Available' => $availableForNode ? '1' : '0',
            'X-Debug-User-Reason' => $reason,
        ];
    }

    private static function normalizeGroupIds(mixed $groupIds): array
    {
        if (is_string($groupIds)) {
            $decoded = json_decode($groupIds, true);
            $groupIds = is_array($decoded) ? $decoded : [$groupIds];
        }
        if (!is_array($groupIds)) {
            $groupIds = [];
        }

        return collect($groupIds)
            ->filter(fn($groupId) => $groupId !== null && $groupId !== '')
            ->map(fn($groupId) => (int) $groupId)
            ->filter(fn(int $groupId) => $groupId > 0)
            ->unique()
            ->values()
            ->all();
    }

    // 获取路由规则
    public static function getRoutes(array $routeIds)
    {
        $routes = ServerRoute::select(['id', 'match', 'action', 'action_value'])->whereIn('id', $routeIds)->get();
        return $routes;
    }

    /**
     * 处理节点流量数据汇报
     */
    public static function processTraffic(Server $node, array $traffic): void
    {
        $data = array_filter($traffic, fn($item) =>
            is_array($item) && count($item) === 2
            && is_numeric($item[0]) && is_numeric($item[1])
        );

        if (empty($data)) {
            return;
        }

        $nodeType = strtoupper($node->type);
        $nodeId = $node->id;

        Cache::put(CacheKey::get("SERVER_{$nodeType}_ONLINE_USER", $nodeId), count($data), 3600);
        Cache::put(CacheKey::get("SERVER_{$nodeType}_LAST_PUSH_AT", $nodeId), time(), 3600);

        (new UserService())->trafficFetch($node, $node->type, $data);
    }

    /**
     * 处理节点在线设备汇报
     */
    public static function processAlive(int $nodeId, array $alive): void
    {
        $service = app(DeviceStateService::class);
        foreach ($alive as $uid => $ips) {
            $service->setDevices((int) $uid, $nodeId, (array) $ips);
        }
    }

    /**
     * 处理节点连接数汇报
     */
    public static function processOnline(Server $node, array $online): void
    {
        $cacheTime = max(300, (int) admin_setting('server_push_interval', 60) * 3);
        $nodeType = $node->type;
        $nodeId = $node->id;

        foreach ($online as $uid => $conn) {
            $cacheKey = CacheKey::get("USER_ONLINE_CONN_{$nodeType}_{$nodeId}", $uid);
            Cache::put($cacheKey, (int) $conn, $cacheTime);
        }
    }

    /**
     * 处理节点最近访问记录，仅用于实时诊断看板。
     */
    public static function processAccess(Server $node, array $access): void
    {
        $rows = [];
        foreach (array_slice($access, -100) as $item) {
            if (!is_array($item)) {
                continue;
            }
            $userId = (int) ($item['user_id'] ?? 0);
            $destination = trim((string) ($item['destination'] ?? ''));
            if ($userId <= 0 || $destination === '') {
                continue;
            }
            $rows[] = [
                'session_id' => trim((string) ($item['session_id'] ?? '')),
                'user_id' => $userId,
                'xray_email' => trim((string) ($item['xray_email'] ?? ('user@' . $userId))),
                'source' => trim((string) ($item['source'] ?? '')),
                'network' => trim((string) ($item['network'] ?? '')),
                'destination' => $destination,
                'timestamp' => (int) ($item['timestamp'] ?? time()),
                'upload' => max(0, (int) ($item['upload'] ?? 0)),
                'download' => max(0, (int) ($item['download'] ?? 0)),
            ];
        }
        if (empty($rows)) {
            return;
        }

        $nodeType = strtoupper($node->type);
        $nodeId = $node->id;
        $cacheKey = CacheKey::get("SERVER_{$nodeType}_ACCESS_LOG", $nodeId);
        $existing = Cache::get($cacheKey, []);
        if (!is_array($existing)) {
            $existing = [];
        }

        $merged = array_values($existing);
        $sessionIndex = [];
        foreach ($merged as $index => $row) {
            if (!is_array($row)) {
                unset($merged[$index]);
                continue;
            }
            $sessionId = trim((string) ($row['session_id'] ?? ''));
            if ($sessionId !== '') {
                $sessionIndex[$sessionId] = $index;
            }
        }
        $merged = array_values($merged);
        $sessionIndex = [];
        foreach ($merged as $index => $row) {
            $sessionId = trim((string) ($row['session_id'] ?? ''));
            if ($sessionId !== '') {
                $sessionIndex[$sessionId] = $index;
            }
        }

        foreach ($rows as $row) {
            $sessionId = $row['session_id'];
            if ($sessionId !== '' && isset($sessionIndex[$sessionId])) {
                $index = $sessionIndex[$sessionId];
                $merged[$index] = array_merge($merged[$index], $row);
                continue;
            }

            if ($sessionId !== '') {
                $sessionIndex[$sessionId] = count($merged);
            }
            $merged[] = $row;
        }

        $merged = array_values(array_slice($merged, -200));
        Cache::put($cacheKey, $merged, max(300, (int) admin_setting('server_push_interval', 60) * 5));
    }

    /**
     * 处理节点负载状态汇报
     */
    public static function processStatus(Server $node, array $status): void
    {
        $nodeType = strtoupper($node->type);
        $nodeId = $node->id;

        $statusData = [
            'cpu' => (float) ($status['cpu'] ?? 0),
            'mem' => [
                'total' => (int) ($status['mem']['total'] ?? 0),
                'used' => (int) ($status['mem']['used'] ?? 0),
            ],
            'swap' => [
                'total' => (int) ($status['swap']['total'] ?? 0),
                'used' => (int) ($status['swap']['used'] ?? 0),
            ],
            'disk' => [
                'total' => (int) ($status['disk']['total'] ?? 0),
                'used' => (int) ($status['disk']['used'] ?? 0),
            ],
            'updated_at' => now()->timestamp,
            'kernel_status' => $status['kernel_status'] ?? null,
            'kernel' => $status['kernel'] ?? null,
            'kernel_type' => $status['kernel_type'] ?? null,
            'effective_kernel' => $status['effective_kernel'] ?? null,
            'configured_kernel' => $status['configured_kernel'] ?? null,
        ];

        $cacheTime = max(300, (int) admin_setting('server_push_interval', 60) * 3);
        cache([
            CacheKey::get("SERVER_{$nodeType}_LOAD_STATUS", $nodeId) => $statusData,
            CacheKey::get("SERVER_{$nodeType}_LAST_LOAD_AT", $nodeId) => now()->timestamp,
        ], $cacheTime);
    }

    /**
     * 标记节点心跳
     */
    public static function touchNode(Server $node): void
    {
        Cache::put(
            CacheKey::get('SERVER_' . strtoupper($node->type) . '_LAST_CHECK_AT', $node->id),
            time(),
            3600
        );
    }

    /**
     * Update node metrics and load status
     */
    public static function updateMetrics(Server $node, array $metrics): void
    {
        $nodeType = strtoupper($node->type);
        $nodeId = $node->id;
        $cacheTime = max(300, (int) admin_setting('server_push_interval', 60) * 3);

        $metricsData = [
            'uptime' => (int) ($metrics['uptime'] ?? 0),
            'goroutines' => (int) ($metrics['goroutines'] ?? 0),
            'active_connections' => (int) ($metrics['active_connections'] ?? 0),
            'total_connections' => (int) ($metrics['total_connections'] ?? 0),
            'total_users' => (int) ($metrics['total_users'] ?? 0),
            'active_users' => (int) ($metrics['active_users'] ?? 0),
            'inbound_speed' => (int) ($metrics['inbound_speed'] ?? 0),
            'outbound_speed' => (int) ($metrics['outbound_speed'] ?? 0),
            'cpu_per_core' => $metrics['cpu_per_core'] ?? [],
            'load' => $metrics['load'] ?? [],
            'speed_limiter' => $metrics['speed_limiter'] ?? [],
            'gc' => $metrics['gc'] ?? [],
            'api' => $metrics['api'] ?? [],
            'ws' => $metrics['ws'] ?? [],
            'limits' => $metrics['limits'] ?? [],
            'updated_at' => now()->timestamp,
            'kernel_status' => (bool) ($metrics['kernel_status'] ?? false),
            'kernel' => $metrics['kernel'] ?? null,
            'kernel_type' => $metrics['kernel_type'] ?? null,
            'effective_kernel' => $metrics['effective_kernel'] ?? null,
            'configured_kernel' => $metrics['configured_kernel'] ?? null,
        ];

        Cache::put(
            CacheKey::get('SERVER_' . $nodeType . '_METRICS', $nodeId),
            $metricsData,
            $cacheTime
        );
    }

    public static function buildNodeConfig(Server $node): array
    {
        $nodeType = $node->type;
        $protocolSettings = $node->protocol_settings;
        $serverPort = $node->server_port;
        $host = $node->host;

        $baseConfig = [
            'protocol' => $nodeType,
            'listen_ip' => '0.0.0.0',
            'server_port' => (int) $serverPort,
            'network' => data_get($protocolSettings, 'network'),
            'networkSettings' => data_get($protocolSettings, 'network_settings') ?: null,
        ];

        $response = match ($nodeType) {
            'shadowsocks' => [
                ...$baseConfig,
                'cipher' => $protocolSettings['cipher'],
                'plugin' => $protocolSettings['plugin'],
                'plugin_opts' => $protocolSettings['plugin_opts'],
                'server_key' => match ($protocolSettings['cipher']) {
                        '2022-blake3-aes-128-gcm' => Helper::getServerKey($node->created_at, 16),
                        '2022-blake3-aes-256-gcm' => Helper::getServerKey($node->created_at, 32),
                        default => null,
                    },
            ],
            'vmess' => [
                ...$baseConfig,
                'tls' => (int) $protocolSettings['tls'],
                'tls_settings' => $protocolSettings['tls_settings'],
                'multiplex' => data_get($protocolSettings, 'multiplex'),
            ],
            'trojan' => [
                ...$baseConfig,
                'host' => $host,
                'server_name' => data_get($protocolSettings, 'tls_settings.server_name'),
                'multiplex' => data_get($protocolSettings, 'multiplex'),
                'tls' => (int) $protocolSettings['tls'],
                'tls_settings' => match ((int) $protocolSettings['tls']) {
                        2 => $protocolSettings['reality_settings'],
                        default => $protocolSettings['tls_settings'],
                    },
            ],
            'vless' => [
                ...$baseConfig,
                'tls' => (int) $protocolSettings['tls'],
                'flow' => $protocolSettings['flow'],
                'decryption' => match (data_get($protocolSettings, 'encryption.enabled')) {
                    true => data_get($protocolSettings, 'encryption.decryption'),
                    default => null,
                },
                'tls_settings' => match ((int) $protocolSettings['tls']) {
                        2 => $protocolSettings['reality_settings'],
                        default => $protocolSettings['tls_settings'],
                    },
                'multiplex' => data_get($protocolSettings, 'multiplex'),
            ],
            'hysteria' => [
                ...$baseConfig,
                'server_port' => (int) $serverPort,
                'version' => (int) $protocolSettings['version'],
                'host' => $host,
                'server_name' => $protocolSettings['tls']['server_name'],
                'tls_settings' => $protocolSettings['tls'],
                'up_mbps' => (int) $protocolSettings['bandwidth']['up'],
                'down_mbps' => (int) $protocolSettings['bandwidth']['down'],
                ...match ((int) $protocolSettings['version']) {
                        1 => ['obfs' => $protocolSettings['obfs']['password'] ?? null],
                        2 => [
                            'obfs' => $protocolSettings['obfs']['open'] ? $protocolSettings['obfs']['type'] : null,
                            'obfs-password' => $protocolSettings['obfs']['password'] ?? null,
                        ],
                        default => [],
                    },
            ],
            'tuic' => [
                ...$baseConfig,
                'version' => (int) $protocolSettings['version'],
                'server_port' => (int) $serverPort,
                'server_name' => $protocolSettings['tls']['server_name'],
                'congestion_control' => $protocolSettings['congestion_control'],
                'tls_settings' => $protocolSettings['tls'],
                'auth_timeout' => '3s',
                'zero_rtt_handshake' => false,
                'heartbeat' => '3s',
            ],
            'anytls' => [
                ...$baseConfig,
                'server_port' => (int) $serverPort,
                'server_name' => $protocolSettings['tls']['server_name'],
                'tls_settings' => $protocolSettings['tls'],
                'padding_scheme' => $protocolSettings['padding_scheme'],
            ],
            'socks' => [
                ...$baseConfig,
                'server_port' => (int) $serverPort,
                'tls' => (int) data_get($protocolSettings, 'tls', 0),
                'tls_settings' => data_get($protocolSettings, 'tls_settings'),
            ],
            'naive' => [
                ...$baseConfig,
                'server_port' => (int) $serverPort,
                'tls' => (int) $protocolSettings['tls'],
                'tls_settings' => $protocolSettings['tls_settings'],
            ],
            'http' => [
                ...$baseConfig,
                'server_port' => (int) $serverPort,
                'tls' => (int) $protocolSettings['tls'],
                'tls_settings' => $protocolSettings['tls_settings'],
            ],
            'mieru' => [
                ...$baseConfig,
                'server_port' => (int) $serverPort,
                'transport' => data_get($protocolSettings, 'transport', 'TCP'),
                'traffic_pattern' => $protocolSettings['traffic_pattern'],
            ],
            default => [],
        };

        if (!empty($node['route_ids'])) {
            $response['routes'] = self::getRoutes($node['route_ids']);
        }

        if (!empty($node['custom_outbounds'])) {
            $response['custom_outbounds'] = $node['custom_outbounds'];
        }

        if (!empty($node['custom_routes'])) {
            $response['custom_routes'] = $node['custom_routes'];
        }

        if (!empty($node['cert_config'])) {
            $certConfig = $node['cert_config'];
            // Normalize: accept both "mode" and "cert_mode" from the database
            if (isset($certConfig['mode']) && !isset($certConfig['cert_mode'])) {
                $certConfig['cert_mode'] = $certConfig['mode'];
                unset($certConfig['mode']);
            }
            if (data_get($certConfig, 'cert_mode') !== 'none') {
                $response['cert_config'] = $certConfig;
            }
        }

        return $response;
    }

    /**
     * 根据协议类型和标识获取服务器
     * @param int $serverId
     * @param string $serverType
     * @return Server|null
     */
    public static function getServer($serverId, ?string $serverType = null): Server | null
    {
        return Server::query()
            ->when($serverType, function ($query) use ($serverType) {
                $query->where('type', Server::normalizeType($serverType));
            })
            ->where(function ($query) use ($serverId) {
                $query->where('code', $serverId)
                    ->orWhere('id', $serverId);
            })
            ->orderByRaw('CASE WHEN code = ? THEN 0 ELSE 1 END', [$serverId])
            ->first();
    }
}
