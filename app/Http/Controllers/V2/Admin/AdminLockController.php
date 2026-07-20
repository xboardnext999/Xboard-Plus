<?php
namespace App\Http\Controllers\V2\Admin;

use App\Http\Controllers\Controller;
use App\Services\AdminLockService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

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
}
