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
use Aws\S3\S3Client;

class TenantSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // ローカル環境のみ、MinIOの公開設定を適用
        if (config('app.env') === 'local') {
            $this->prepareS3Bucket();
        }

        $env = config('app.env');

        if ($env === 'local') {
            $tenants = $this->localTenants();
        } elseif ($env === 'dev' || $env === 'development') {
            $tenants = $this->devTenants();
        } else {
            // 他環境では何もしない（誤投入防止）
            return;
        }

        foreach ($tenants as $tenantData) {
            $tenant = Tenant::updateOrCreate([
                'domain' => $tenantData['domain'],
            ], [
                'name' => $tenantData['name'],
                'slug' => $tenantData['slug'],
                'status' => 'active',
            ]);

            Shop::updateOrCreate([
                'tenant_id' => $tenant->id,
            ], [
                'name' => $tenantData['shop_name'],
                'description' => $tenantData['shop_description'],
                'logo_url' => null,
                'theme_settings' => $tenantData['theme_settings'],
            ]);

            foreach ($this->getProductsByTenant($tenant) as $productData) {
                Product::updateOrCreate([
                    'tenant_id' => $tenant->id,
                    'name' => $productData['name'],
                ], $productData);
            }

            Customer::updateOrCreate([
                'tenant_id' => $tenant->id,
                'email' => 'test' . $tenant->id . '@example.com',
            ], [
                'name' => 'テスト太郎' . $tenant->id,
                'phone' => '090-1234-567' . $tenant->id,
                'address' => '東京都渋谷区テスト1-2-' . $tenant->id,
            ]);
        }
    }

    private function localTenants(): array
    {
        return [
            [
                'domain' => 'localhost',
                'name' => 'デモショップ0',
                'slug' => 'demo-shop-0',
                'shop_name' => 'ファッションストア デモ0',
                'shop_description' => 'デモ用メインショップです。',
                'theme_settings' => [
                    'primary_color' => '#805ad5',
                    'secondary_color' => '#e9d8fd',
                    'font_family' => 'Noto Sans JP'
                ]
            ],
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
    }

    private function devTenants(): array
    {
        return [
            [
                'domain' => 'dev.multi-tenant-ec.sample-app.click',
                'name' => 'Devショップ sample-app',
                'slug' => 'dev-sample-app',
                'shop_name' => 'Dev サンプルEC（sample-app）',
                'shop_description' => '開発環境用のサンプルショップ（sample-appドメイン）。',
                'theme_settings' => [
                    'primary_color' => '#2563eb',
                    'secondary_color' => '#bfdbfe',
                    'font_family' => 'Noto Sans JP'
                ]
            ],
            [
                'domain' => 'dev.multi-tenant-ec.hoge-app.click',
                'name' => 'Devショップ hoge-app',
                'slug' => 'dev-hoge-app',
                'shop_name' => 'Dev サンプルEC（hoge-app）',
                'shop_description' => '開発環境用のサンプルショップ（hoge-appドメイン）。',
                'theme_settings' => [
                    'primary_color' => '#059669',
                    'secondary_color' => '#a7f3d0',
                    'font_family' => 'Noto Sans JP'
                ]
            ],
        ];
    }

    /**
     * MinIO/S3 バケットを作成し、匿名のGetObjectを許可するポリシーを適用
     */
    private function prepareS3Bucket(): void
    {
        try {
            $key = config('filesystems.disks.s3.key');
            $secret = config('filesystems.disks.s3.secret');
            $region = config('filesystems.disks.s3.region', 'us-east-1');
            $endpoint = config('filesystems.disks.s3.endpoint');
            $bucket = config('filesystems.disks.s3.bucket');
            if (!$bucket) {
                return;
            }

            $client = new S3Client([
                'version' => 'latest',
                'region' => $region,
                'credentials' => [
                    'key' => $key,
                    'secret' => $secret,
                ],
                'endpoint' => $endpoint,
                'use_path_style_endpoint' => config('filesystems.disks.s3.use_path_style_endpoint', true),
            ]);

            // バケット存在確認 → なければ作成
            try {
                $client->headBucket(['Bucket' => $bucket]);
            } catch (\Throwable $e) {
                try {
                    $client->createBucket(['Bucket' => $bucket]);
                } catch (\Throwable $_) {
                    // 作成失敗は無視（並行作成や既存など）
                }
            }

            // 公開読み取りポリシーを適用
            $policy = [
                'Version' => '2012-10-17',
                'Statement' => [[
                    'Sid' => 'AllowPublicRead',
                    'Effect' => 'Allow',
                    'Principal' => '*',
                    'Action' => ['s3:GetObject'],
                    'Resource' => sprintf('arn:aws:s3:::%s/*', $bucket),
                ]],
            ];
            try {
                $client->putBucketPolicy([
                    'Bucket' => $bucket,
                    'Policy' => json_encode($policy, JSON_UNESCAPED_SLASHES),
                ]);
            } catch (\Throwable $_) {
                // ポリシー適用失敗は無視（権限なし等）。画像URLが見えない場合のみ手動対応が必要
            }
        } catch (\Throwable $_) {
            // 何もせず（ローカル最小限運用のため）
        }
    }

    private function getProductsByTenant(Tenant $tenant): array
    {
        switch ($tenant->slug) {
            case 'dev-sample-app':
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
            case 'dev-hoge-app':
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
            case 'demo-shop-0':
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
            
            // アップロード（localはMinIOのpublic運用、非localはデフォルトACLでOAC/ポリシーに委ねる）
            if (config('app.env') === 'local') {
                $disk->put($path, file_get_contents($localPath), ['visibility' => 'public']);
            } else {
                $disk->put($path, file_get_contents($localPath));
            }
            
            // URLを生成
            $env = config('app.env');
            if ($env === 'local') {
                // ローカルはMinIOのPublicベースURLを使用（例: http://localhost:9000/multi-tenant-ec）
                $minioBase = env('MINIO_PUBLIC_BASE_URL', 'http://localhost:9000/multi-tenant-ec');
                return rtrim($minioBase, '/') . '/' . ltrim($path, '/');
            }

            // 非ローカルはCloudFrontなどの配信用ベース（ASSET_URL）を必須にする
            $assetBase = env('ASSET_URL');
            if (!empty($assetBase)) {
                return rtrim($assetBase, '/') . '/' . ltrim($path, '/');
            }
            throw new \RuntimeException('ASSET_URL is not configured for non-local environment.');
        } catch (\Exception $e) {
            // エラーが発生した場合はBase64のデフォルト画像を返す
            return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIiB2aWV3Qm94PSIwIDAgMzAwIDMwMCI+CiAgPHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSIzMDAiIGZpbGw9IiNlMmU4ZjAiLz4KICA8dGV4dCB4PSIxNTAiIHk9IjE1MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmaWxsPSIjNzE4MDk2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+5ZWG5ZOB55S75YOPPC90ZXh0Pgo8L3N2Zz4=';
        }
    }
}
