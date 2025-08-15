<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductImage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        
        // テスト用カテゴリとプロダクトを作成
        $category = ProductCategory::create([
            'name' => '電子機器',
            'slug' => 'electronics',
            'description' => 'テスト用電子機器カテゴリ',
            'image_url' => null,
            'sort_order' => 1,
            'is_active' => true,
        ]);

        $product = Product::create([
            'category_id' => $category->id,
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

        ProductImage::create([
            'product_id' => $product->id,
            'image_path' => '/images/test-product.jpg',
            'alt_text' => 'テスト商品画像',
            'sort_order' => 1,
            'is_primary' => true,
        ]);
    }

    public function test_can_get_products_list()
    {
        $response = $this->getJson('/api/products');

        $response->assertStatus(200)
                 ->assertJsonStructure([
                     'data' => [
                         '*' => [
                             'id',
                             'name',
                             'slug',
                             'price',
                             'compare_price',
                             'stock_quantity',
                             'is_featured',
                             'category',
                             'images'
                         ]
                     ],
                     'current_page',
                     'last_page',
                     'per_page',
                     'total'
                 ]);
    }

    public function test_can_get_single_product()
    {
        $product = Product::first();

        $response = $this->getJson("/api/products/{$product->id}");

        $response->assertStatus(200)
                 ->assertJsonStructure([
                     'id',
                     'name',
                     'slug',
                     'description',
                     'short_description',
                     'price',
                     'compare_price',
                     'sku',
                     'stock_quantity',
                     'is_featured',
                     'category',
                     'images'
                 ])
                 ->assertJson([
                     'name' => 'テストノートパソコン',
                     'slug' => 'test-notebook',
                     'price' => 89800
                 ]);
    }

    public function test_can_search_products()
    {
        $response = $this->getJson('/api/products/search?q=ノートパソコン');

        $response->assertStatus(200)
                 ->assertJsonStructure([
                     'data' => [
                         '*' => [
                             'id',
                             'name',
                             'slug',
                             'price'
                         ]
                     ]
                 ]);
    }

    public function test_can_filter_products_by_category()
    {
        $category = ProductCategory::first();

        $response = $this->getJson("/api/products?category={$category->id}");

        $response->assertStatus(200);
        
        $products = $response->json('data');
        foreach ($products as $product) {
            $this->assertEquals($category->id, $product['category']['id']);
        }
    }

    public function test_can_filter_products_by_price_range()
    {
        $response = $this->getJson('/api/products?min_price=50000&max_price=100000');

        $response->assertStatus(200);
        
        $products = $response->json('data');
        foreach ($products as $product) {
            $this->assertGreaterThanOrEqual(50000, $product['price']);
            $this->assertLessThanOrEqual(100000, $product['price']);
        }
    }

    public function test_can_sort_products()
    {
        // 複数の商品を作成
        $category = ProductCategory::first();
        
        Product::create([
            'category_id' => $category->id,
            'name' => 'テスト商品B',
            'slug' => 'test-product-b',
            'description' => 'テスト商品Bの説明',
            'short_description' => 'テスト商品B',
            'price' => 50000,
            'sku' => 'TEST-B-001',
            'stock_quantity' => 5,
            'is_featured' => false,
        ]);

        $response = $this->getJson('/api/products?sort=price_low');

        $response->assertStatus(200);
        
        $products = $response->json('data');
        $this->assertLessThanOrEqual($products[1]['price'], $products[0]['price']);
    }

    public function test_can_get_categories()
    {
        $response = $this->getJson('/api/categories');

        $response->assertStatus(200)
                 ->assertJsonStructure([
                     '*' => [
                         'id',
                         'name',
                         'slug',
                         'description',
                         'is_active'
                     ]
                 ]);
    }

    public function test_returns_404_for_nonexistent_product()
    {
        $response = $this->getJson('/api/products/99999');

        $response->assertStatus(404);
    }

    public function test_can_filter_in_stock_products()
    {
        // 在庫切れ商品を作成
        $category = ProductCategory::first();
        Product::create([
            'category_id' => $category->id,
            'name' => '在庫切れ商品',
            'slug' => 'out-of-stock-product',
            'description' => '在庫切れ商品の説明',
            'short_description' => '在庫切れ商品',
            'price' => 30000,
            'sku' => 'OUT-001',
            'stock_quantity' => 0,
            'is_featured' => false,
        ]);

        $response = $this->getJson('/api/products?in_stock=true');

        $response->assertStatus(200);
        
        $products = $response->json('data');
        foreach ($products as $product) {
            $this->assertGreaterThan(0, $product['stock_quantity']);
        }
    }
}