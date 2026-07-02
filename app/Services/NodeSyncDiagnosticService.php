<?php

namespace App\Services;

use App\Models\Server;
use App\Models\Plugin as PluginModel;
use App\Models\User;
use App\Services\Plugin\HookManager;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class NodeSyncDiagnosticService
{
    public const SNAPSHOT_PREFIX = 'plugin:node_sync_diagnostic:snapshot:';
    public const BLOCKED_PREFIX = 'plugin:node_sync_diagnostic:blocked:';
    public const NODE_INDEX_KEY = 'plugin:node_sync_diagnostic:nodes';

    private array $config = [];
    private bool $configLoaded = false;

    public function boot(): void
    {
        static $booted = false;
        if ($booted) {
            return;
        }
        $booted = true;

        HookManager::registerFilter('server.users.get', function ($users, $node) {
            if (!$node instanceof Server) {
                return $users;
            }

            if (!$users instanceof Collection) {
                $users = collect($users);
            }

            if ($this->toBool($this->getConfig('only_user_endpoint', true)) && !$this->isUserSyncEndpoint()) {
                return $users;
            }

            $snapshot = $this->buildSnapshot($users, $node);
            $previous = Cache::get(self::SNAPSHOT_PREFIX . $node->id);
            $diff = $this->diffSnapshots($snapshot, is_array($previous) ? $previous : null);
            $diagnostic = array_merge($snapshot, $diff);
            $diagnostic['abnormal'] = $this->detectAbnormal($diagnostic, is_array($previous) ? $previous : null);
            $shouldBlock = $diagnostic['abnormal']['detected']
                && $this->toBool($this->getConfig('block_abnormal_sync', false))
                && $this->isUserSyncEndpoint();

            if ($shouldBlock) {
                $this->rememberBlockedSnapshot($node->id, $diagnostic);
            } else {
                $this->rememberSnapshot($node->id, $diagnostic);
            }

            if ($this->toBool($this->getConfig('enable_sync_log', true))) {
                $context = $this->logContext($diagnostic);
                if ($diagnostic['abnormal']['detected']) {
                    Log::warning('node sync diagnostic: abnormal user sync snapshot', $context);
                } else {
                    Log::info('node sync diagnostic: user sync snapshot', $context);
                }
            }

            if ($shouldBlock) {
                Log::error('node sync diagnostic: blocked abnormal user sync response', $this->logContext($diagnostic));
                HookManager::intercept(response()->json([
                    'message' => 'abnormal user sync snapshot blocked by NodeSyncDiagnostic',
                    'diagnostic' => $diagnostic['abnormal'],
                ], 503));
            }

            return $users;
        }, 100);
    }

    private function buildSnapshot(Collection $users, Server $node): array
    {
        $groupIds = self::normalizeGroupIds($node->group_ids);
        $returnedCount = $users->count();
        $uuids = $this->extractUuids($users);

        $groupUsers = 0;
        $availableUsers = 0;
        $excludedBanned = 0;
        $excludedExpired = 0;
        $excludedTraffic = 0;

        if (!empty($groupIds)) {
            $baseQuery = User::query()->whereIn('group_id', $groupIds);
            $activeQuery = fn() => User::query()
                ->whereIn('group_id', $groupIds)
                ->where('banned', 0)
                ->where(function ($query) {
                    $query->where('expired_at', '>=', time())
                        ->orWhereNull('expired_at');
                });

            $groupUsers = (clone $baseQuery)->count();
            $excludedBanned = (clone $baseQuery)->where('banned', 1)->count();
            $excludedExpired = (clone $baseQuery)
                ->where('banned', 0)
                ->whereNotNull('expired_at')
                ->where('expired_at', '<', time())
                ->count();
            $excludedTraffic = $activeQuery()
                ->whereRaw('u + d >= transfer_enable')
                ->count();
            $availableUsers = $activeQuery()
                ->whereRaw('u + d < transfer_enable')
                ->count();
        }

        return [
            'node_id' => (int) $node->id,
            'node_name' => (string) $node->name,
            'node_type' => (string) $node->type,
            'machine_id' => $node->machine_id ? (int) $node->machine_id : null,
            'group_ids' => $groupIds,
            'group_users' => $groupUsers,
            'available_users' => $availableUsers,
            'fetched_users' => $returnedCount,
            'returned_users' => $returnedCount,
            'excluded_banned' => $excludedBanned,
            'excluded_expired' => $excludedExpired,
            'excluded_traffic' => $excludedTraffic,
            'uuids' => $this->shouldCacheUuids($returnedCount) ? $uuids : null,
            'uuid_cache_enabled' => $this->shouldCacheUuids($returnedCount),
            'synced_at' => time(),
            'request_path' => $this->requestPath(),
        ];
    }

    private function diffSnapshots(array $current, ?array $previous): array
    {
        $previousCount = $previous['fetched_users'] ?? null;
        $added = null;
        $removed = null;
        $addedSamples = [];
        $removedSamples = [];

        if (is_array($previous['uuids'] ?? null) && is_array($current['uuids'] ?? null)) {
            $currentUuids = array_values(array_unique($current['uuids']));
            $previousUuids = array_values(array_unique($previous['uuids']));
            $addedUuids = array_values(array_diff($currentUuids, $previousUuids));
            $removedUuids = array_values(array_diff($previousUuids, $currentUuids));

            $added = count($addedUuids);
            $removed = count($removedUuids);
            $addedSamples = array_slice($addedUuids, 0, 10);
            $removedSamples = array_slice($removedUuids, 0, 10);
        } elseif ($previousCount === null) {
            $added = 0;
            $removed = 0;
        }

        return [
            'previous_users' => $previousCount,
            'added' => $added,
            'removed' => $removed,
            'added_samples' => $addedSamples,
            'removed_samples' => $removedSamples,
            'bootstrap' => $previousCount === null,
        ];
    }

    private function detectAbnormal(array $current, ?array $previous): array
    {
        $reasons = [];
        $previousCount = (int) ($previous['fetched_users'] ?? 0);
        $currentCount = (int) $current['fetched_users'];
        $minimumExpected = max(0, (int) $this->getConfig('minimum_expected_users', 0));
        $dropPercentLimit = max(0, (float) $this->getConfig('abnormal_drop_percent', 30));

        if ($minimumExpected > 0 && $currentCount < $minimumExpected) {
            $reasons[] = "fetched_users {$currentCount} below minimum_expected_users {$minimumExpected}";
        }

        if ($previousCount > 0 && $dropPercentLimit > 0 && $currentCount < $previousCount) {
            $dropPercent = round((($previousCount - $currentCount) / $previousCount) * 100, 2);
            if ($dropPercent >= $dropPercentLimit) {
                $reasons[] = "fetched_users dropped {$dropPercent}% from {$previousCount} to {$currentCount}";
            }
        }

        if ($current['available_users'] !== $current['fetched_users']) {
            $reasons[] = "available_users {$current['available_users']} differs from returned users {$current['fetched_users']}";
        }

        return [
            'detected' => !empty($reasons),
            'reasons' => $reasons,
        ];
    }

    private function rememberSnapshot(int $nodeId, array $snapshot): void
    {
        $ttl = now()->addDays(3);
        Cache::put(self::SNAPSHOT_PREFIX . $nodeId, $snapshot, $ttl);
        $this->rememberNodeIndex($nodeId, $ttl);
    }

    private function rememberBlockedSnapshot(int $nodeId, array $snapshot): void
    {
        $ttl = now()->addDays(3);
        Cache::put(self::BLOCKED_PREFIX . $nodeId, $snapshot, $ttl);
        $this->rememberNodeIndex($nodeId, $ttl);
    }

    private function rememberNodeIndex(int $nodeId, \DateTimeInterface $ttl): void
    {
        $nodeIds = Cache::get(self::NODE_INDEX_KEY, []);
        if (!is_array($nodeIds)) {
            $nodeIds = [];
        }
        $nodeIds[] = $nodeId;
        Cache::put(self::NODE_INDEX_KEY, array_values(array_unique($nodeIds)), $ttl);
    }

    private function logContext(array $diagnostic): array
    {
        $context = $diagnostic;
        unset($context['uuids']);

        return $context;
    }

    private function extractUuids(Collection $users): array
    {
        return $users
            ->map(function ($user) {
                if (is_array($user)) {
                    return $user['uuid'] ?? null;
                }
                if (is_object($user)) {
                    return $user->uuid ?? null;
                }
                return null;
            })
            ->filter(fn($uuid) => is_string($uuid) && $uuid !== '')
            ->values()
            ->all();
    }

    private function shouldCacheUuids(int $count): bool
    {
        if (!$this->toBool($this->getConfig('track_uuid_cache', true))) {
            return false;
        }

        $max = max(1, (int) $this->getConfig('max_uuid_cache_users', 10000));
        return $count <= $max;
    }

    private function isUserSyncEndpoint(): bool
    {
        $path = $this->requestPath();
        if ($path === '') {
            return false;
        }

        return str_ends_with($path, 'server/user')
            || str_contains($path, 'server/UniProxy/user')
            || str_contains($path, 'server/ShadowsocksTidalab/user')
            || str_contains($path, 'server/TrojanTidalab/user');
    }

    private function requestPath(): string
    {
        try {
            return request()->path();
        } catch (\Throwable) {
            return '';
        }
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

    private function getConfig(?string $key = null, mixed $default = null): mixed
    {
        $config = $this->config();
        if ($key === null) {
            return $config;
        }

        return $config[$key] ?? $default;
    }

    private function config(): array
    {
        if ($this->configLoaded) {
            return $this->config;
        }

        $defaults = [
            'enable_sync_log' => true,
            'only_user_endpoint' => true,
            'track_uuid_cache' => true,
            'max_uuid_cache_users' => 10000,
            'abnormal_drop_percent' => 30,
            'minimum_expected_users' => 0,
            'block_abnormal_sync' => false,
        ];

        try {
            $plugin = PluginModel::query()
                ->where('code', 'node_sync_diagnostic')
                ->first();
            $saved = $plugin && $plugin->config ? json_decode($plugin->config, true) : [];
            $this->config = array_merge($defaults, is_array($saved) ? $saved : []);
        } catch (\Throwable $e) {
            Log::warning('node sync diagnostic: failed to load config, using defaults', [
                'error' => $e->getMessage(),
            ]);
            $this->config = $defaults;
        }

        $this->configLoaded = true;

        return $this->config;
    }

    public static function normalizeGroupIds(mixed $groupIds): array
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
}
