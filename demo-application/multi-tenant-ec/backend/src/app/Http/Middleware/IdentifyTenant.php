<?php

namespace App\Http\Middleware;

use App\Models\Tenant;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class IdentifyTenant
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $domain = $request->getHost();
        
        // api.localhost -> localhost (開発環境用)
        if (str_starts_with($domain, 'api.')) {
            $domain = substr($domain, 4);
        }
        
        $tenant = Tenant::where('domain', $domain)
            ->where('status', 'active')
            ->first();
        
        if (!$tenant) {
            return response()->json([
                'error' => 'Tenant not found',
                'domain' => $domain
            ], 404);
        }
        
        // テナント情報をリクエストに追加
        $request->merge(['tenant' => $tenant]);
        $request->setUserResolver(function () use ($tenant) {
            return $tenant;
        });
        
        // グローバルスコープの設定
        app()->instance('tenant', $tenant);
        
        return $next($request);
    }
}
