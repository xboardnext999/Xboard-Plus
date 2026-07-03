<?php

namespace App\Http\Middleware;

use Closure;

class ValidateAdminPath
{
    public function handle($request, Closure $next)
    {
        $actual = (string) $request->route('secure_path', '');
        $expected = (string) admin_setting(
            'secure_path',
            admin_setting('frontend_admin_path', hash('crc32b', config('app.key')))
        );

        if (!hash_equals($expected, $actual)) {
            abort(404);
        }

        return $next($request);
    }
}
