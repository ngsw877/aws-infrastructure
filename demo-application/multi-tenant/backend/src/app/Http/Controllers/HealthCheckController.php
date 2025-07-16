<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class HealthCheckController extends Controller
{
    /**
     * ヘルスチェックAPI
     *
     * @return JsonResponse
     */
    public function healthCheck(): JsonResponse
    {
        try {
            DB::connection()->getPdo();
            return response()->json(
                [
                    'status'  => 'OK',
                ],
                200
            );

        } catch (\Exception $e) {
            Log::error('Database connection error in HealthCheckController', [
                'message' => $e->getMessage(),
                'exception' => $e,
            ]);
            return response()->json(
                [
                    'status'  => 'NG',
                ],
                500
            );
        }
    }
}
