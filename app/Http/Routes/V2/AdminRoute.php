<?php
namespace App\Http\Routes\V2;

use App\Http\Controllers\V2\Admin\ConfigController;
use App\Http\Controllers\V2\Admin\MailTemplateController;
use App\Http\Controllers\V2\Admin\PlanController;
use App\Http\Controllers\V2\Admin\Server\GroupController;
use App\Http\Controllers\V2\Admin\Server\RouteController;
use App\Http\Controllers\V2\Admin\Server\ManageController;
use App\Http\Controllers\V2\Admin\Server\MachineController;
use App\Http\Controllers\V2\Admin\OrderController;
use App\Http\Controllers\V2\Admin\UserController;
use App\Http\Controllers\V2\Admin\StatController;
use App\Http\Controllers\V2\Admin\NoticeController;
use App\Http\Controllers\V2\Admin\TicketController;
use App\Http\Controllers\V2\Admin\CouponController;
use App\Http\Controllers\V2\Admin\GiftCardController;
use App\Http\Controllers\V2\Admin\GroupBuyController;
use App\Http\Controllers\V2\Admin\KnowledgeController;
use App\Http\Controllers\V2\Admin\PaymentController;
use App\Http\Controllers\V2\Admin\SystemController;
use App\Http\Controllers\V2\Admin\ThemeController;
use App\Http\Controllers\V2\Admin\TrafficResetController;
use App\Http\Controllers\V2\Admin\NodeSyncDiagnosticController;
use App\Http\Controllers\V2\Admin\AdminLockController;
use App\Http\Controllers\V2\Admin\AdminAccessController;
use App\Http\Controllers\V2\Admin\BackupController;
use App\Http\Controllers\V2\Admin\FluxController;
use App\Http\Controllers\V2\Admin\DigitalProductController;
use Illuminate\Contracts\Routing\Registrar;

class AdminRoute
{
    public function map(Registrar $router)
    {
        $router->group([
            'prefix' => '{secure_path}',
            'middleware' => ['admin.path', 'admin', 'admin.lock', 'admin.permission', 'log'],
        ], function ($router) {
            $router->group(['prefix' => 'admin-lock'], function ($router) {
                $router->get('/status', [AdminLockController::class, 'status']);
                $router->post('/unlock', [AdminLockController::class, 'unlock']);
                $router->post('/lock', [AdminLockController::class, 'lock']);
                $router->get('/summary', [AdminLockController::class, 'summary']);
                $router->get('/settings', [AdminLockController::class, 'settings']);
                $router->post('/settings', [AdminLockController::class, 'updateSettings']);
            });
            $router->group(['prefix' => 'temporary-access'], function ($router) {
                $router->get('/me', [AdminAccessController::class, 'me']);
                $router->get('/fetch', [AdminAccessController::class, 'index']);
                $router->post('/save', [AdminAccessController::class, 'save']);
                $router->post('/revoke', [AdminAccessController::class, 'revoke']);
                $router->post('/drop', [AdminAccessController::class, 'destroy']);
            });
            $router->group(['prefix' => 'backup'], function ($router) {
                $router->get('/fetch', [BackupController::class, 'index']);
                $router->post('/create', [BackupController::class, 'create']);
                $router->post('/settings', [BackupController::class, 'saveSettings']);
            });
            $router->group(['prefix' => 'forwarding'], function ($router) {
                $router->get('/summary', [FluxController::class, 'summary']);
                $router->get('/options', [FluxController::class, 'options']);
                $router->get('/{resource}', [FluxController::class, 'index']);
                $router->post('/{resource}/save', [FluxController::class, 'save']);
                $router->post('/{resource}/drop', [FluxController::class, 'destroy']);
            });
            $router->group(['prefix' => 'digital-products'], function ($router) {
                $router->get('/fetch', [DigitalProductController::class, 'fetch']);
                $router->get('/banner', [DigitalProductController::class, 'banner']);
                $router->post('/banner/save', [DigitalProductController::class, 'saveBanner']);
                $router->post('/banner/upload', [DigitalProductController::class, 'uploadBanner']);
                $router->post('/save', [DigitalProductController::class, 'save']);
                $router->get('/stock', [DigitalProductController::class, 'stock']);
                $router->get('/deliveries', [DigitalProductController::class, 'deliveries']);
                $router->post('/cover/upload', [DigitalProductController::class, 'uploadCover']);
                $router->post('/stock/import', [DigitalProductController::class, 'importStock']);
                $router->post('/stock/drop', [DigitalProductController::class, 'deleteStock']);
            });
            // Config
            $router->group([
                'prefix' => 'config'
            ], function ($router) {
                $router->get('/fetch', [ConfigController::class, 'fetch']);
                $router->post('/save', [ConfigController::class, 'save']);
                $router->post('/uploadLogo', [ConfigController::class, 'uploadLogo']);
                $router->get('/getEmailTemplate', [ConfigController::class, 'getEmailTemplate']);
                $router->get('/getThemeTemplate', [ConfigController::class, 'getThemeTemplate']);
                $router->post('/setTelegramWebhook', [ConfigController::class, 'setTelegramWebhook']);
                $router->post('/testSendMail', [ConfigController::class, 'testSendMail']);
            });

            // Mail Templates
            $router->group([
                'prefix' => 'mail/template'
            ], function ($router) {
                $router->get('/list', [MailTemplateController::class, 'list']);
                $router->get('/get', [MailTemplateController::class, 'get']);
                $router->post('/save', [MailTemplateController::class, 'save']);
                $router->post('/reset', [MailTemplateController::class, 'reset']);
                $router->post('/test', [MailTemplateController::class, 'test']);
            });

            // Plan
            $router->group([
                'prefix' => 'plan'
            ], function ($router) {
                $router->get('/fetch', [PlanController::class, 'fetch']);
                $router->post('/save', [PlanController::class, 'save']);
                $router->post('/transfer-price', [PlanController::class, 'transferPrice']);
                $router->post('/drop', [PlanController::class, 'drop']);
                $router->post('/update', [PlanController::class, 'update']);
                $router->post('/sort', [PlanController::class, 'sort']);
            });

            // Server
            $router->group([
                'prefix' => 'server/group'
            ], function ($router) {
                $router->get('/fetch', [GroupController::class, 'fetch']);
                $router->post('/save', [GroupController::class, 'save']);
                $router->post('/drop', [GroupController::class, 'drop']);
            });
            $router->group([
                'prefix' => 'server/route'
            ], function ($router) {
                $router->get('/fetch', [RouteController::class, 'fetch']);
                $router->post('/save', [RouteController::class, 'save']);
                $router->post('/drop', [RouteController::class, 'drop']);
            });
            // 节点管理接口
            $router->group([
                'prefix' => 'server/manage'
            ], function ($router) {
                $router->get('/getNodes', [ManageController::class, 'getNodes']);
                $router->post('/update', [ManageController::class, 'update']);
                $router->post('/save', [ManageController::class, 'save']);
                $router->post('/drop', [ManageController::class, 'drop']);
                $router->post('/copy', [ManageController::class, 'copy']);
                $router->post('/sort', [ManageController::class, 'sort']);
                $router->post('/batchDelete', [ManageController::class, 'batchDelete']);
                $router->post('/batchUpdate', [ManageController::class, 'batchUpdate']);
                $router->post('/resetTraffic', [ManageController::class, 'resetTraffic']);
                $router->post('/batchResetTraffic', [ManageController::class, 'batchResetTraffic']);
                $router->get('/generateEchKey', [ManageController::class, 'generateEchKey']);
            });

            // 机器管理接口
            $router->group([
                'prefix' => 'server/machine'
            ], function ($router) {
                $router->get('/fetch', [MachineController::class, 'fetch']);
                $router->post('/save', [MachineController::class, 'save']);
                $router->post('/drop', [MachineController::class, 'drop']);
                $router->post('/resetToken', [MachineController::class, 'resetToken']);
                $router->get('/getToken', [MachineController::class, 'getToken']);
                $router->get('/installCommand', [MachineController::class, 'installCommand']);
                $router->get('/nodes', [MachineController::class, 'nodes']);
                $router->get('/history', [MachineController::class, 'history']);
            });

            // 节点同步诊断
            $router->group([
                'prefix' => 'node-sync-diagnostic'
            ], function ($router) {
                $router->get('/snapshots', [NodeSyncDiagnosticController::class, 'adminSnapshots']);
                $router->get('/node-users', [NodeSyncDiagnosticController::class, 'adminNodeUsers']);
                $router->get('/access', [NodeSyncDiagnosticController::class, 'adminNodeAccess']);
                $router->post('/snapshots/save', [NodeSyncDiagnosticController::class, 'denyWrite']);
                $router->post('/snapshots/delete', [NodeSyncDiagnosticController::class, 'denyWrite']);
            });

            // Order
            $router->group([
                'prefix' => 'order'
            ], function ($router) {
                $router->any('/fetch', [OrderController::class, 'fetch']);
                $router->post('/update', [OrderController::class, 'update']);
                $router->post('/assign', [OrderController::class, 'assign']);
                $router->post('/paid', [OrderController::class, 'paid']);
                $router->post('/cancel', [OrderController::class, 'cancel']);
                $router->post('/detail', [OrderController::class, 'detail']);
            });

            // User
            $router->group([
                'prefix' => 'user'
            ], function ($router) {
                $router->any('/fetch', [UserController::class, 'fetch']);
                $router->post('/update', [UserController::class, 'update']);
                $router->get('/getUserInfoById', [UserController::class, 'getUserInfoById']);
                $router->post('/generate', [UserController::class, 'generate']);
                $router->post('/dumpCSV', [UserController::class, 'dumpCSV']);
                $router->post('/sendMail', [UserController::class, 'sendMail']);
                $router->post('/ban', [UserController::class, 'ban']);
                $router->post('/resetSecret', [UserController::class, 'resetSecret']);
                $router->post('/setInviteUser', [UserController::class, 'setInviteUser']);
                $router->post('/destroy', [UserController::class, 'destroy']);
            });

            // Stat
            $router->group([
                'prefix' => 'stat'
            ], function ($router) {
                $router->get('/getOverride', [StatController::class, 'getOverride']);
                $router->get('/getStats', [StatController::class, 'getStats']);
                $router->get('/getServerLastRank', [StatController::class, 'getServerLastRank']);
                $router->get('/getServerYesterdayRank', [StatController::class, 'getServerYesterdayRank']);
                $router->get('/getOrder', [StatController::class, 'getOrder']);
                $router->any('/getStatUser', [StatController::class, 'getStatUser']);
                $router->get('/getRanking', [StatController::class, 'getRanking']);
                $router->get('/getStatRecord', [StatController::class, 'getStatRecord']);
                $router->get('/getTrafficRank', [StatController::class, 'getTrafficRank']);
            });

            // Notice
            $router->group([
                'prefix' => 'notice'
            ], function ($router) {
                $router->get('/fetch', [NoticeController::class, 'fetch']);
                $router->post('/save', [NoticeController::class, 'save']);
                $router->post('/update', [NoticeController::class, 'update']);
                $router->post('/drop', [NoticeController::class, 'drop']);
                $router->post('/show', [NoticeController::class, 'show']);
                $router->post('/sort', [NoticeController::class, 'sort']);
            });

            // Ticket
            $router->group([
                'prefix' => 'ticket'
            ], function ($router) {
                $router->any('/fetch', [TicketController::class, 'fetch']);
                $router->post('/reply', [TicketController::class, 'reply']);
                $router->post('/close', [TicketController::class, 'close']);
            });

            // Coupon
            $router->group([
                'prefix' => 'coupon'
            ], function ($router) {
                $router->any('/fetch', [CouponController::class, 'fetch']);
                $router->post('/generate', [CouponController::class, 'generate']);
                $router->post('/drop', [CouponController::class, 'drop']);
                $router->post('/show', [CouponController::class, 'show']);
                $router->post('/update', [CouponController::class, 'update']);
            });

            // Gift Card
            $router->group([
                'prefix' => 'gift-card'
            ], function ($router) {
                // Template management
                $router->any('/templates', [GiftCardController::class, 'templates']);
                $router->post('/create-template', [GiftCardController::class, 'createTemplate']);
                $router->post('/update-template', [GiftCardController::class, 'updateTemplate']);
                $router->post('/delete-template', [GiftCardController::class, 'deleteTemplate']);

                // Code management
                $router->post('/generate-codes', [GiftCardController::class, 'generateCodes']);
                $router->any('/codes', [GiftCardController::class, 'codes']);
                $router->post('/toggle-code', [GiftCardController::class, 'toggleCode']);
                $router->get('/export-codes', [GiftCardController::class, 'exportCodes']);
                $router->post('/update-code', [GiftCardController::class, 'updateCode']);
                $router->post('/delete-code', [GiftCardController::class, 'deleteCode']);

                // Usage records
                $router->any('/usages', [GiftCardController::class, 'usages']);

                // Statistics
                $router->any('/statistics', [GiftCardController::class, 'statistics']);
                $router->get('/types', [GiftCardController::class, 'types']);
            });

            // Group Buy
            $router->group([
                'prefix' => 'group-buy'
            ], function ($router) {
                $router->any('/fetch', [GroupBuyController::class, 'fetch']);
                $router->post('/save', [GroupBuyController::class, 'save']);
                $router->post('/update', [GroupBuyController::class, 'update']);
                $router->post('/drop', [GroupBuyController::class, 'drop']);
                $router->any('/groups', [GroupBuyController::class, 'groups']);
            });

            // Knowledge
            $router->group([
                'prefix' => 'knowledge'
            ], function ($router) {
                $router->get('/fetch', [KnowledgeController::class, 'fetch']);
                $router->get('/getCategory', [KnowledgeController::class, 'getCategory']);
                $router->post('/save', [KnowledgeController::class, 'save']);
                $router->post('/show', [KnowledgeController::class, 'show']);
                $router->post('/drop', [KnowledgeController::class, 'drop']);
                $router->post('/sort', [KnowledgeController::class, 'sort']);
            });

            // Payment  
            $router->group([
                'prefix' => 'payment'
            ], function ($router) {
                $router->get('/fetch', [PaymentController::class, 'fetch']);
                $router->get('/getPaymentMethods', [PaymentController::class, 'getPaymentMethods']);
                $router->post('/getPaymentForm', [PaymentController::class, 'getPaymentForm']);
                $router->post('/save', [PaymentController::class, 'save']);
                $router->post('/drop', [PaymentController::class, 'drop']);
                $router->post('/show', [PaymentController::class, 'show']);
                $router->post('/sort', [PaymentController::class, 'sort']);
            });

            // System
            $router->group([
                'prefix' => 'system'
            ], function ($router) {
                $router->get('/getSystemStatus', [SystemController::class, 'getSystemStatus']);
                $router->get('/getQueueStats', [SystemController::class, 'getQueueStats']);
                $router->get('/getQueueWorkload', [SystemController::class, 'getQueueWorkload']);
                $router->get('/getQueueMasters', '\\Laravel\\Horizon\\Http\\Controllers\\MasterSupervisorController@index');
                $router->get('/getHorizonFailedJobs', [SystemController::class, 'getHorizonFailedJobs']);
                $router->any('/getAuditLog', [SystemController::class, 'getAuditLog']);
            });

            // Update
            // $router->group([
            //     'prefix' => 'update'
            // ], function ($router) {
            //     $router->get('/check', [UpdateController::class, 'checkUpdate']);
            //     $router->post('/execute', [UpdateController::class, 'executeUpdate']);
            // });

            // Theme
            $router->group([
                'prefix' => 'theme'
            ], function ($router) {
                $router->get('/getThemes', [ThemeController::class, 'getThemes']);
                $router->post('/upload', [ThemeController::class, 'upload']);
                $router->post('/delete', [ThemeController::class, 'delete']);
                $router->post('/saveThemeConfig', [ThemeController::class, 'saveThemeConfig']);
                $router->post('/getThemeConfig', [ThemeController::class, 'getThemeConfig']);
            });

            // Plugin
            $router->group([
                'prefix' => 'plugin'
            ], function ($router) {
                $router->get('/types', [\App\Http\Controllers\V2\Admin\PluginController::class, 'types']);
                $router->get('/getPlugins', [\App\Http\Controllers\V2\Admin\PluginController::class, 'index']);
                $router->post('/upload', [\App\Http\Controllers\V2\Admin\PluginController::class, 'upload']);
                $router->post('/delete', [\App\Http\Controllers\V2\Admin\PluginController::class, 'delete']);
                $router->post('install', [\App\Http\Controllers\V2\Admin\PluginController::class, 'install']);
                $router->post('uninstall', [\App\Http\Controllers\V2\Admin\PluginController::class, 'uninstall']);
                $router->post('enable', [\App\Http\Controllers\V2\Admin\PluginController::class, 'enable']);
                $router->post('disable', [\App\Http\Controllers\V2\Admin\PluginController::class, 'disable']);
                $router->get('config', [\App\Http\Controllers\V2\Admin\PluginController::class, 'getConfig']);
                $router->post('config', [\App\Http\Controllers\V2\Admin\PluginController::class, 'updateConfig']);
                $router->post('upgrade', [\App\Http\Controllers\V2\Admin\PluginController::class, 'upgrade']);
            });

            // 流量重置管理
            $router->group([
                'prefix' => 'traffic-reset'
            ], function ($router) {
                $router->get('logs', [TrafficResetController::class, 'logs']);
                $router->get('stats', [TrafficResetController::class, 'stats']);
                $router->get('user/{userId}/history', [TrafficResetController::class, 'userHistory']);
                $router->post('reset-user', [TrafficResetController::class, 'resetUser']);
            });
        });

    }
}
