<?php
namespace App\Http\Middleware;

use App\Services\AdminLockService;
use Closure;

class AdminLock
{
    public function __construct(private AdminLockService $lock) {}
    public function handle($request, Closure $next)
    {
        if (!$this->lock->enabled()) return $next($request);
        $path = $request->path();
        if (str_ends_with($path, '/admin-lock/status') || str_ends_with($path, '/admin-lock/unlock') || str_ends_with($path, '/admin-lock/lock')) return $next($request);
        $scope = $this->lock->scope($request);
        if (str_ends_with($path, '/admin-lock/summary') && in_array($scope, ['a', 'b'], true)) return $next($request);
        if ($scope === 'b') return $next($request);
        return response()->json(['message' => 'Access verification required', 'state' => $scope], 423);
    }
}
