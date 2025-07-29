<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\ProductCategory;

class ProductCategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            [
                'name' => '電子機器',
                'slug' => 'electronics',
                'description' => 'パソコン、スマートフォン、タブレットなど',
                'sort_order' => 1,
            ],
            [
                'name' => '本・コミック',
                'slug' => 'books',
                'description' => '書籍、雑誌、コミックなど',
                'sort_order' => 2,
            ],
            [
                'name' => 'ファッション',
                'slug' => 'fashion',
                'description' => '服、靴、アクセサリーなど',
                'sort_order' => 3,
            ],
            [
                'name' => '家電',
                'slug' => 'home-appliances',
                'description' => '生活家電、キッチン家電など',
                'sort_order' => 4,
            ],
            [
                'name' => '食品・飲料',
                'slug' => 'food-beverage',
                'description' => '食料品、飲み物、お菓子など',
                'sort_order' => 5,
            ],
            [
                'name' => 'スポーツ・アウトドア',
                'slug' => 'sports-outdoor',
                'description' => 'スポーツ用品、アウトドア用品など',
                'sort_order' => 6,
            ],
            [
                'name' => 'おもちゃ・ゲーム',
                'slug' => 'toys-games',
                'description' => 'おもちゃ、ゲーム、ホビー用品など',
                'sort_order' => 7,
            ],
            [
                'name' => '美容・健康',
                'slug' => 'beauty-health',
                'description' => '化粧品、健康食品、医薬品など',
                'sort_order' => 8,
            ],
        ];

        foreach ($categories as $category) {
            ProductCategory::create($category);
        }
    }
}