<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Cart;
use App\Models\CartItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CartApiTest extends TestCase
{
    use RefreshDatabase;

    protected $product;
    protected $category;

    protected function setUp(): void
    {
        parent::setUp();
        
        // テスト用カテゴリとプロダクトを作成
        $this->category = ProductCategory::create([
            'name' => '電子機器',
            'slug' => 'electronics',
            'description' => 'テスト用電子機器カテゴリ',
            'image_url' => null,
            'sort_order' => 1,
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'category_id' => $this->category->id,
            'name' => 'テストノートパソコン',
            'slug' => 'test-notebook',
            'description' => 'テスト用ノートパソコンの説明',
            'short_description' => 'テスト用ノートPC',
            'price' => 89800,
            'compare_price' => 119800,
            'sku' => 'TEST-NB-001',
            'stock_quantity' => 10,
            'is_featured' => true,
        ]);
    }

    public function test_can_add_item_to_cart()
    {
        $response = $this->postJson('/api/cart/items', [
            'product_id' => $this->product->id,
            'quantity' => 2
        ]);

        $response->assertStatus(201)
                 ->assertJsonStructure([
                     'message',
                     'cart_item' => [
                         'id',
                         'cart_id',
                         'product_id',
                         'quantity',
                         'unit_price',
                         'total_price',
                         'product'
                     ]
                 ]);

        // データベースに保存されているか確認
        $this->assertDatabaseHas('cart_items', [
            'product_id' => $this->product->id,
            'quantity' => 2,
            'unit_price' => 89800
        ]);
    }

    public function test_can_get_cart_contents()
    {
        // カートアイテムを事前に作成
        $cart = Cart::create(['session_id' => 'test-session']);
        CartItem::create([
            'cart_id' => $cart->id,
            'product_id' => $this->product->id,
            'quantity' => 1,
            'unit_price' => $this->product->price,
            'total_price' => $this->product->price
        ]);

        $response = $this->withSession(['cart_id' => $cart->id])
                         ->getJson('/api/cart');

        $response->assertStatus(200)
                 ->assertJsonStructure([
                     'items' => [
                         '*' => [
                             'id',
                             'quantity',
                             'unit_price',
                             'total_price',
                             'product' => [
                                 'id',
                                 'name',
                                 'slug',
                                 'price'
                             ]
                         ]
                     ],
                     'total_items',
                     'total_amount'
                 ]);
    }

    public function test_can_update_cart_item_quantity()
    {
        // カートアイテムを事前に作成
        $cart = Cart::create(['session_id' => 'test-session']);
        $cartItem = CartItem::create([
            'cart_id' => $cart->id,
            'product_id' => $this->product->id,
            'quantity' => 1,
            'unit_price' => $this->product->price,
            'total_price' => $this->product->price
        ]);

        $response = $this->withSession(['cart_id' => $cart->id])
                         ->putJson("/api/cart/items/{$cartItem->id}", [
                             'quantity' => 3
                         ]);

        $response->assertStatus(200)
                 ->assertJsonStructure([
                     'message',
                     'cart_item'
                 ]);

        // データベースが更新されているか確認
        $this->assertDatabaseHas('cart_items', [
            'id' => $cartItem->id,
            'quantity' => 3,
            'total_price' => $this->product->price * 3
        ]);
    }

    public function test_can_remove_cart_item()
    {
        // カートアイテムを事前に作成
        $cart = Cart::create(['session_id' => 'test-session']);
        $cartItem = CartItem::create([
            'cart_id' => $cart->id,
            'product_id' => $this->product->id,
            'quantity' => 1,
            'unit_price' => $this->product->price,
            'total_price' => $this->product->price
        ]);

        $response = $this->withSession(['cart_id' => $cart->id])
                         ->deleteJson("/api/cart/items/{$cartItem->id}");

        $response->assertStatus(200)
                 ->assertJson([
                     'message' => 'カートから商品を削除しました'
                 ]);

        // データベースから削除されているか確認
        $this->assertDatabaseMissing('cart_items', [
            'id' => $cartItem->id
        ]);
    }

    public function test_can_clear_cart()
    {
        // 複数のカートアイテムを作成
        $cart = Cart::create(['session_id' => 'test-session']);
        CartItem::create([
            'cart_id' => $cart->id,
            'product_id' => $this->product->id,
            'quantity' => 1,
            'unit_price' => $this->product->price,
            'total_price' => $this->product->price
        ]);

        $product2 = Product::create([
            'category_id' => $this->category->id,
            'name' => 'テスト商品2',
            'slug' => 'test-product-2',
            'description' => 'テスト商品2の説明',
            'short_description' => 'テスト商品2',
            'price' => 50000,
            'sku' => 'TEST-2-001',
            'stock_quantity' => 5,
            'is_featured' => false,
        ]);

        CartItem::create([
            'cart_id' => $cart->id,
            'product_id' => $product2->id,
            'quantity' => 2,
            'unit_price' => $product2->price,
            'total_price' => $product2->price * 2
        ]);

        $response = $this->withSession(['cart_id' => $cart->id])
                         ->deleteJson('/api/cart');

        $response->assertStatus(200)
                 ->assertJson([
                     'message' => 'カートをクリアしました'
                 ]);

        // すべてのカートアイテムが削除されているか確認
        $this->assertDatabaseMissing('cart_items', [
            'cart_id' => $cart->id
        ]);
    }

    public function test_cannot_add_out_of_stock_product_to_cart()
    {
        // 在庫切れ商品を作成
        $outOfStockProduct = Product::create([
            'category_id' => $this->category->id,
            'name' => '在庫切れ商品',
            'slug' => 'out-of-stock',
            'description' => '在庫切れ商品',
            'short_description' => '在庫切れ',
            'price' => 30000,
            'sku' => 'OUT-001',
            'stock_quantity' => 0,
            'is_featured' => false,
        ]);

        $response = $this->postJson('/api/cart/items', [
            'product_id' => $outOfStockProduct->id,
            'quantity' => 1
        ]);

        $response->assertStatus(400)
                 ->assertJson([
                     'error' => '商品の在庫が不足しています'
                 ]);
    }

    public function test_cannot_add_more_than_available_stock()
    {
        $response = $this->postJson('/api/cart/items', [
            'product_id' => $this->product->id,
            'quantity' => 15  // 在庫は10個なので15個は追加できない
        ]);

        $response->assertStatus(400)
                 ->assertJson([
                     'error' => '商品の在庫が不足しています'
                 ]);
    }

    public function test_cart_item_validation()
    {
        // 商品IDなしでリクエスト
        $response = $this->postJson('/api/cart/items', [
            'quantity' => 1
        ]);

        $response->assertStatus(422)
                 ->assertJsonValidationErrors(['product_id']);

        // 数量なしでリクエスト
        $response = $this->postJson('/api/cart/items', [
            'product_id' => $this->product->id
        ]);

        $response->assertStatus(422)
                 ->assertJsonValidationErrors(['quantity']);

        // 無効な数量でリクエスト
        $response = $this->postJson('/api/cart/items', [
            'product_id' => $this->product->id,
            'quantity' => 0
        ]);

        $response->assertStatus(422)
                 ->assertJsonValidationErrors(['quantity']);
    }

    public function test_returns_empty_cart_when_no_items()
    {
        $response = $this->getJson('/api/cart');

        $response->assertStatus(200)
                 ->assertJson([
                     'items' => [],
                     'total_items' => 0,
                     'total_amount' => 0
                 ]);
    }
}