<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\HealthCheckController;

// ヘルスチェックAPI
Route::get('/health_check', [HealthCheckController::class, 'healthCheck']);
