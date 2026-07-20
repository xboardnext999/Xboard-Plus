<?php
namespace App\Http\Controllers\V2\Admin;

use App\Http\Controllers\Controller;
use App\Services\AdminLockService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AdminLockController extends Controller
{
    public function __construct(private AdminLockService $lock) {}
    public function status(Request $request) { return $this->success(['enabled' => $this->lock->enabled(), 'scope' => $this->lock->scope($request)]); }
    public function unlock(Request $request)
    {
        $request->validate(['password' => 'required|string|min:4|max:128']);
        $key = 'admin-lock-attempt:' . $request->ip() . ':' . auth('sanctum')->id();
        if (RateLimiter::tooManyAttempts($key, 5)) return response()->json(['message' => '尝试次数过多，请稍后再试'], 429);
        $scope = $this->lock->unlock($request, (string) $request->input('password'));
        if (!$scope) { RateLimiter::hit($key, 60); return response()->json(['message' => '访问密码错误'], 422); }
        RateLimiter::clear($key); return $this->success(['scope' => $scope]);
    }
    public function lock(Request $request) { $this->lock->lock($request); return $this->success(true); }
    public function summary()
    {
        return $this->success([
            'service' => '运行正常',
            'account' => '正常',
            'sync' => '正常',
            'updated_at' => now()->toDateTimeString(),
        ]);
    }
    public function settings()
    {
        return $this->success([
            'enabled' => $this->lock->enabled(),
            'ttl_minutes' => (int) ($this->lock->ttl() / 60),
            'simple_password_set' => $this->lock->hasSimplePassword(),
            'full_password_set' => $this->lock->hasFullPassword(),
        ]);
    }
    public function updateSettings(Request $request)
    {
        $data = $request->validate([
            'enabled' => 'required|boolean', 'ttl_minutes' => 'required|integer|min:5|max:10080',
            'current_full_password' => 'required|string|max:128',
            'simple_password' => 'nullable|string|min:8|max:128', 'full_password' => 'nullable|string|min:12|max:128',
        ]);
        if (!$this->lock->verifyFull((string) $data['current_full_password'])) throw ValidationException::withMessages(['current_full_password' => '当前访问密码 B 不正确']);
        $simple = (string) ($data['simple_password'] ?? ''); $full = (string) ($data['full_password'] ?? '');
        if ($simple !== '' && $full !== '' && hash_equals($simple, $full)) throw ValidationException::withMessages(['full_password' => '两个访问密码不能相同']);
        if ($simple !== '' && $full === '' && $this->lock->verifyFull($simple)) throw ValidationException::withMessages(['simple_password' => '访问密码 A 不能与访问密码 B 相同']);
        if ($full !== '' && $simple === '' && $this->lock->verifySimple($full)) throw ValidationException::withMessages(['full_password' => '访问密码 B 不能与访问密码 A 相同']);
        $settings = ['admin_lock_enabled' => $data['enabled'] ? 1 : 0, 'admin_lock_ttl' => (int) $data['ttl_minutes'] * 60, 'admin_lock_version' => bin2hex(random_bytes(12))];
        if ($simple !== '') $settings['admin_lock_simple_hash'] = Hash::make($simple);
        if ($full !== '') $settings['admin_lock_full_hash'] = Hash::make($full);
        admin_setting($settings);
        return $this->success(['saved' => true, 'requires_unlock' => (bool) $data['enabled']]);
    }
}
