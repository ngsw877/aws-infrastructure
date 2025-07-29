<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class CartController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $cart = $this->getOrCreateCart($request);
        
        $cart->load(['items.product.images']);

        return response()->json([
            'cart' => $cart,
            'subtotal' => $cart->subtotal,
            'total_items' => $cart->total_items
        ]);
    }

    public function addItem(Request $request): JsonResponse
    {
        $request->validate([
            'product_id' => 'required|exists:products,id',
            'quantity' => 'required|integer|min:1'
        ]);

        $cart = $this->getOrCreateCart($request);
        $product = Product::findOrFail($request->product_id);

        // 在庫チェック
        if ($product->track_stock && $product->stock_quantity < $request->quantity) {
            return response()->json([
                'error' => 'Insufficient stock'
            ], 400);
        }

        // 既存のカートアイテムをチェック
        $cartItem = $cart->items()->where('product_id', $product->id)->first();

        DB::beginTransaction();
        try {
            if ($cartItem) {
                // 既存のアイテムの数量を更新
                $newQuantity = $cartItem->quantity + $request->quantity;
                
                // 再度在庫チェック
                if ($product->track_stock && $product->stock_quantity < $newQuantity) {
                    return response()->json([
                        'error' => 'Insufficient stock'
                    ], 400);
                }
                
                $cartItem->update([
                    'quantity' => $newQuantity,
                    'price' => $product->price
                ]);
            } else {
                // 新しいアイテムを追加
                $cartItem = $cart->items()->create([
                    'product_id' => $product->id,
                    'quantity' => $request->quantity,
                    'price' => $product->price
                ]);
            }

            DB::commit();

            $cart->load(['items.product.images']);

            return response()->json([
                'message' => 'Item added to cart',
                'cart' => $cart,
                'subtotal' => $cart->subtotal,
                'total_items' => $cart->total_items
            ]);
        } catch (\Exception $e) {
            DB::rollback();
            return response()->json([
                'error' => 'Failed to add item to cart'
            ], 500);
        }
    }

    public function updateItem(Request $request, $itemId): JsonResponse
    {
        $request->validate([
            'quantity' => 'required|integer|min:0'
        ]);

        $cart = $this->getOrCreateCart($request);
        $cartItem = $cart->items()->findOrFail($itemId);

        if ($request->quantity === 0) {
            $cartItem->delete();
            $message = 'Item removed from cart';
        } else {
            // 在庫チェック
            if ($cartItem->product->track_stock && $cartItem->product->stock_quantity < $request->quantity) {
                return response()->json([
                    'error' => 'Insufficient stock'
                ], 400);
            }

            $cartItem->update([
                'quantity' => $request->quantity,
                'price' => $cartItem->product->price
            ]);
            $message = 'Cart updated';
        }

        $cart->load(['items.product.images']);

        return response()->json([
            'message' => $message,
            'cart' => $cart,
            'subtotal' => $cart->subtotal,
            'total_items' => $cart->total_items
        ]);
    }

    public function removeItem(Request $request, $itemId): JsonResponse
    {
        $cart = $this->getOrCreateCart($request);
        $cartItem = $cart->items()->findOrFail($itemId);
        
        $cartItem->delete();

        $cart->load(['items.product.images']);

        return response()->json([
            'message' => 'Item removed from cart',
            'cart' => $cart,
            'subtotal' => $cart->subtotal,
            'total_items' => $cart->total_items
        ]);
    }

    public function clear(Request $request): JsonResponse
    {
        $cart = $this->getOrCreateCart($request);
        $cart->items()->delete();

        return response()->json([
            'message' => 'Cart cleared',
            'cart' => $cart,
            'subtotal' => 0,
            'total_items' => 0
        ]);
    }

    private function getOrCreateCart(Request $request): Cart
    {
        if (Auth::check()) {
            // ログインユーザーの場合
            $cart = Cart::firstOrCreate(
                ['user_id' => Auth::id()],
                []
            );
        } else {
            // ゲストユーザーの場合
            $sessionId = $request->session()->getId();
            $cart = Cart::firstOrCreate(
                ['session_id' => $sessionId],
                []
            );
        }

        return $cart;
    }
}