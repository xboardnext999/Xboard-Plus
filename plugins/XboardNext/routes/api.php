<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\V2\Admin\StatController;
use Plugin\XboardNext\Controllers\AmountController;
use Plugin\XboardNext\Controllers\CustomController;
use Plugin\XboardNext\Controllers\PaymentController;

Route::group([
    'prefix' => 'api/v1/custom'
], function () {
    Route::get('/nodes', [CustomController::class, 'nodes'])->middleware('user');
    Route::post('/nodes/update', [CustomController::class, 'nodesUpdate'])->middleware('admin');
	Route::get('/config', [CustomController::class, 'config'])->middleware('user');
	Route::get('/users', [CustomController::class, 'users'])->middleware('admin');
	Route::get('/groups', [CustomController::class, 'groups'])->middleware('admin');
	Route::get('/coupons', [CustomController::class, 'coupons'])->middleware('admin');
	Route::get('/getStats', [StatController::class, 'getStats'])->middleware('admin');
	Route::get('/getTrafficRank', [StatController::class, 'getTrafficRank'])->middleware('admin');
    Route::get('/getCustomStats', [CustomController::class, 'getCustomStats'])->middleware('admin');
    Route::post('/amount/save', [AmountController::class, 'save'])->middleware('user');
    Route::post('/amount/checkout', [AmountController::class, 'checkout'])->middleware('user');
    Route::get('/payment/notify/{method}/{uuid}', [PaymentController::class, 'notify']);
    Route::post('/payment/notify/{method}/{uuid}', [PaymentController::class, 'notify']);
});

