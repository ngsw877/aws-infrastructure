<?php

namespace Tests\Unit;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductImage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductModelTest extends TestCase
{
    use RefreshDatabase;

    protected $category;

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
    }

    public function test_can_create_product()
    {
        $productData = [
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
        ];

        $product = Product::create($productData);

        $this->assertInstanceOf(Product::class, $product);
        $this->assertEquals('テストノートパソコン', $product->name);
        $this->assertEquals(89800, $product->price);
        $this->assertTrue($product->is_featured);
        $this->assertDatabaseHas('products', $productData);
    }

    public function test_product_belongs_to_category()
    {
        $product = Product::create([
            'category_id' => $this->category->id,
            'name' => 'テスト商品',
            'slug' => 'test-product',
            'description' => 'テスト商品の説明',
            'short_description' => 'テスト商品',
            'price' => 50000,
            'sku' => 'TEST-001',
            'stock_quantity' => 5,
            'is_featured' => false,
        ]);

        $this->assertInstanceOf(ProductCategory::class, $product->category);
        $this->assertEquals($this->category->id, $product->category->id);
        $this->assertEquals('電子機器', $product->category->name);
    }

    public function test_product_has_many_images()
    {
        $product = Product::create([
            'category_id' => $this->category->id,
            'name' => 'テスト商品',
            'slug' => 'test-product',
            'description' => 'テスト商品の説明',
            'short_description' => 'テスト商品',
            'price' => 50000,
            'sku' => 'TEST-001',
            'stock_quantity' => 5,
            'is_featured' => false,
        ]);

        // 複数の画像を作成
        ProductImage::create([
            'product_id' => $product->id,
            'image_path' => '/images/test-1.jpg',
            'alt_text' => 'テスト画像1',
            'sort_order' => 1,
            'is_primary' => true,
        ]);

        ProductImage::create([
            'product_id' => $product->id,
            'image_path' => '/images/test-2.jpg',
            'alt_text' => 'テスト画像2',
            'sort_order' => 2,
            'is_primary' => false,
        ]);

        $this->assertCount(2, $product->images);
        $this->assertInstanceOf(ProductImage::class, $product->images->first());
    }

    public function test_in_stock_scope()
    {
        // 在庫ありの商品
        Product::create([
            'category_id' => $this->category->id,
            'name' => '在庫あり商品',
            'slug' => 'in-stock-product',
            'description' => '在庫あり商品',
            'short_description' => '在庫あり',
            'price' => 50000,
            'sku' => 'IN-001',
            'stock_quantity' => 10,
            'is_featured' => false,
        ]);

        // 在庫切れの商品
        Product::create([
            'category_id' => $this->category->id,
            'name' => '在庫切れ商品',
            'slug' => 'out-of-stock-product',
            'description' => '在庫切れ商品',
            'short_description' => '在庫切れ',
            'price' => 30000,
            'sku' => 'OUT-001',
            'stock_quantity' => 0,
            'is_featured' => false,
        ]);

        $inStockProducts = Product::inStock()->get();

        $this->assertCount(1, $inStockProducts);
        $this->assertEquals('在庫あり商品', $inStockProducts->first()->name);
        $this->assertGreaterThan(0, $inStockProducts->first()->stock_quantity);
    }

    public function test_featured_scope()
    {
        // フィーチャー商品
        Product::create([
            'category_id' => $this->category->id,
            'name' => 'フィーチャー商品',
            'slug' => 'featured-product',
            'description' => 'フィーチャー商品',
            'short_description' => 'フィーチャー',
            'price' => 80000,
            'sku' => 'FEAT-001',
            'stock_quantity' => 5,
            'is_featured' => true,
        ]);

        // 通常商品
        Product::create([
            'category_id' => $this->category->id,
            'name' => '通常商品',
            'slug' => 'normal-product',
            'description' => '通常商品',
            'short_description' => '通常',
            'price' => 30000,
            'sku' => 'NORM-001',
            'stock_quantity' => 10,
            'is_featured' => false,
        ]);

        $featuredProducts = Product::featured()->get();

        $this->assertCount(1, $featuredProducts);
        $this->assertEquals('フィーチャー商品', $featuredProducts->first()->name);
        $this->assertTrue($featuredProducts->first()->is_featured);
    }

    public function test_discount_percentage_accessor()
    {
        $product = Product::create([
            'category_id' => $this->category->id,
            'name' => '割引商品',
            'slug' => 'discount-product',
            'description' => '割引商品',
            'short_description' => '割引',
            'price' => 80000,
            'compare_price' => 100000,
            'sku' => 'DISC-001',
            'stock_quantity' => 5,
            'is_featured' => false,
        ]);

        $this->assertEquals(20, $product->discount_percentage);
    }

    public function test_discount_percentage_accessor_with_no_compare_price()
    {
        $product = Product::create([
            'category_id' => $this->category->id,
            'name' => '通常価格商品',
            'slug' => 'regular-product',
            'description' => '通常価格商品',
            'short_description' => '通常価格',
            'price' => 80000,
            'compare_price' => null,
            'sku' => 'REG-001',
            'stock_quantity' => 5,
            'is_featured' => false,
        ]);

        $this->assertNull($product->discount_percentage);
    }

    public function test_in_stock_accessor()
    {
        // 在庫ありの商品
        $inStockProduct = Product::create([
            'category_id' => $this->category->id,
            'name' => '在庫あり商品',
            'slug' => 'in-stock-product',
            'description' => '在庫あり商品',
            'short_description' => '在庫あり',
            'price' => 50000,
            'sku' => 'IN-001',
            'stock_quantity' => 10,
            'is_featured' => false,
        ]);

        // 在庫切れの商品
        $outOfStockProduct = Product::create([
            'category_id' => $this->category->id,
            'name' => '在庫切れ商品',
            'slug' => 'out-of-stock-product',
            'description' => '在庫切れ商品',
            'short_description' => '在庫切れ',
            'price' => 30000,
            'sku' => 'OUT-001',
            'stock_quantity' => 0,
            'is_featured' => false,
        ]);

        $this->assertTrue($inStockProduct->in_stock);
        $this->assertFalse($outOfStockProduct->in_stock);
    }

    public function test_search_scope()
    {
        Product::create([
            'category_id' => $this->category->id,
            'name' => 'MacBook Pro',
            'slug' => 'macbook-pro',
            'description' => 'Apple MacBook Pro ノートパソコン',
            'short_description' => 'MacBook Pro',
            'price' => 200000,
            'sku' => 'MAC-001',
            'stock_quantity' => 3,
            'is_featured' => true,
        ]);

        Product::create([
            'category_id' => $this->category->id,
            'name' => 'Windows ノートPC',
            'slug' => 'windows-notebook',
            'description' => 'Windows ノートパソコン',
            'short_description' => 'Windowsノート',
            'price' => 80000,
            'sku' => 'WIN-001',
            'stock_quantity' => 5,
            'is_featured' => false,
        ]);

        // 名前で検索
        $macProducts = Product::search('MacBook')->get();
        $this->assertCount(1, $macProducts);
        $this->assertEquals('MacBook Pro', $macProducts->first()->name);

        // 説明で検索
        $notebookProducts = Product::search('ノートパソコン')->get();
        $this->assertCount(2, $notebookProducts);

        // 部分一致検索
        $proProducts = Product::search('Pro')->get();
        $this->assertCount(1, $proProducts);
    }
}