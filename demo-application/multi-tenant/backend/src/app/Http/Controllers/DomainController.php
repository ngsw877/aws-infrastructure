<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DomainController extends Controller
{
    /**
     * 現在のリクエストドメインを取得
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function getCurrentDomain(Request $request): JsonResponse
    {
        $domain = $request->getHost();
        $tenant = $request->get('tenant');
        
        return response()->json([
            'domain' => $domain,
            'tenant' => $tenant ? [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'slug' => $tenant->slug
            ] : null
        ]);
    }
}