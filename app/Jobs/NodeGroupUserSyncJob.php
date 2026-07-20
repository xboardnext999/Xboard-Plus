<?php

namespace App\Jobs;

use App\Services\NodeSyncService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class NodeGroupUserSyncJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 2;
    public $timeout = 30;

    public function __construct(private readonly int $groupId)
    {
        $this->onQueue('node_sync');
    }

    public function handle(): void
    {
        NodeSyncService::notifyUsersUpdatedByGroup($this->groupId);
    }
}
