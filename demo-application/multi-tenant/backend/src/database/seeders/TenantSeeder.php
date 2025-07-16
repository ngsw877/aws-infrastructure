<?php

namespace Database\Seeders;

use App\Models\Tenant;
use App\Models\Shop;
use App\Models\Product;
use App\Models\Customer;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

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
            $products = $this->getProductsByTenant($tenant->slug);
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

    private function getProductsByTenant($slug): array
    {
        switch ($slug) {
            case 'demo-shop-1':
                return [
                    [
                        'name' => 'カジュアルTシャツ',
                        'description' => '着心地の良いコットン100%のTシャツです。',
                        'price' => 2980,
                        'stock' => 15,
                        'image_url' => 'https://via.placeholder.com/300x300?text=T-shirt',
                        'status' => 'active'
                    ],
                    [
                        'name' => 'デニムジャケット',
                        'description' => 'ヴィンテージ風デニムジャケット。',
                        'price' => 8900,
                        'stock' => 3,
                        'image_url' => 'https://via.placeholder.com/300x300?text=Jacket',
                        'status' => 'active'
                    ],
                    [
                        'name' => 'スニーカー',
                        'description' => 'スタイリッシュなスニーカー。',
                        'price' => 12000,
                        'stock' => 8,
                        'image_url' => 'https://via.placeholder.com/300x300?text=Sneakers',
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
                        'image_url' => 'https://via.placeholder.com/300x300?text=Earphones',
                        'status' => 'active'
                    ],
                    [
                        'name' => 'スマートウォッチ',
                        'description' => '健康管理機能付きスマートウォッチ。',
                        'price' => 28000,
                        'stock' => 7,
                        'image_url' => 'https://via.placeholder.com/300x300?text=Watch',
                        'status' => 'active'
                    ],
                    [
                        'name' => 'モバイルバッテリー',
                        'description' => '10000mAh大容量モバイルバッテリー。',
                        'price' => 3200,
                        'stock' => 25,
                        'image_url' => 'https://via.placeholder.com/300x300?text=Battery',
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
                        'image_url' => 'https://via.placeholder.com/300x300?text=Diffuser',
                        'status' => 'active'
                    ],
                    [
                        'name' => 'クッションカバー',
                        'description' => '北欧風デザインのクッションカバー45×45cm。',
                        'price' => 1800,
                        'stock' => 30,
                        'image_url' => 'https://via.placeholder.com/300x300?text=Cushion',
                        'status' => 'active'
                    ],
                    [
                        'name' => '収納ボックス',
                        'description' => '折りたたみ式布製収納ボックス3個セット。',
                        'price' => 2400,
                        'stock' => 15,
                        'image_url' => 'https://via.placeholder.com/300x300?text=Storage',
                        'status' => 'active'
                    ]
                ];
            default:
                return [];
        }
    }
}
