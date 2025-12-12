#!/usr/bin/env python3
"""
DynamoDBテーブルからデータをエクスポートしてJSONファイルに保存する
数値型（Decimal）を維持した状態でエクスポート可能

使用方法:
    python3 export-table-to-json.py <テーブル名>
    python3 export-table-to-json.py <テーブル名> -o custom-output.json
"""

import argparse
import boto3
import json
from decimal import Decimal
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
DEFAULT_OUTPUT_FILE = 'backup.json'


def decimal_default(obj):
    """DynamoDBのDecimal型を数値に変換するエンコーダー"""
    if isinstance(obj, Decimal):
        # 整数なら int、小数なら float に変換
        return int(obj) if obj % 1 == 0 else float(obj)
    raise TypeError(f'Object of type {type(obj)} is not JSON serializable')


def export_table(table_name: str, output_file: Path):
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(table_name)

    print(f'エクスポート開始: {table_name}')

    # テーブルからデータをスキャン
    response = table.scan()
    items = response['Items']

    # ページネーション対応
    while 'LastEvaluatedKey' in response:
        response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
        items.extend(response['Items'])

    print(f'取得件数: {len(items)} 件')

    # JSONファイルに保存（decimal_defaultで数値型を維持）
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(items, f, default=decimal_default, ensure_ascii=False, indent=2)

    print(f'エクスポート完了: {output_file}')


def main():
    parser = argparse.ArgumentParser(
        description='DynamoDBテーブルからデータをエクスポートしてJSONファイルに保存する'
    )
    parser.add_argument('table_name', help='エクスポートするDynamoDBテーブル名')
    parser.add_argument(
        '-o', '--output',
        help=f'出力ファイルパス（デフォルト: {DEFAULT_OUTPUT_FILE}）'
    )

    args = parser.parse_args()

    # 出力ファイルパスの決定
    if args.output:
        output_file = Path(args.output)
    else:
        output_file = SCRIPT_DIR / DEFAULT_OUTPUT_FILE

    export_table(args.table_name, output_file)


if __name__ == '__main__':
    main()
