<?php

namespace App\Console\Commands;

use App\Services\ThemeService;
use App\Services\UpdateService;
use App\Support\Setting;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use App\Services\Plugin\PluginManager;

class XboardUpdate extends Command
{
    private const DEFAULT_APP_NAME = 'Xboard Plus';
    private const DEFAULT_APP_DESCRIPTION = 'Xboard Plus is best!';

    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'xboard:update';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'xboard 更新';

    /**
     * Create a new command instance.
     *
     * @return void
     */
    public function __construct()
    {
        parent::__construct();
    }

    /**
     * Execute the console command.
     *
     * @return mixed
     */
    public function handle()
    {
        $this->info('正在导入数据库请稍等...');
        Artisan::call("migrate", ['--force' => true]);
        $this->info(Artisan::output());
        $this->info('正在检查并安装默认插件...');
        PluginManager::installDefaultPlugins();
        $this->info('默认插件检查完成');
        $this->syncDefaultBranding();
        $updateService = new UpdateService();
        $updateService->updateVersionCache();
        $themeService = app(ThemeService::class);
        $themeService->refreshCurrentTheme();
        if (config('queue.default') === 'sync') {
            $this->info('horizon:terminate skipped (sync queue, no workers to terminate).');
        } else {
            try {
                Artisan::call('horizon:terminate');
            } catch (\Throwable $e) {
                $this->warn('horizon:terminate skipped: ' . $e->getMessage());
            }
        }
        $this->info('更新完毕，队列服务已重启，你无需进行任何操作。');
    }

    private function syncDefaultBranding(): void
    {
        $setting = app(Setting::class);
        $updates = [];

        if ($setting->get('app_name') === 'XBoard') {
            $updates['app_name'] = self::DEFAULT_APP_NAME;
        }

        if ($setting->get('app_description') === 'XBoard is best!') {
            $updates['app_description'] = self::DEFAULT_APP_DESCRIPTION;
        }

        if ($updates) {
            $setting->save($updates);
            $this->info('默认站点名称已更新为 Xboard Plus');
        }
    }
}
