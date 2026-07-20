<?php
namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;

class AdminLockService
{
    public function enabled(): bool
    {
        $enabled = admin_setting('admin_lock_enabled', config('admin_lock.enabled') ? 1 : 0);
        return filter_var($enabled, FILTER_VALIDATE_BOOL) && $this->hasSimplePassword() && $this->hasFullPassword();
    }
    public function ttl(): int { return max(300, min(604800, (int) admin_setting('admin_lock_ttl', config('admin_lock.ttl')))); }
    public function hasSimplePassword(): bool { return (string) admin_setting('admin_lock_simple_hash', '') !== '' || (string) config('admin_lock.simple_password') !== ''; }
    public function hasFullPassword(): bool { return (string) admin_setting('admin_lock_full_hash', '') !== '' || (string) config('admin_lock.full_password') !== ''; }
    public function verifySimple(string $password): bool { return $this->verify('simple', $password); }
    public function verifyFull(string $password): bool { return $this->verify('full', $password); }
    private function verify(string $type, string $password): bool
    {
        $hash = (string) admin_setting("admin_lock_{$type}_hash", '');
        if ($hash !== '') return Hash::check($password, $hash);
        $plain = (string) config("admin_lock.{$type}_password");
        return $plain !== '' && hash_equals($plain, $password);
    }
    public function key(Request $request): string
    {
        $userId = auth('sanctum')->id() ?: 0;
        $version = (string) admin_setting('admin_lock_version', '1');
        return 'admin_lock:' . $version . ':' . $userId . ':' . hash('sha256', (string) $request->bearerToken());
    }
    public function scope(Request $request): string { return $this->enabled() ? (string) Cache::get($this->key($request), 'locked') : 'full'; }
    public function unlock(Request $request, string $password): ?string
    {
        $scope = $this->verifyFull($password) ? 'full' : ($this->verifySimple($password) ? 'simple' : null);
        if ($scope) Cache::put($this->key($request), $scope, $this->ttl());
        return $scope;
    }
    public function lock(Request $request): void { Cache::forget($this->key($request)); }
}
