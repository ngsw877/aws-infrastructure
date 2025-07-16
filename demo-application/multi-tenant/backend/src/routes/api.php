<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\HealthCheckController;
use App\Http\Controllers\DomainController;

// ヘルスチェックAPI
Route::get('/health_check', [HealthCheckController::class, 'healthCheck']);

// ドメイン取得API
Route::get('/domain', [DomainController::class, 'getCurrentDomain']);
