#!/usr/bin/env python3
"""
JSONファイルからSampleTableにデータをインポートする
cdk deploy後に実行する
"""

import boto3
import json
from pathlib import Path

TABLE_NAME = 'SampleTable'
INPUT_FILE = Path(__file__).parent / 'backup.json'

def import_table():
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(TABLE_NAME)

    print(f'インポート開始: {INPUT_FILE} -> {TABLE_NAME}')

    # JSONファイルから読み込み
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        items = json.load(f)

    print(f'読み込み件数: {len(items)} 件')

    # テーブルに書き込み
    with table.batch_writer() as batch:
        for item in items:
            batch.put_item(Item=item)

    print(f'インポート完了: {len(items)} 件')

if __name__ == '__main__':
    import_table()
