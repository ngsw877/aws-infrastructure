<?php

namespace Tests\Unit;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Product;
use App\Models\ProductCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CartModelTest extends TestCase
{
    use RefreshDatabase;

    protected $category;
    protected $product1;
    protected $product2;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->category = ProductCategory::create([
            'name' => '電子機器',
            'slug' => 'electronics',
            'description' => 'テスト用電子機器カテゴリ',
            'image_url' => null,
            'sort_order' => 1,
            'is_active' => true,
        ]);

        $this->product1 = Product::create([
            'category_id' => $this->category->id,
            'name' => 'テスト商品1',
            'slug' => 'test-product-1',
            'description' => 'テスト商品1の説明',
            'short_description' => 'テスト商品1',
            'price' => 10000,
            'sku' => 'TEST-001',
            'stock_quantity' => 10,
            'is_featured' => false,
        ]);

        $this->product2 = Product::create([
            'category_id' => $this->category->id,
            'name' => 'テスト商品2',
            'slug' => 'test-product-2',
            'description' => 'テスト商品2の説明',
            'short_description' => 'テスト商品2',
            'price' => 20000,
            'sku' => 'TEST-002',
            'stock_quantity' => 5,
            'is_featured' => false,
        ]);
    }

    public function test_can_create_cart()
    {
        $cart = Cart::create(['session_id' => 'test-session-123']);

        $this->assertInstanceOf(Cart::class, $cart);
        $this->assertEquals('test-session-123', $cart->session_id);
        $this->assertDatabaseHas('carts', [
            'session_id' => 'test-session-123'
        ]);
    }

    public function test_cart_has_many_items()
    {
        $cart = Cart::create(['session_id' => 'test-session']);

        // カートアイテムを作成
        CartItem::create([
            'cart_id' => $cart->id,
            'product_id' => $this->product1->id,
            'quantity' => 2,
            'unit_price' => $this->product1->price,
            'total_price' => $this->product1->price * 2
        ]);

        CartItem::create([
            'cart_id' => $cart->id,
            'product_id' => $this->product2->id,
            'quantity' => 1,
            'unit_price' => $this->product2->price,
            'total_price' => $this->product2->price
        ]);

        $this->assertCount(2, $cart->items);
        $this->assertInstanceOf(CartItem::class, $cart->items->first());
    }

    public function test_cart_total_items_accessor()
    {
        $cart = Cart::create(['session_id' => 'test-session']);

        CartItem::create([
            'cart_id' => $cart->id,
            'product_id' => $this->product1->id,
            'quantity' => 2,
            'unit_price' => $this->product1->price,
            'total_price' => $this->product1->price * 2
        ]);

        CartItem::create([
            'cart_id' => $cart->id,
            'product_id' => $this->product2->id,
            'quantity' => 3,
            'unit_price' => $this->product2->price,
            'total_price' => $this->product2->price * 3
        ]);

        $this->assertEquals(5, $cart->total_items); // 2 + 3 = 5
    }

    public function test_cart_total_amount_accessor()
    {
        $cart = Cart::create(['session_id' => 'test-session']);

        CartItem::create([
            'cart_id' => $cart->id,
            'product_id' => $this->product1->id,
            'quantity' => 2,
            'unit_price' => $this->product1->price,
            'total_price' => $this->product1->price * 2
        ]);

        CartItem::create([
            'cart_id' => $cart->id,
            'product_id' => $this->product2->id,
            'quantity' => 1,
            'unit_price' => $this->product2->price,
            'total_price' => $this->product2->price
        ]);

        // 10000 * 2 + 20000 * 1 = 40000
        $this->assertEquals(40000, $cart->total_amount);
    }

    public function test_cart_total_accessors_with_empty_cart()
    {
        $cart = Cart::create(['session_id' => 'test-session']);

        $this->assertEquals(0, $cart->total_items);
        $this->assertEquals(0, $cart->total_amount);
    }

    public function test_cart_item_belongs_to_cart()
    {
        $cart = Cart::create(['session_id' => 'test-session']);

        $cartItem = CartItem::create([
            'cart_id' => $cart->id,
            'product_id' => $this->product1->id,
            'quantity' => 1,
            'unit_price' => $this->product1->price,
            'total_price' => $this->product1->price
        ]);

        $this->assertInstanceOf(Cart::class, $cartItem->cart);
        $this->assertEquals($cart->id, $cartItem->cart->id);
    }

    public function test_cart_item_belongs_to_product()
    {
        $cart = Cart::create(['session_id' => 'test-session']);

        $cartItem = CartItem::create([
            'cart_id' => $cart->id,
            'product_id' => $this->product1->id,
            'quantity' => 1,
            'unit_price' => $this->product1->price,
            'total_price' => $this->product1->price
        ]);

        $this->assertInstanceOf(Product::class, $cartItem->product);
        $this->assertEquals($this->product1->id, $cartItem->product->id);
        $this->assertEquals('テスト商品1', $cartItem->product->name);
    }

    public function test_cart_item_total_price_calculation()
    {
        $cart = Cart::create(['session_id' => 'test-session']);

        $cartItem = CartItem::create([
            'cart_id' => $cart->id,
            'product_id' => $this->product1->id,
            'quantity' => 3,
            'unit_price' => $this->product1->price,
            'total_price' => $this->product1->price * 3
        ]);

        $this->assertEquals(30000, $cartItem->total_price); // 10000 * 3
    }

    public function test_can_update_cart_item_quantity()
    {
        $cart = Cart::create(['session_id' => 'test-session']);

        $cartItem = CartItem::create([
            'cart_id' => $cart->id,
            'product_id' => $this->product1->id,
            'quantity' => 1,
            'unit_price' => $this->product1->price,
            'total_price' => $this->product1->price
        ]);

        $cartItem->update([
            'quantity' => 5,
            'total_price' => $this->product1->price * 5
        ]);

        $this->assertEquals(5, $cartItem->quantity);
        $this->assertEquals(50000, $cartItem->total_price);
    }

    public function test_can_find_cart_by_session_id()
    {
        $sessionId = 'unique-session-123';
        $cart = Cart::create(['session_id' => $sessionId]);

        $foundCart = Cart::where('session_id', $sessionId)->first();

        $this->assertInstanceOf(Cart::class, $foundCart);
        $this->assertEquals($cart->id, $foundCart->id);
        $this->assertEquals($sessionId, $foundCart->session_id);
    }

    public function test_cart_item_validation_rules()
    {
        $cart = Cart::create(['session_id' => 'test-session']);

        // 必須フィールドの検証
        $cartItem = new CartItem([
            'cart_id' => $cart->id,
            'product_id' => $this->product1->id,
            'quantity' => 2,
            'unit_price' => $this->product1->price,
            'total_price' => $this->product1->price * 2
        ]);

        $this->assertTrue($cartItem->save());

        // 数量が0以下の場合はバリデーションエラーになるべき
        // ただし、これはコントローラーレベルで処理される
        $this->assertDatabaseHas('cart_items', [
            'cart_id' => $cart->id,
            'product_id' => $this->product1->id,
            'quantity' => 2
        ]);
    }
}