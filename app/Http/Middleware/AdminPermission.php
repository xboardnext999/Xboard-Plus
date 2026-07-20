<?php

namespace App\Http\Middleware;

use Closure;

class AdminPermission
{
    private const MAP = [
        'config' => '/system/config', 'mail/template' => '/system/config', 'admin-lock' => '/system/admin-lock', 'plugin' => '/system/plugin', 'theme' => '/system/theme', 'notice' => '/system/notice', 'payment' => '/system/payment', 'knowledge' => '/system/knowledge',
        'server/machine' => '/node/server', 'server/manage' => '/node/list', 'server/group' => '/node/group', 'server/route' => '/node/route', 'node-sync-diagnostic' => '/node/diagnostic',
        'plan' => '/subscription/plan', 'group-buy' => '/finance/plan', 'order' => '/subscription/order', 'coupon' => '/subscription/coupon', 'gift-card' => '/subscription/gift-card',
        'user' => '/user/list', 'ticket' => '/user/ticket', 'traffic-reset' => '/user/traffic-reset-log', 'stat' => '/dashboard', 'system' => '/dashboard', 'backup' => '/system/backup', 'temporary-access' => '/system/temporary-access',
    ];

    public function handle($request, Closure $next)
    {
        $profile = $request->attributes->get('admin_access_profile');
        if (!$profile) return $next($request);
        $relative = preg_replace('#^api/v2/[^/]+/#', '', $request->path());
        if ($relative === 'temporary-access/me') return $next($request);
        if (str_starts_with($relative, 'temporary-access/')) return response()->json(['message' => '临时账号不能管理访问授权'], 403);
        if (str_starts_with($relative, 'admin-lock/')) {
            return in_array($relative, ['admin-lock/status', 'admin-lock/lock', 'admin-lock/summary'], true)
                ? $next($request) : response()->json(['message' => '临时账号不能修改访问设置'], 403);
        }
        $page = $this->resolvePage($relative);
        $level = $page ? ($profile->permissions[$page] ?? null) : null;
        $needsWrite = !in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'], true);
        if (!$level || ($needsWrite && $level !== 'write')) return response()->json(['message' => '当前临时账号没有此操作权限'], 403);
        return $next($request);
    }

    private function resolvePage(string $relative): ?string
    {
        if ($relative === 'system/getAuditLog') return '/system/audit';
        if (in_array($relative, ['forwarding/summary', 'forwarding/options'], true)) return '/forwarding/dashboard';
        if (str_starts_with($relative, 'forwarding/plans')) return '/forwarding/plans';
        if (str_starts_with($relative, 'digital-products/stock')) return '/digital/inventory';
        if (str_starts_with($relative, 'digital-products/deliveries')) return '/digital/delivery';
        if (str_starts_with($relative, 'digital-products')) return '/digital/products';
        if (preg_match('#^forwarding/(forwards|tunnels|nodes|limits|access)(?:/|$)#', $relative, $matches)) {
            return '/forwarding/' . $matches[1];
        }
        foreach (self::MAP as $prefix => $page) if ($relative === $prefix || str_starts_with($relative, $prefix . '/')) return $page;
        return null;
    }
}
