#!/usr/bin/env python3
"""
JSONファイルからDynamoDBテーブルにデータをインポートする

使用方法:
    python3 import-json-to-table.py <テーブル名>
    python3 import-json-to-table.py <テーブル名> -i custom-input.json
"""

import argparse
import boto3
import json
from decimal import Decimal
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
DEFAULT_INPUT_FILE = 'backup.json'


def json_to_dynamodb(obj):
    """JSONの数値をDynamoDBのDecimal型に変換する"""
    if isinstance(obj, dict):
        return {k: json_to_dynamodb(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [json_to_dynamodb(v) for v in obj]
    elif isinstance(obj, float):
        return Decimal(str(obj))
    elif isinstance(obj, int):
        return Decimal(obj)
    return obj


def import_table(table_name: str, input_file: Path):
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(table_name)

    print(f'インポート開始: {input_file} -> {table_name}')

    # JSONファイルから読み込み
    with open(input_file, 'r', encoding='utf-8') as f:
        items = json.load(f)

    # 数値をDecimal型に変換
    items = json_to_dynamodb(items)

    print(f'読み込み件数: {len(items)} 件')

    # テーブルに書き込み
    with table.batch_writer() as batch:
        for item in items:
            batch.put_item(Item=item)

    print(f'インポート完了: {len(items)} 件')


def main():
    parser = argparse.ArgumentParser(
        description='JSONファイルからDynamoDBテーブルにデータをインポートする'
    )
    parser.add_argument('table_name', help='インポート先のDynamoDBテーブル名')
    parser.add_argument(
        '-i', '--input',
        help=f'入力ファイルパス（デフォルト: {DEFAULT_INPUT_FILE}）'
    )

    args = parser.parse_args()

    # 入力ファイルパスの決定
    if args.input:
        input_file = Path(args.input)
    else:
        input_file = SCRIPT_DIR / DEFAULT_INPUT_FILE

    import_table(args.table_name, input_file)


if __name__ == '__main__':
    main()
