<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Product::with(['category', 'images'])
            ->where('is_active', true);

        // カテゴリーフィルター
        if ($request->has('category')) {
            $query->where('category_id', $request->category);
        }

        // 価格範囲フィルター
        if ($request->has('min_price')) {
            $query->where('price', '>=', $request->min_price);
        }
        if ($request->has('max_price')) {
            $query->where('price', '<=', $request->max_price);
        }

        // 在庫ありのみ
        if ($request->has('in_stock') && $request->in_stock) {
            $query->where(function ($q) {
                $q->where('track_stock', false)
                    ->orWhere('stock_quantity', '>', 0);
            });
        }

        // おすすめ商品のみ
        if ($request->has('featured') && $request->featured) {
            $query->where('is_featured', true);
        }

        // ソート
        $sortBy = $request->get('sort', 'created_at');
        $sortOrder = $request->get('order', 'desc');
        
        switch ($sortBy) {
            case 'price_low':
                $query->orderBy('price', 'asc');
                break;
            case 'price_high':
                $query->orderBy('price', 'desc');
                break;
            case 'name':
                $query->orderBy('name', 'asc');
                break;
            case 'newest':
            default:
                $query->orderBy('created_at', 'desc');
                break;
        }

        $products = $query->paginate($request->get('per_page', 20));

        return response()->json($products);
    }

    public function show($id): JsonResponse
    {
        $product = Product::with(['category', 'images', 'reviews.user'])
            ->where('is_active', true)
            ->findOrFail($id);

        // ビューカウントを増やす
        $product->increment('view_count');

        // レビューの統計情報を追加
        $reviewStats = [
            'total_reviews' => $product->reviews()->where('is_approved', true)->count(),
            'average_rating' => $product->reviews()->where('is_approved', true)->avg('rating') ?? 0,
            'rating_breakdown' => []
        ];

        for ($i = 5; $i >= 1; $i--) {
            $reviewStats['rating_breakdown'][$i] = $product->reviews()
                ->where('is_approved', true)
                ->where('rating', $i)
                ->count();
        }

        return response()->json([
            'product' => $product,
            'review_stats' => $reviewStats
        ]);
    }

    public function search(Request $request): JsonResponse
    {
        $request->validate([
            'q' => 'required|string|min:2'
        ]);

        $searchTerm = $request->get('q');

        $products = Product::with(['category', 'images'])
            ->where('is_active', true)
            ->where(function ($query) use ($searchTerm) {
                $query->where('name', 'LIKE', "%{$searchTerm}%")
                    ->orWhere('description', 'LIKE', "%{$searchTerm}%")
                    ->orWhere('sku', 'LIKE', "%{$searchTerm}%");
            })
            ->orderBy('view_count', 'desc')
            ->paginate($request->get('per_page', 20));

        return response()->json($products);
    }

    public function categories(): JsonResponse
    {
        $categories = ProductCategory::where('is_active', true)
            ->with(['children' => function ($query) {
                $query->where('is_active', true)->orderBy('sort_order');
            }])
            ->whereNull('parent_id')
            ->orderBy('sort_order')
            ->get();

        return response()->json($categories);
    }
}