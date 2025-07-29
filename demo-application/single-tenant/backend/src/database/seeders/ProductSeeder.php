<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductImage;
use Illuminate\Support\Str;

class ProductSeeder extends Seeder
{
    public function run(): void
    {
        $electronics = ProductCategory::where('slug', 'electronics')->first();
        $books = ProductCategory::where('slug', 'books')->first();
        $fashion = ProductCategory::where('slug', 'fashion')->first();
        $homeAppliances = ProductCategory::where('slug', 'home-appliances')->first();
        $foodBeverage = ProductCategory::where('slug', 'food-beverage')->first();
        $sportsOutdoor = ProductCategory::where('slug', 'sports-outdoor')->first();
        $toysGames = ProductCategory::where('slug', 'toys-games')->first();
        $beautyHealth = ProductCategory::where('slug', 'beauty-health')->first();

        $products = [
            // 電子機器
            [
                'category_id' => $electronics->id,
                'name' => 'ノートパソコン ProBook 15',
                'slug' => 'notebook-probook-15',
                'description' => '高性能なプロセッサーと大容量メモリを搭載した15インチノートパソコン。ビジネスにも趣味にも最適です。',
                'short_description' => '15インチ高性能ノートパソコン',
                'price' => 89800,
                'compare_price' => 119800,
                'sku' => 'NB-PB15-001',
                'stock_quantity' => 50,
                'is_featured' => true,
            ],
            [
                'category_id' => $electronics->id,
                'name' => 'ワイヤレスイヤホン AirPods Pro風',
                'slug' => 'wireless-earphones-pro',
                'description' => 'ノイズキャンセリング機能搭載の高音質ワイヤレスイヤホン。長時間バッテリーで快適な音楽体験を。',
                'short_description' => 'ノイズキャンセリング搭載イヤホン',
                'price' => 12800,
                'compare_price' => 15800,
                'sku' => 'WE-PRO-001',
                'stock_quantity' => 200,
                'is_featured' => true,
            ],
            [
                'category_id' => $electronics->id,
                'name' => 'スマートウォッチ FitWatch 5',
                'slug' => 'smartwatch-fitwatch-5',
                'description' => '健康管理機能充実のスマートウォッチ。心拍数、睡眠、運動量を正確に記録します。',
                'short_description' => '健康管理スマートウォッチ',
                'price' => 24800,
                'compare_price' => null,
                'sku' => 'SW-FW5-001',
                'stock_quantity' => 100,
                'is_featured' => false,
            ],

            // 本・コミック
            [
                'category_id' => $books->id,
                'name' => 'プログラミング入門書 Python編',
                'slug' => 'programming-python-book',
                'description' => 'Pythonプログラミングを基礎から学べる入門書。豊富なサンプルコードで実践的に学習できます。',
                'short_description' => 'Python入門書',
                'price' => 2980,
                'compare_price' => null,
                'sku' => 'BK-PY-001',
                'stock_quantity' => 150,
                'is_featured' => false,
            ],
            [
                'category_id' => $books->id,
                'name' => '人気漫画セット 全20巻',
                'slug' => 'manga-set-20',
                'description' => '大人気漫画の全巻セット。まとめ買いでお得に楽しめます。',
                'short_description' => '漫画全巻セット',
                'price' => 8800,
                'compare_price' => 10000,
                'sku' => 'MG-SET-001',
                'stock_quantity' => 30,
                'is_featured' => true,
            ],

            // ファッション
            [
                'category_id' => $fashion->id,
                'name' => 'カジュアルTシャツ ユニセックス',
                'slug' => 'casual-tshirt-unisex',
                'description' => 'シンプルで着心地の良いカジュアルTシャツ。どんなスタイルにも合わせやすいデザイン。',
                'short_description' => 'ユニセックスTシャツ',
                'price' => 2480,
                'compare_price' => null,
                'sku' => 'TS-UNI-001',
                'stock_quantity' => 300,
                'is_featured' => false,
            ],
            [
                'category_id' => $fashion->id,
                'name' => 'スニーカー エアマックス風',
                'slug' => 'sneakers-airmax-style',
                'description' => 'クッション性抜群のスニーカー。長時間の歩行でも疲れにくい設計です。',
                'short_description' => '快適スニーカー',
                'price' => 6980,
                'compare_price' => 8980,
                'sku' => 'SN-AM-001',
                'stock_quantity' => 80,
                'is_featured' => true,
            ],

            // 家電
            [
                'category_id' => $homeAppliances->id,
                'name' => 'ロボット掃除機 CleanBot Pro',
                'slug' => 'robot-vacuum-cleanbot-pro',
                'description' => 'AIマッピング機能搭載の高性能ロボット掃除機。スマホアプリで簡単操作。',
                'short_description' => 'AI搭載ロボット掃除機',
                'price' => 39800,
                'compare_price' => 49800,
                'sku' => 'RV-CBP-001',
                'stock_quantity' => 40,
                'is_featured' => true,
            ],
            [
                'category_id' => $homeAppliances->id,
                'name' => '電気ケトル 1.2L',
                'slug' => 'electric-kettle-1-2l',
                'description' => '素早くお湯が沸く電気ケトル。安全機能付きで安心して使用できます。',
                'short_description' => '1.2L電気ケトル',
                'price' => 3980,
                'compare_price' => null,
                'sku' => 'EK-12L-001',
                'stock_quantity' => 120,
                'is_featured' => false,
            ],

            // 食品・飲料
            [
                'category_id' => $foodBeverage->id,
                'name' => 'オーガニックコーヒー豆 1kg',
                'slug' => 'organic-coffee-beans-1kg',
                'description' => '厳選されたオーガニックコーヒー豆。豊かな香りと深い味わいを楽しめます。',
                'short_description' => 'オーガニックコーヒー豆',
                'price' => 2980,
                'compare_price' => null,
                'sku' => 'CF-ORG-001',
                'stock_quantity' => 200,
                'is_featured' => false,
            ],
            [
                'category_id' => $foodBeverage->id,
                'name' => 'プレミアムチョコレートセット',
                'slug' => 'premium-chocolate-set',
                'description' => '世界各国の高級チョコレートを集めたギフトセット。贈り物にも最適です。',
                'short_description' => '高級チョコレートセット',
                'price' => 4800,
                'compare_price' => 5800,
                'sku' => 'CH-PRM-001',
                'stock_quantity' => 60,
                'is_featured' => true,
            ],

            // スポーツ・アウトドア
            [
                'category_id' => $sportsOutdoor->id,
                'name' => 'ヨガマット 6mm厚',
                'slug' => 'yoga-mat-6mm',
                'description' => 'クッション性の高い6mm厚のヨガマット。滑りにくい素材で安定したポーズが可能。',
                'short_description' => '6mm厚ヨガマット',
                'price' => 2480,
                'compare_price' => null,
                'sku' => 'YM-6MM-001',
                'stock_quantity' => 150,
                'is_featured' => false,
            ],
            [
                'category_id' => $sportsOutdoor->id,
                'name' => 'キャンプテント 4人用',
                'slug' => 'camping-tent-4person',
                'description' => '設営簡単な4人用キャンプテント。防水性能も高く、快適なアウトドアライフを。',
                'short_description' => '4人用キャンプテント',
                'price' => 19800,
                'compare_price' => 24800,
                'sku' => 'CT-4P-001',
                'stock_quantity' => 25,
                'is_featured' => true,
            ],

            // おもちゃ・ゲーム
            [
                'category_id' => $toysGames->id,
                'name' => 'ボードゲーム ファミリーセット',
                'slug' => 'boardgame-family-set',
                'description' => '家族みんなで楽しめるボードゲームセット。5種類のゲームが入っています。',
                'short_description' => 'ファミリーボードゲーム',
                'price' => 3980,
                'compare_price' => null,
                'sku' => 'BG-FAM-001',
                'stock_quantity' => 80,
                'is_featured' => false,
            ],
            [
                'category_id' => $toysGames->id,
                'name' => 'ラジコンカー オフロード',
                'slug' => 'rc-car-offroad',
                'description' => '悪路走破性能の高いラジコンカー。最高速度40km/hの本格派。',
                'short_description' => 'オフロードラジコンカー',
                'price' => 12800,
                'compare_price' => 15800,
                'sku' => 'RC-OFF-001',
                'stock_quantity' => 35,
                'is_featured' => true,
            ],

            // 美容・健康
            [
                'category_id' => $beautyHealth->id,
                'name' => 'オールインワン化粧水 150ml',
                'slug' => 'allinone-lotion-150ml',
                'description' => '化粧水、乳液、美容液が1本になったオールインワン化粧水。忙しい朝にも便利。',
                'short_description' => 'オールインワン化粧水',
                'price' => 3480,
                'compare_price' => null,
                'sku' => 'LT-AIO-001',
                'stock_quantity' => 180,
                'is_featured' => false,
            ],
            [
                'category_id' => $beautyHealth->id,
                'name' => 'プロテインパウダー チョコレート味 1kg',
                'slug' => 'protein-powder-chocolate-1kg',
                'description' => '高品質なホエイプロテイン。美味しいチョコレート味で続けやすい。',
                'short_description' => 'チョコ味プロテイン',
                'price' => 4980,
                'compare_price' => 5980,
                'sku' => 'PP-CHO-001',
                'stock_quantity' => 90,
                'is_featured' => true,
            ],
        ];

        foreach ($products as $productData) {
            $product = Product::create($productData);
            
            // ダミー画像を追加（実際の実装では実際の画像パスを使用）
            ProductImage::create([
                'product_id' => $product->id,
                'image_path' => '/images/products/' . $product->slug . '-1.jpg',
                'alt_text' => $product->name,
                'sort_order' => 1,
                'is_primary' => true,
            ]);
            
            // 一部の商品に追加画像を追加
            if (rand(0, 1)) {
                ProductImage::create([
                    'product_id' => $product->id,
                    'image_path' => '/images/products/' . $product->slug . '-2.jpg',
                    'alt_text' => $product->name . ' - 画像2',
                    'sort_order' => 2,
                    'is_primary' => false,
                ]);
            }
        }
    }
}