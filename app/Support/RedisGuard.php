<?php

namespace App\Support;

use Illuminate\Support\Facades\Redis;

class RedisGuard
{
    public static function connection(?string $name = null): mixed
    {
        if (config('database.redis.client') === 'phpredis' && !class_exists('Redis')) {
            return null;
        }

        try {
            return $name === null ? Redis::connection() : Redis::connection($name);
        } catch (\Throwable) {
            return null;
        }
    }

    public static function publish(string $channel, array $payload): bool
    {
        $redis = self::connection();
        if (!$redis) {
            return false;
        }

        try {
            $redis->publish($channel, json_encode($payload));
            return true;
        } catch (\Throwable) {
            return false;
        }
    }
}
