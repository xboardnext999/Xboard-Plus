<?php

namespace App\Http\Controllers\V2\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminAuditLog;
use App\Utils\CacheKey;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Schema;
use Laravel\Horizon\Contracts\JobRepository;
use Laravel\Horizon\Contracts\MasterSupervisorRepository;
use Laravel\Horizon\Contracts\MetricsRepository;
use Laravel\Horizon\Contracts\SupervisorRepository;
use Laravel\Horizon\Contracts\WorkloadRepository;
use Laravel\Horizon\WaitTimeCalculator;
use App\Helpers\ResponseEnum;

class SystemController extends Controller
{
    public function getSystemStatus()
    {
        $data = [
            'schedule' => $this->getScheduleStatus(),
            'horizon' => $this->getHorizonStatus(),
            'schedule_last_runtime' => Cache::get(CacheKey::get('SCHEDULE_LAST_CHECK_AT', null)),
        ];
        return $this->success($data);
    }

    public function getQueueWorkload()
    {
        if (!$this->getHorizonStatus()) {
            return $this->success($this->getWorkerQueueWorkload());
        }

        try {
            $workload = app(WorkloadRepository::class);
            return $this->success(collect($workload->get())->sortBy('name')->values()->toArray());
        } catch (\Throwable) {
            return $this->success([]);
        }
    }

    protected function getScheduleStatus(): bool
    {
        return (time() - 120) < Cache::get(CacheKey::get('SCHEDULE_LAST_CHECK_AT', null));
    }

    protected function getHorizonStatus(): bool
    {
        if (!$this->horizonAvailable()) {
            return false;
        }

        try {
            if (!$masters = app(MasterSupervisorRepository::class)->all()) {
                return false;
            }

            return collect($masters)->contains(function ($master) {
                return $master->status === 'paused';
            }) ? false : true;
        } catch (\Throwable) {
            return false;
        }
    }

    public function getQueueStats()
    {
        if (!$this->getHorizonStatus()) {
            return $this->success($this->getWorkerQueueStats());
        }

        try {
            $data = [
                'failedJobs' => app(JobRepository::class)->countRecentlyFailed(),
                'jobsPerMinute' => app(MetricsRepository::class)->jobsProcessedPerMinute(),
                'pausedMasters' => $this->totalPausedMasters(),
                'periods' => [
                    'failedJobs' => config('horizon.trim.recent_failed', config('horizon.trim.failed')),
                    'recentJobs' => config('horizon.trim.recent'),
                ],
                'processes' => $this->totalProcessCount(),
                'queueWithMaxRuntime' => app(MetricsRepository::class)->queueWithMaximumRuntime(),
                'queueWithMaxThroughput' => app(MetricsRepository::class)->queueWithMaximumThroughput(),
                'recentJobs' => app(JobRepository::class)->countRecent(),
                'status' => $this->getHorizonStatus(),
                'mode' => 'horizon',
                'modeLabel' => 'Laravel Horizon',
                'metricsAvailable' => true,
                'waitUnit' => 'seconds',
                'wait' => collect(app(WaitTimeCalculator::class)->calculate())->take(1),
            ];
            return $this->success($data);
        } catch (\Throwable) {
            return $this->success($this->emptyQueueStats());
        }
    }

    /**
     * Get the total process count across all supervisors.
     *
     * @return int
     */
    protected function totalProcessCount()
    {
        if (!$this->horizonAvailable()) {
            return 0;
        }

        try {
            $supervisors = app(SupervisorRepository::class)->all();
        } catch (\Throwable) {
            return 0;
        }

        return collect($supervisors)->reduce(function ($carry, $supervisor) {
            return $carry + collect($supervisor->processes)->sum();
        }, 0);
    }

    /**
     * Get the number of master supervisors that are currently paused.
     *
     * @return int
     */
    protected function totalPausedMasters()
    {
        if (!$this->horizonAvailable()) {
            return 0;
        }

        try {
            if (!$masters = app(MasterSupervisorRepository::class)->all()) {
                return 0;
            }

            return collect($masters)->filter(function ($master) {
                return $master->status === 'paused';
            })->count();
        } catch (\Throwable) {
            return 0;
        }
    }

    public function getAuditLog(Request $request)
    {
        $current = max(1, (int) $request->input('current', 1));
        $pageSize = min(100, max(10, (int) $request->input('page_size', 10)));

        $builder = AdminAuditLog::with('admin:id,email')
            ->orderBy('id', 'DESC')
            ->when($request->input('action'), fn($q, $v) => $q->where('action', $v))
            ->when($request->input('admin_id'), fn($q, $v) => $q->where('admin_id', $v))
            ->when($request->input('keyword'), function ($q, $keyword) {
                $q->where(function ($q) use ($keyword) {
                    $q->where('uri', 'like', '%' . $keyword . '%')
                      ->orWhere('request_data', 'like', '%' . $keyword . '%');
                });
            });

        $total = $builder->count();
        $res = $builder->forPage($current, $pageSize)->get();

        return response(['data' => $res, 'total' => $total]);
    }

    public function getHorizonFailedJobs(Request $request)
    {
        $current = max(1, (int) $request->input('current', 1));
        $pageSize = max(10, (int) $request->input('page_size', 20));
        $offset = ($current - 1) * $pageSize;

        if (!$this->getHorizonStatus()) {
            return $this->getWorkerFailedJobs($current, $pageSize);
        }

        try {
            $jobRepository = app(JobRepository::class);
            $failedJobs = collect($jobRepository->getFailed())
                ->sortByDesc('failed_at')
                ->slice($offset, $pageSize)
                ->values();
            $total = $jobRepository->countFailed();
        } catch (\Throwable) {
            $failedJobs = collect();
            $total = 0;
        }

        return response()->json([
            'data' => $failedJobs,
            'total' => $total,
            'current' => $current,
            'page_size' => $pageSize,
        ]);
    }

    private function horizonAvailable(): bool
    {
        if (config('queue.default') === 'sync') {
            return false;
        }

        return config('database.redis.client') !== 'phpredis' || class_exists('Redis');
    }

    private function emptyQueueStats(): array
    {
        return [
            'failedJobs' => 0,
            'jobsPerMinute' => 0,
            'pausedMasters' => 0,
            'periods' => [
                'failedJobs' => config('horizon.trim.recent_failed', config('horizon.trim.failed')),
                'recentJobs' => config('horizon.trim.recent'),
            ],
            'processes' => 0,
            'queueWithMaxRuntime' => null,
            'queueWithMaxThroughput' => null,
            'recentJobs' => 0,
            'status' => false,
            'wait' => collect(),
        ];
    }

    private function queueNames(): array
    {
        return ['default', 'order_handle', 'traffic_fetch', 'stat', 'user_alive_sync', 'send_email', 'send_email_mass', 'send_telegram', 'node_sync'];
    }

    private function queueWorkerProcessCount(): int
    {
        $count = 0;
        foreach (glob('/proc/[0-9]*/cmdline') ?: [] as $file) {
            $command = @file_get_contents($file);
            if ($command !== false && str_contains(str_replace("\0", ' ', $command), 'artisan queue:work')) {
                $count++;
            }
        }
        return $count;
    }

    private function redisQueueCounts(string $name): array
    {
        try {
            $redis = Redis::connection(config('queue.connections.redis.connection', 'default'));
            return [
                'ready' => (int) $redis->llen("queues:{$name}"),
                'reserved' => (int) $redis->zcard("queues:{$name}:reserved"),
                'delayed' => (int) $redis->zcard("queues:{$name}:delayed"),
            ];
        } catch (\Throwable) {
            return ['ready' => 0, 'reserved' => 0, 'delayed' => 0];
        }
    }

    private function getWorkerQueueWorkload(): array
    {
        $processes = $this->queueWorkerProcessCount();
        return collect($this->queueNames())->map(function (string $name) use ($processes) {
            $counts = $this->redisQueueCounts($name);
            return [
                'name' => $name,
                'length' => $counts['ready'],
                'ready' => $counts['ready'],
                'reserved' => $counts['reserved'],
                'delayed' => $counts['delayed'],
                'processes' => $processes,
                'wait' => 0,
            ];
        })->values()->all();
    }

    private function getWorkerQueueStats(): array
    {
        $workload = collect($this->getWorkerQueueWorkload());
        $processes = $this->queueWorkerProcessCount();
        $failed = Schema::hasTable(config('queue.failed.table', 'failed_jobs'))
            ? DB::table(config('queue.failed.table', 'failed_jobs'))->count()
            : 0;

        return [
            'failedJobs' => $failed,
            'jobsPerMinute' => null,
            'pausedMasters' => null,
            'processes' => $processes,
            'recentJobs' => null,
            'status' => $processes > 0,
            'mode' => 'worker',
            'modeLabel' => 'Redis Queue Worker',
            'metricsAvailable' => false,
            'waitUnit' => 'jobs',
            'wait' => $workload->pluck('length', 'name')->all(),
            'readyJobs' => $workload->sum('ready'),
            'reservedJobs' => $workload->sum('reserved'),
            'delayedJobs' => $workload->sum('delayed'),
            'queueWithMaxRuntime' => null,
            'queueWithMaxThroughput' => null,
        ];
    }

    private function getWorkerFailedJobs(int $current, int $pageSize)
    {
        $table = config('queue.failed.table', 'failed_jobs');
        if (!Schema::hasTable($table)) {
            return response()->json(['data' => [], 'total' => 0, 'current' => $current, 'page_size' => $pageSize]);
        }

        $query = DB::table($table)->orderByDesc('id');
        $total = (clone $query)->count();
        $jobs = $query->forPage($current, $pageSize)->get()->map(function ($job) {
            $payload = json_decode($job->payload ?? '{}', true);
            return [
                'id' => $job->uuid ?? $job->id,
                'name' => $payload['displayName'] ?? $payload['job'] ?? '未知作业',
                'connection' => $job->connection ?? config('queue.default'),
                'queue' => $job->queue ?? 'default',
                'payload' => is_array($payload) ? $payload : [],
                'exception' => $job->exception ?? '',
                'failed_at' => $job->failed_at ?? null,
                'status' => 'failed',
            ];
        })->values();

        return response()->json(['data' => $jobs, 'total' => $total, 'current' => $current, 'page_size' => $pageSize]);
    }

}
