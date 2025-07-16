<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class ProductController extends Controller
{
    /**
     * 商品一覧を取得
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $tenant = $request->get('tenant');
        
        $products = Product::where('tenant_id', $tenant->id)
            ->where('status', 'active')
            ->orderBy('created_at', 'desc')
            ->get();
        
        return response()->json([
            'products' => $products->map(function ($product) {
                return [
                    'id' => $product->id,
                    'name' => $product->name,
                    'description' => $product->description,
                    'price' => $product->price,
                    'stock' => $product->stock,
                    'image_url' => $product->image_url,
                    'in_stock' => $product->stock > 0
                ];
            })
        ]);
    }
    
    /**
     * 商品詳細を取得
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $tenant = $request->get('tenant');
        
        $product = Product::where('tenant_id', $tenant->id)
            ->where('id', $id)
            ->where('status', 'active')
            ->first();
        
        if (!$product) {
            return response()->json([
                'error' => 'Product not found'
            ], 404);
        }
        
        return response()->json([
            'product' => [
                'id' => $product->id,
                'name' => $product->name,
                'description' => $product->description,
                'price' => $product->price,
                'stock' => $product->stock,
                'image_url' => $product->image_url,
                'in_stock' => $product->stock > 0,
                'created_at' => $product->created_at,
                'updated_at' => $product->updated_at
            ]
        ]);
    }
}
