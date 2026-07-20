<?php
namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class AdminLockService
{
    public function enabled(): bool { $simple = (string) config('admin_lock.simple_password'); $full = (string) config('admin_lock.full_password'); return config('admin_lock.enabled') && $simple !== '' && $full !== '' && !hash_equals($simple, $full); }
    public function key(Request $request): string
    {
        $userId = auth('sanctum')->id() ?: 0;
        return 'admin_lock:' . $userId . ':' . hash('sha256', (string) $request->bearerToken());
    }
    public function scope(Request $request): string { return $this->enabled() ? (string) Cache::get($this->key($request), 'locked') : 'full'; }
    public function unlock(Request $request, string $password): ?string
    {
        $scope = hash_equals((string) config('admin_lock.full_password'), $password) ? 'full'
            : (hash_equals((string) config('admin_lock.simple_password'), $password) ? 'simple' : null);
        if ($scope) Cache::put($this->key($request), $scope, max(300, (int) config('admin_lock.ttl')));
        return $scope;
    }
    public function lock(Request $request): void { Cache::forget($this->key($request)); }
}
