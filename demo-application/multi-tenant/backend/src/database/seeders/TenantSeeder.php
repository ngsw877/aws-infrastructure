<?php

namespace Database\Seeders;

use App\Models\Tenant;
use App\Models\Shop;
use App\Models\Product;
use App\Models\Customer;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class TenantSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $tenants = [
            [
                'domain' => 'demo1.localhost',
                'name' => 'デモショップ1',
                'slug' => 'demo-shop-1',
                'shop_name' => 'ファッションストア デモ1',
                'shop_description' => '最新のファッションアイテムを取り扱うセレクトショップです。',
                'theme_settings' => [
                    'primary_color' => '#e53e3e',
                    'secondary_color' => '#fed7d7',
                    'font_family' => 'Noto Sans JP'
                ]
            ],
            [
                'domain' => 'demo2.localhost',
                'name' => 'デモショップ2',
                'slug' => 'demo-shop-2',
                'shop_name' => 'ガジェットストア デモ2',
                'shop_description' => '家電・ガジェット専門のオンラインストアです。',
                'theme_settings' => [
                    'primary_color' => '#38b2ac',
                    'secondary_color' => '#b2f5ea',
                    'font_family' => 'Noto Sans JP'
                ]
            ],
            [
                'domain' => 'demo3.localhost',
                'name' => 'デモショップ3',
                'slug' => 'demo-shop-3',
                'shop_name' => 'ライフスタイルストア デモ3',
                'shop_description' => '日用品・インテリア雑貨のオンラインストアです。',
                'theme_settings' => [
                    'primary_color' => '#48bb78',
                    'secondary_color' => '#c6f6d5',
                    'font_family' => 'Noto Sans JP'
                ]
            ]
        ];

        foreach ($tenants as $tenantData) {
            $tenant = Tenant::create([
                'domain' => $tenantData['domain'],
                'name' => $tenantData['name'],
                'slug' => $tenantData['slug'],
                'status' => 'active'
            ]);

            // ショップ情報
            $shop = Shop::create([
                'tenant_id' => $tenant->id,
                'name' => $tenantData['shop_name'],
                'description' => $tenantData['shop_description'],
                'logo_url' => null,
                'theme_settings' => $tenantData['theme_settings']
            ]);

            // テナント別のサンプル商品
            $products = $this->getProductsByTenant($tenant);
            foreach ($products as $productData) {
                Product::create(array_merge(['tenant_id' => $tenant->id], $productData));
            }

            // サンプル顧客
            Customer::create([
                'tenant_id' => $tenant->id,
                'name' => 'テスト太郎' . $tenant->id,
                'email' => 'test' . $tenant->id . '@example.com',
                'phone' => '090-1234-567' . $tenant->id,
                'address' => '東京都渋谷区テスト1-2-' . $tenant->id
            ]);
        }
    }

    private function getProductsByTenant(Tenant $tenant): array
    {
        switch ($tenant->slug) {
            case 'main-shop':
                return [
                    [
                        'name' => 'サンプル商品1',
                        'description' => 'これはサンプル商品1の説明です。',
                        'price' => 1000,
                        'stock' => 10,
                        'image_url' => $this->uploadProductImage($tenant, 'sample-product-1', 'fashion-tshirt'),
                        'status' => 'active'
                    ],
                    [
                        'name' => 'サンプル商品2',
                        'description' => 'これはサンプル商品2の説明です。',
                        'price' => 2000,
                        'stock' => 5,
                        'image_url' => $this->uploadProductImage($tenant, 'sample-product-2', 'gadget-earphone'),
                        'status' => 'active'
                    ],
                    [
                        'name' => 'サンプル商品3',
                        'description' => 'これはサンプル商品3の説明です。',
                        'price' => 3000,
                        'stock' => 0,
                        'image_url' => $this->uploadProductImage($tenant, 'sample-product-3', 'lifestyle-diffuser'),
                        'status' => 'active'
                    ]
                ];
            case 'demo-shop-1':
                return [
                    [
                        'name' => 'カジュアルTシャツ',
                        'description' => '着心地の良いコットン100%のTシャツです。',
                        'price' => 2980,
                        'stock' => 15,
                        'image_url' => $this->uploadProductImage($tenant, 'casual-tshirt', 'fashion-tshirt'),
                        'status' => 'active'
                    ],
                    [
                        'name' => 'デニムジャケット',
                        'description' => 'ヴィンテージ風デニムジャケット。',
                        'price' => 8900,
                        'stock' => 3,
                        'image_url' => $this->uploadProductImage($tenant, 'denim-jacket', 'fashion-jacket'),
                        'status' => 'active'
                    ],
                    [
                        'name' => 'スニーカー',
                        'description' => 'スタイリッシュなスニーカー。',
                        'price' => 12000,
                        'stock' => 8,
                        'image_url' => $this->uploadProductImage($tenant, 'sneakers', 'fashion-sneakers'),
                        'status' => 'active'
                    ]
                ];
            case 'demo-shop-2':
                return [
                    [
                        'name' => 'ワイヤレスイヤホン',
                        'description' => 'ノイズキャンセリング機能付きワイヤレスイヤホン。',
                        'price' => 15800,
                        'stock' => 12,
                        'image_url' => $this->uploadProductImage($tenant, 'wireless-earphone', 'gadget-earphone'),
                        'status' => 'active'
                    ],
                    [
                        'name' => 'スマートウォッチ',
                        'description' => '健康管理機能付きスマートウォッチ。',
                        'price' => 28000,
                        'stock' => 7,
                        'image_url' => $this->uploadProductImage($tenant, 'smart-watch', 'gadget-watch'),
                        'status' => 'active'
                    ],
                    [
                        'name' => 'モバイルバッテリー',
                        'description' => '10000mAh大容量モバイルバッテリー。',
                        'price' => 3200,
                        'stock' => 25,
                        'image_url' => $this->uploadProductImage($tenant, 'mobile-battery', 'gadget-battery'),
                        'status' => 'active'
                    ]
                ];
            case 'demo-shop-3':
                return [
                    [
                        'name' => 'アロマディフューザー',
                        'description' => '超音波式アロマディフューザー、7色LEDライト付き。',
                        'price' => 4500,
                        'stock' => 20,
                        'image_url' => $this->uploadProductImage($tenant, 'aroma-diffuser', 'lifestyle-diffuser'),
                        'status' => 'active'
                    ],
                    [
                        'name' => 'クッションカバー',
                        'description' => '北欧風デザインのクッションカバー45×45cm。',
                        'price' => 1800,
                        'stock' => 30,
                        'image_url' => $this->uploadProductImage($tenant, 'cushion-cover', 'lifestyle-cushion'),
                        'status' => 'active'
                    ],
                    [
                        'name' => '収納ボックス',
                        'description' => '折りたたみ式布製収納ボックス3個セット。',
                        'price' => 2400,
                        'stock' => 15,
                        'image_url' => $this->uploadProductImage($tenant, 'storage-box', 'lifestyle-storage'),
                        'status' => 'active'
                    ]
                ];
            default:
                return [];
        }
    }
    
    /**
     * シード用画像をMinIOにアップロード
     *
     * @param Tenant $tenant
     * @param string $productSlug
     * @param string $imageName
     * @return string|null
     */
    private function uploadProductImage(Tenant $tenant, string $productSlug, string $imageName): ?string
    {
        $localPath = __DIR__ . "/images/products/{$imageName}.svg";
        
        if (!file_exists($localPath)) {
            // 画像ファイルが存在しない場合はBase64のデフォルト画像を返す
            return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIiB2aWV3Qm94PSIwIDAgMzAwIDMwMCI+CiAgPHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSIzMDAiIGZpbGw9IiNlMmU4ZjAiLz4KICA8dGV4dCB4PSIxNTAiIHk9IjE1MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmaWxsPSIjNzE4MDk2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+5ZWG5ZOB55S75YOPPC90ZXh0Pgo8L3N2Zz4=';
        }
        
        try {
            // MinIOのバケットを作成（既存の場合はスキップ）
            $disk = Storage::disk('s3');
            $bucket = config('filesystems.disks.s3.bucket');
            
            // ファイル名を生成
            $filename = Str::slug($productSlug) . '-' . time() . '.svg';
            $path = "tenant-{$tenant->id}/products/{$filename}";
            
            // ファイルをアップロード
            $disk->put($path, file_get_contents($localPath), 'public');
            
            // URLを生成
            return $disk->url($path);
        } catch (\Exception $e) {
            // エラーが発生した場合はBase64のデフォルト画像を返す
            return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIiB2aWV3Qm94PSIwIDAgMzAwIDMwMCI+CiAgPHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSIzMDAiIGZpbGw9IiNlMmU4ZjAiLz4KICA8dGV4dCB4PSIxNTAiIHk9IjE1MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmaWxsPSIjNzE4MDk2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+5ZWG5ZOB55S75YOPPC90ZXh0Pgo8L3N2Zz4=';
        }
    }
}
