<?php

namespace App\Services;

use App\Models\User;
use App\Support\RedisGuard;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

class DeviceStateService
{
    private const PREFIX = 'user_devices:';
    private const TTL = 300;
    private const DB_THROTTLE = 10;
    private const CACHE_INDEX_KEY = 'device_state:user_ids';

    /**
     * 批量设置设备，用于 HTTP /alive 和 WebSocket report.devices。
     */
    public function setDevices(int $userId, int $nodeId, array $ips): void
    {
        $timestamp = time();

        $this->removeNodeDevices($nodeId, $userId);

        $ips = array_values(array_unique(array_map([self::class, 'normalizeIP'], $ips)));
        if (!empty($ips)) {
            $fields = [];
            foreach ($ips as $ip) {
                $fields["{$nodeId}:{$ip}"] = $timestamp;
            }

            if ($redis = $this->redis()) {
                $redis->hmset(self::PREFIX . $userId, $fields);
                $redis->expire(self::PREFIX . $userId, self::TTL);
            } else {
                $data = $this->getCacheDeviceMap($userId);
                foreach ($fields as $field => $value) {
                    $data[$field] = $value;
                }
                $this->putCacheDeviceMap($userId, $data);
                $this->rememberCacheUserId($userId);
            }
        }

        $this->notifyUpdate($userId);
    }

    /**
     * 获取某节点的所有设备数据，返回: {userId: [ip1, ip2, ...], ...}
     */
    public function getNodeDevices(int $nodeId): array
    {
        $prefix = "{$nodeId}:";
        $result = [];

        if ($redis = $this->redis()) {
            foreach ($redis->keys(self::PREFIX . '*') as $key) {
                $actualKey = $this->removeRedisPrefix($key);
                $uid = (int) substr($actualKey, strlen(self::PREFIX));
                foreach ($this->filterFreshDeviceMap($redis->hgetall($actualKey)) as $field => $timestamp) {
                    if (str_starts_with($field, $prefix)) {
                        $result[$uid][] = substr($field, strlen($prefix));
                    }
                }
            }
            return $result;
        }

        foreach ($this->getCacheUserIds() as $uid) {
            foreach ($this->getCacheDeviceMap($uid) as $field => $timestamp) {
                if (str_starts_with($field, $prefix)) {
                    $result[$uid][] = substr($field, strlen($prefix));
                }
            }
        }

        return $result;
    }

    /**
     * 删除某节点某用户的设备。
     */
    public function removeNodeDevices(int $nodeId, int $userId): void
    {
        $prefix = "{$nodeId}:";

        if ($redis = $this->redis()) {
            foreach ($redis->hkeys(self::PREFIX . $userId) as $field) {
                if (str_starts_with($field, $prefix)) {
                    $redis->hdel(self::PREFIX . $userId, $field);
                }
            }
            return;
        }

        $data = $this->getCacheDeviceMap($userId);
        foreach (array_keys($data) as $field) {
            if (str_starts_with($field, $prefix)) {
                unset($data[$field]);
            }
        }
        $this->putCacheDeviceMap($userId, $data);
    }

    /**
     * 清除节点所有设备数据，用于节点断开连接。
     */
    public function clearAllNodeDevices(int $nodeId): array
    {
        $oldDevices = $this->getNodeDevices($nodeId);
        $prefix = "{$nodeId}:";

        foreach ($oldDevices as $userId => $ips) {
            if ($redis = $this->redis()) {
                foreach ($redis->hkeys(self::PREFIX . $userId) as $field) {
                    if (str_starts_with($field, $prefix)) {
                        $redis->hdel(self::PREFIX . $userId, $field);
                    }
                }
            } else {
                $data = $this->getCacheDeviceMap((int) $userId);
                foreach (array_keys($data) as $field) {
                    if (str_starts_with($field, $prefix)) {
                        unset($data[$field]);
                    }
                }
                $this->putCacheDeviceMap((int) $userId, $data);
            }

            $this->notifyUpdate((int) $userId, true);
        }

        return array_keys($oldDevices);
    }

    /**
     * 获取用户设备数量，按 IP 去重。
     */
    public function getDeviceCount(int $userId): int
    {
        $data = $this->getDeviceMap($userId);
        $ips = [];

        foreach ($data as $field => $timestamp) {
            $ips[] = substr($field, strpos($field, ':') + 1);
        }

        return count(array_unique($ips));
    }

    /**
     * get user device count (for alivelist interface)
     */
    public function getAliveList(Collection $users): array
    {
        if ($users->isEmpty()) {
            return [];
        }

        $result = [];
        foreach ($users as $user) {
            $count = $this->getDeviceCount($user->id);
            if ($count > 0) {
                $result[$user->id] = $count;
            }
        }

        return $result;
    }

    /**
     * get devices of multiple users (for sync.devices)
     */
    public function getUsersDevices(array $userIds): array
    {
        $result = [];
        foreach ($userIds as $userId) {
            $ips = [];
            foreach ($this->getDeviceMap((int) $userId) as $field => $timestamp) {
                $ips[] = substr($field, strpos($field, ':') + 1);
            }

            if (!empty($ips)) {
                $result[$userId] = array_values(array_unique($ips));
            }
        }

        return $result;
    }

    /**
     * Strip port from IP address: "1.2.3.4:12345", "[::1]:443".
     */
    private static function normalizeIP(string $ip): string
    {
        if (preg_match('/^\[(.+)\]:\d+$/', $ip, $m)) {
            return $m[1];
        }
        if (preg_match('/^(\d+\.\d+\.\d+\.\d+):\d+$/', $ip, $m)) {
            return $m[1];
        }
        return $ip;
    }

    /**
     * 更新用户在线计数，带短节流避免节点高频上报压垮 users 表。
     */
    public function notifyUpdate(int $userId, bool $force = false): void
    {
        if (!$force && !$this->acquireThrottle("device:db_throttle:{$userId}")) {
            return;
        }

        User::query()
            ->whereKey($userId)
            ->update([
                'online_count' => $this->getDeviceCount($userId),
                'last_online_at' => now(),
            ]);
    }

    private function getDeviceMap(int $userId): array
    {
        if ($redis = $this->redis()) {
            return $this->filterFreshDeviceMap($redis->hgetall(self::PREFIX . $userId));
        }

        return $this->getCacheDeviceMap($userId);
    }

    private function filterFreshDeviceMap(array $data): array
    {
        $now = time();
        $filtered = [];

        foreach ($data as $field => $timestamp) {
            if ($now - (int) $timestamp <= self::TTL) {
                $filtered[$field] = (int) $timestamp;
            }
        }

        return $filtered;
    }

    private function redis(): mixed
    {
        return RedisGuard::connection();
    }

    private function removeRedisPrefix(string $key): string
    {
        $prefix = config('database.redis.options.prefix', '');
        return $prefix ? substr($key, strlen($prefix)) : $key;
    }

    private function acquireThrottle(string $key): bool
    {
        if ($redis = $this->redis()) {
            if ($redis->setnx($key, 1)) {
                $redis->expire($key, self::DB_THROTTLE);
                return true;
            }
            return false;
        }

        return Cache::add($key, 1, self::DB_THROTTLE);
    }

    private function getCacheDeviceMap(int $userId): array
    {
        $data = Cache::get($this->cacheUserKey($userId), []);
        if (!is_array($data)) {
            return [];
        }

        $filtered = $this->filterFreshDeviceMap($data);
        if (count($filtered) !== count($data)) {
            $this->putCacheDeviceMap($userId, $filtered);
        }

        return $filtered;
    }

    private function putCacheDeviceMap(int $userId, array $data): void
    {
        if (empty($data)) {
            Cache::forget($this->cacheUserKey($userId));
            return;
        }

        Cache::put($this->cacheUserKey($userId), $data, self::TTL);
    }

    private function rememberCacheUserId(int $userId): void
    {
        $ids = $this->getCacheUserIds();
        $ids[] = $userId;
        Cache::put(self::CACHE_INDEX_KEY, array_values(array_unique(array_map('intval', $ids))), self::TTL * 2);
    }

    private function getCacheUserIds(): array
    {
        $ids = Cache::get(self::CACHE_INDEX_KEY, []);
        return is_array($ids) ? array_values(array_unique(array_map('intval', $ids))) : [];
    }

    private function cacheUserKey(int $userId): string
    {
        return self::PREFIX . $userId;
    }
}
