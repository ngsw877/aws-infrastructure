#!/usr/bin/env python3
"""
DynamoDBテーブル間データ移行スクリプト
SourceTableからDestinationTableにデータをコピーする
"""

import boto3

SOURCE_TABLE = 'SourceTable'
DESTINATION_TABLE = 'DestinationTable'

def migrate():
    dynamodb = boto3.resource('dynamodb')
    source = dynamodb.Table(SOURCE_TABLE)
    destination = dynamodb.Table(DESTINATION_TABLE)

    print(f'移行開始: {SOURCE_TABLE} -> {DESTINATION_TABLE}')

    # ソーステーブルからデータをスキャン
    response = source.scan()
    items = response['Items']

    # ページネーション対応（1MB以上のデータがある場合）
    while 'LastEvaluatedKey' in response:
        response = source.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
        items.extend(response['Items'])

    print(f'取得件数: {len(items)} 件')

    # ターゲットテーブルに書き込み
    with destination.batch_writer() as batch:
        for item in items:
            batch.put_item(Item=item)

    print(f'移行完了: {len(items)} 件')

if __name__ == '__main__':
    migrate()