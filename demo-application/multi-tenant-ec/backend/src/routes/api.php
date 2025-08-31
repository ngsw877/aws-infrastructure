<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\HealthCheckController;
use App\Http\Controllers\DomainController;
use App\Http\Controllers\ShopController;
use App\Http\Controllers\ProductController;

// ヘルスチェックAPI（テナント識別不要）
Route::get('/health_check', [HealthCheckController::class, 'healthCheck']);

// テナント識別が必要なルート
Route::middleware(['tenant'])->group(function () {
    // ドメイン取得API
    Route::get('/domain', [DomainController::class, 'getCurrentDomain']);
    
    // ショップ情報API
    Route::get('/shop', [ShopController::class, 'show']);
    
    // 商品API
    Route::get('/products', [ProductController::class, 'index']);
    Route::get('/products/{id}', [ProductController::class, 'show']);
    Route::post('/products/{id}/image', [ProductController::class, 'uploadImage']);
});
