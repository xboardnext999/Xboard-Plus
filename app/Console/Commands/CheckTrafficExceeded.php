<?php

namespace App\Console\Commands;

use App\Services\TrafficExceededService;
use App\Support\RedisGuard;
use Illuminate\Console\Command;

class CheckTrafficExceeded extends Command
{
    protected $signature = 'check:traffic-exceeded';
    protected $description = '检查流量超标用户并通知节点';

    public function handle()
    {
        $redis = RedisGuard::connection();
        if (!$redis) {
            $this->warn('Redis unavailable, skipped pending traffic set. TrafficFetchJob checks users inline while Redis is unavailable.');
            return;
        }

        $count = $redis->scard('traffic:pending_check');
        if ($count <= 0) {
            return;
        }

        $pendingUserIds = array_map('intval', $redis->spop('traffic:pending_check', $count));
        $result = app(TrafficExceededService::class)->checkUsers($pendingUserIds);

        $this->info("Checked {$result['checked']} users, notified {$result['notified_nodes']} nodes for {$result['exceeded']} exceeded users.");
    }
}
