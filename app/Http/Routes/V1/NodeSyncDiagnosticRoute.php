<?php

namespace App\Http\Routes\V1;

use App\Http\Controllers\V2\Admin\NodeSyncDiagnosticController;
use Illuminate\Contracts\Routing\Registrar;

class NodeSyncDiagnosticRoute
{
    public function map(Registrar $router): void
    {
        $router->group([
            'prefix' => 'node-sync-diagnostic',
        ], function ($router) {
            $router->get('/dashboard', [NodeSyncDiagnosticController::class, 'dashboard']);
            $router->get('/summary', [NodeSyncDiagnosticController::class, 'summary']);
            $router->get('/check', [NodeSyncDiagnosticController::class, 'check']);
            $router->get('/node-users', [NodeSyncDiagnosticController::class, 'nodeUsers']);
            $router->get('/access', [NodeSyncDiagnosticController::class, 'nodeAccess']);
        });
    }
}
