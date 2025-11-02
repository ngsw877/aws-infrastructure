<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Post;
use App\Models\Like;
use App\Models\Follow;
use Illuminate\Support\Facades\Hash;

class DemoDataSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 既存データをクリア
        Like::truncate();
        Follow::truncate();
        Post::truncate();
        User::truncate();

        // デモユーザー作成
        $users = [
            [
                'name' => 'Alice',
                'email' => 'alice@example.com',
                'password' => Hash::make('password'),
                'bio' => 'Webエンジニアです。Laravel好き！',
            ],
            [
                'name' => 'Bob',
                'email' => 'bob@example.com',
                'password' => Hash::make('password'),
                'bio' => 'フロントエンドエンジニア。Vue.js使ってます。',
            ],
            [
                'name' => 'Charlie',
                'email' => 'charlie@example.com',
                'password' => Hash::make('password'),
                'bio' => 'インフラエンジニア。Dockerとk8sが好き。',
            ],
            [
                'name' => 'Diana',
                'email' => 'diana@example.com',
                'password' => Hash::make('password'),
                'bio' => 'デザイナー兼フロントエンド。',
            ],
            [
                'name' => 'Eve',
                'email' => 'eve@example.com',
                'password' => Hash::make('password'),
                'bio' => 'プロダクトマネージャー。',
            ],
        ];

        $createdUsers = [];
        foreach ($users as $userData) {
            $createdUsers[] = User::create($userData);
        }

        // 投稿作成
        $posts = [
            ['user_id' => 1, 'content' => 'こんにちは！初めての投稿です 👋'],
            ['user_id' => 1, 'content' => 'Laravel 12すごく使いやすい！'],
            ['user_id' => 2, 'content' => 'Nuxt 4の新しいディレクトリ構造いいね'],
            ['user_id' => 2, 'content' => 'Composition API最高！'],
            ['user_id' => 3, 'content' => 'Docker Composeでサクッと環境構築'],
            ['user_id' => 3, 'content' => 'MinIOでローカルS3環境構築した'],
            ['user_id' => 4, 'content' => 'デザインシステム作ってます'],
            ['user_id' => 4, 'content' => 'Figma便利すぎる'],
            ['user_id' => 5, 'content' => '新機能のリリース準備中！'],
            ['user_id' => 5, 'content' => 'ユーザーフィードバック集めてます'],
            ['user_id' => 1, 'content' => 'PHPカンファレンス行きたい'],
            ['user_id' => 2, 'content' => 'Viteのビルド速度やばい'],
            ['user_id' => 3, 'content' => 'k8s勉強中'],
        ];

        $createdPosts = [];
        foreach ($posts as $postData) {
            $createdPosts[] = Post::create($postData);
        }

        // いいね作成
        $likes = [
            ['user_id' => 2, 'post_id' => 1],
            ['user_id' => 3, 'post_id' => 1],
            ['user_id' => 4, 'post_id' => 1],
            ['user_id' => 1, 'post_id' => 3],
            ['user_id' => 1, 'post_id' => 4],
            ['user_id' => 5, 'post_id' => 2],
            ['user_id' => 2, 'post_id' => 5],
            ['user_id' => 3, 'post_id' => 7],
            ['user_id' => 4, 'post_id' => 9],
            ['user_id' => 5, 'post_id' => 11],
        ];

        foreach ($likes as $likeData) {
            Like::create($likeData);
        }

        // フォロー関係作成
        $follows = [
            ['follower_id' => 1, 'following_id' => 2],
            ['follower_id' => 1, 'following_id' => 3],
            ['follower_id' => 2, 'following_id' => 1],
            ['follower_id' => 2, 'following_id' => 3],
            ['follower_id' => 3, 'following_id' => 1],
            ['follower_id' => 4, 'following_id' => 1],
            ['follower_id' => 4, 'following_id' => 2],
            ['follower_id' => 5, 'following_id' => 1],
            ['follower_id' => 5, 'following_id' => 3],
        ];

        foreach ($follows as $followData) {
            Follow::create($followData);
        }

        $this->command->info('デモデータの作成が完了しました！');
        $this->command->info('ユーザー数: ' . count($createdUsers));
        $this->command->info('投稿数: ' . count($createdPosts));
        $this->command->info('いいね数: ' . count($likes));
        $this->command->info('フォロー数: ' . count($follows));
        $this->command->info('');
        $this->command->info('テストアカウント:');
        foreach ($users as $user) {
            $this->command->info("  {$user['email']} / password");
        }
    }
}
