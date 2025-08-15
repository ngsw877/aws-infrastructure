<?php

namespace App\Http\Controllers;

use App\Models\Shop;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class ShopController extends Controller
{
    /**
     * 現在のテナントのショップ情報を取得
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function show(Request $request): JsonResponse
    {
        $tenant = $request->get('tenant');
        
        $shop = Shop::where('tenant_id', $tenant->id)
            ->with('tenant')
            ->first();
        
        if (!$shop) {
            return response()->json([
                'error' => 'Shop not found'
            ], 404);
        }
        
        return response()->json([
            'shop' => [
                'id' => $shop->id,
                'name' => $shop->name,
                'description' => $shop->description,
                'logo_url' => $shop->logo_url,
                'theme_settings' => $shop->theme_settings,
                'tenant' => [
                    'id' => $shop->tenant->id,
                    'name' => $shop->tenant->name,
                    'domain' => $shop->tenant->domain
                ]
            ]
        ]);
    }
}
