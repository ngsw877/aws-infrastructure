#!/usr/bin/env python3
"""
DynamoDB テーブルにサンプルデータを挿入するスクリプト
SourceTable と SampleTable の両方に同じデータを挿入する
ユーザー100人 × (PROFILE 1件 + ORDER 3件) = 400件 × 2テーブル = 800件

使用方法: python seed-data.py
"""

import boto3

TABLES = ['SourceTable', 'SampleTable']
TOTAL_USERS = 100
ORDERS_PER_USER = 3
PRODUCTS = ['Product A', 'Product B', 'Product C', 'Product D', 'Product E']


def seed_table(table_name: str):
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(table_name)

    print('=' * 50)
    print(f"DynamoDB テーブル '{table_name}' にデータを挿入します...")
    print(f'  ユーザー数: {TOTAL_USERS}')
    print(f'  各ユーザーの注文数: {ORDERS_PER_USER}')
    print(f'  合計: {TOTAL_USERS * (1 + ORDERS_PER_USER)} 件')
    print()

    item_count = 0

    with table.batch_writer() as batch:
        for user in range(1, TOTAL_USERS + 1):
            user_id = f'USER#{user:03d}'

            # PROFILE データ
            batch.put_item(Item={
                'id': user_id,
                'type': 'PROFILE',
                'name': f'User {user:03d}',
                'email': f'user{user:03d}@example.com',
                'age': 20 + user % 50
            })
            item_count += 1

            # ORDER データ
            for order in range(1, ORDERS_PER_USER + 1):
                batch.put_item(Item={
                    'id': user_id,
                    'type': f'ORDER#{order:03d}',
                    'product': PRODUCTS[order % 5],
                    'price': 1000 + order * 500,
                    'quantity': 1 + order % 5
                })
                item_count += 1

    print(f'完了！{table_name} に {item_count} 件のデータを挿入しました。')


def main():
    for table_name in TABLES:
        seed_table(table_name)

    print()
    print('=' * 50)
    print('全テーブルへのデータ挿入が完了しました！')
    print()
    print('データ確認コマンド:')
    print('  aws dynamodb scan --table-name SourceTable --select COUNT')
    print('  aws dynamodb scan --table-name SampleTable --select COUNT')


if __name__ == '__main__':
    main()
