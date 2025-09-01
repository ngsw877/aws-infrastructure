<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Http\UploadedFile;

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

    /**
     * 商品画像をアップロードして更新
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function uploadImage(Request $request, int $id): JsonResponse
    {
        $tenant = $request->get('tenant');

        $validated = $request->validate([
            'image' => ['required', 'file', 'mimes:jpg,jpeg,png,svg', 'max:5120'], // 5MB
        ]);

        /** @var UploadedFile $file */
        $file = $validated['image'];

        $product = Product::where('tenant_id', $tenant->id)
            ->where('id', $id)
            ->first();
        if (!$product) {
            return response()->json(['error' => 'Product not found'], 404);
        }

        $path = sprintf('tenant-%d/products/%s', $tenant->id, $file->hashName());
        $disk = Storage::disk('s3');
        $disk->put($path, file_get_contents($file->getRealPath()), ['visibility' => 'public']);

        $publicUrl = $this->buildPublicUrl($path);
        $product->image_url = $publicUrl;
        $product->save();

        return response()->json([
            'id' => $product->id,
            'image_url' => $publicUrl,
        ], 201);
    }

    /**
     * 公開URLを生成（ASSET_URL/CloudFront のみ使用）
     */
    private function buildPublicUrl(string $objectPath): string
    {
        $assetBase = (string) env('ASSET_URL', '');
        $base = rtrim($assetBase, '/');
        return ($base === '' ? '/' : $base . '/') . ltrim($objectPath, '/');
    }
}
