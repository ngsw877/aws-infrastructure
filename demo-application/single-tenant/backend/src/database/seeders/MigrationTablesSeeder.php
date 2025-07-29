<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class MigrationTablesSeeder extends Seeder
{
    /**
     * migration_01からmigration_10までのテーブルにダミーデータを挿入します。
     */
    public function run(): void
    {
        // テーブル名のリスト
        $tables = [
            'migration_01',
            'migration_02',
            'migration_03',
            'migration_04',
            'migration_05',
            'migration_06',
            'migration_07',
            'migration_08',
            'migration_09',
            'migration_10',
        ];

        // 各テーブルにダミーデータを挿入
        foreach ($tables as $tableIndex => $table) {
            $tableNumber = str_pad($tableIndex + 1, 2, '0', STR_PAD_LEFT);
            
            // 各テーブルに10個のレコードを作成
            for ($i = 1; $i <= 10; $i++) {
                DB::table($table)->insert([
                    'name' => "テストデータ{$tableNumber}-{$i}",
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
            
            $this->command->info("{$table}テーブルにダミーデータを挿入しました。");
        }
    }
} 