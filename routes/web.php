<?php

use App\Services\ThemeService;
use App\Services\UpdateService;
use App\Http\Controllers\V2\Admin\NodeSyncDiagnosticController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\File;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

Route::get('/node-sync-diagnostic', [NodeSyncDiagnosticController::class, 'dashboard']);
Route::get('/node-sync-diagnostic/dashboard', [NodeSyncDiagnosticController::class, 'dashboard']);
Route::get('/theme-runtime/{theme}/assets/app/{path}', function (string $theme, string $path) {
    if (!preg_match('/^[A-Za-z0-9_-]+$/', $theme) || str_contains($path, '..')) {
        abort(404);
    }

    $file = base_path("theme/{$theme}/assets/app/{$path}");
    if (!File::exists($file) || !File::isFile($file)) {
        abort(404);
    }

    $extension = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    $contentTypes = [
        'css' => 'text/css; charset=utf-8',
        'js' => 'application/javascript; charset=utf-8',
        'json' => 'application/json; charset=utf-8',
        'svg' => 'image/svg+xml',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'webp' => 'image/webp',
        'woff' => 'font/woff',
        'woff2' => 'font/woff2',
    ];

    return response(File::get($file), 200, [
        'Content-Type' => $contentTypes[$extension] ?? 'application/octet-stream',
        'Cache-Control' => 'public, max-age=31536000',
    ]);
})->where('path', '.*');

Route::get('/recharge', function (Request $request) {
    $query = $request->getQueryString();
    return redirect('/#/recharge' . ($query ? '?' . $query : ''));
});

Route::get('/', function (Request $request) {
    if (admin_setting('app_url') && admin_setting('safe_mode_enable', 0)) {
        $requestHost = $request->getHost();
        $configHost = parse_url(admin_setting('app_url'), PHP_URL_HOST);
        
        if ($requestHost !== $configHost) {
            abort(403);
        }
    }

    $theme = admin_setting('frontend_theme', 'Xboard');
    $themeService = new ThemeService();

    try {
        if (!$themeService->exists($theme)) {
            if ($theme !== 'Xboard') {
                Log::warning('Theme not found, switching to default theme', ['theme' => $theme]);
                $theme = 'Xboard';
                admin_setting(['frontend_theme' => $theme]);
            }
            $themeService->switch($theme);
        }

        if (!$themeService->getThemeViewPath($theme)) {
            throw new Exception('主题视图文件不存在');
        }

        $publicThemePath = public_path('theme/' . $theme);
        if (!File::exists($publicThemePath)) {
            $themePath = $themeService->getThemePath($theme);
            if (!$themePath || !File::copyDirectory($themePath, $publicThemePath)) {
                throw new Exception('主题初始化失败');
            }
            Log::info('Theme initialized in public directory', ['theme' => $theme]);
        }

        $themeConfig = array_merge([
            'theme_color' => 'default',
            'background_url' => '',
            'custom_html' => '',
        ], $themeService->getConfig($theme) ?: []);

        $assetVersion = app(UpdateService::class)->getCurrentVersion();
        $mainAssetPath = $themeService->getThemePath($theme) . '/assets/app/main.js';
        if (File::exists($mainAssetPath)) {
            $assetVersion .= '-' . File::lastModified($mainAssetPath);
        }

        $frontendSettings = [
            'title' => admin_setting('app_name', 'Xboard Plus'),
            'assets_path' => '/theme-runtime/' . $theme . '/assets',
            'theme' => [
                'color' => $themeConfig['theme_color'],
            ],
            'version' => $assetVersion,
            'background_url' => $themeConfig['background_url'],
            'description' => admin_setting('app_description', 'Xboard Plus is best!'),
            'i18n' => [
                'zh-CN',
                'en-US',
                'ja-JP',
                'vi-VN',
                'ko-KR',
                'zh-TW',
                'fa-IR',
            ],
            'logo' => admin_setting('logo'),
        ];

        $frontendSettingsJson = json_encode(
            $frontendSettings,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
        ) ?: '{}';

        $renderParams = [
            'title' => admin_setting('app_name', 'Xboard Plus'),
            'theme' => $theme,
            'version' => $frontendSettings['version'],
            'description' => admin_setting('app_description', 'Xboard Plus is best!'),
            'logo' => admin_setting('logo'),
            'theme_config' => $themeConfig,
            'frontend_settings_json' => $frontendSettingsJson
        ];
        return view('theme::' . $theme . '.dashboard', $renderParams);
    } catch (Exception $e) {
        Log::error('Theme rendering failed', [
            'theme' => $theme,
            'error' => $e->getMessage()
        ]);
        abort(500, '主题加载失败');
    }
});

Route::get('/' . (admin_setting('subscribe_path', 's')) . '/{token}', [\App\Http\Controllers\V1\Client\ClientController::class, 'subscribe'])
    ->middleware('client')
    ->name('client.subscribe');

Route::get('/{secure_path}', function (string $securePath) {
    $expectedPath = admin_setting('secure_path', admin_setting('frontend_admin_path', hash('crc32b', config('app.key'))));

    if (!hash_equals((string) $expectedPath, $securePath)) {
        abort(404);
    }

    return view('admin', [
        'title' => admin_setting('app_name', 'Xboard Plus'),
        'theme_sidebar' => admin_setting('frontend_theme_sidebar', 'light'),
        'theme_header' => admin_setting('frontend_theme_header', 'dark'),
        'theme_color' => admin_setting('frontend_theme_color', 'default'),
        'background_url' => admin_setting('frontend_background_url'),
        'version' => app(UpdateService::class)->getCurrentVersion(),
        'logo' => admin_setting('logo'),
        'secure_path' => admin_setting('secure_path', admin_setting('frontend_admin_path', hash('crc32b', config('app.key'))))
    ]);
})->where('secure_path', '[A-Za-z0-9_-]+');
