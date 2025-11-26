#!/usr/bin/env python3
"""
SampleTableからデータをエクスポートしてJSONファイルに保存する
cdk destroy前に実行する
"""

import boto3
import json
from pathlib import Path

TABLE_NAME = 'SampleTable'
OUTPUT_FILE = Path(__file__).parent / 'backup.json'

def export_table():
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(TABLE_NAME)

    print(f'エクスポート開始: {TABLE_NAME}')

    # テーブルからデータをスキャン
    response = table.scan()
    items = response['Items']

    # ページネーション対応
    while 'LastEvaluatedKey' in response:
        response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
        items.extend(response['Items'])

    print(f'取得件数: {len(items)} 件')

    # JSONファイルに保存
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(items, f, default=str, ensure_ascii=False, indent=2)

    print(f'エクスポート完了: {OUTPUT_FILE}')

if __name__ == '__main__':
    export_table()
