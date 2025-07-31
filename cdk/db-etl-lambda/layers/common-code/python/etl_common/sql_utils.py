"""
SQLファイル関連のユーティリティ
"""
import os
from aws_lambda_powertools import Logger

logger = Logger()


def load_sql_file(sql_file_name: str, base_path: str = '/var/task/sql') -> str:
    """
    SQLファイルを読み込んで文字列として返す
    
    Args:
        sql_file_name: SQLファイル名
        base_path: SQLファイルが格納されているベースパス（デフォルトはLambda実行環境のsqlディレクトリ）
    
    Returns:
        SQL文字列
    """
    try:
        sql_path = os.path.join(base_path, sql_file_name)
        
        with open(sql_path, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        logger.info(f"Loaded SQL file: {sql_file_name}")
        return sql_content
        
    except FileNotFoundError:
        logger.error(f"SQL file not found: {sql_file_name} at {sql_path}")
        raise
    except Exception as e:
        logger.error(f"Error loading SQL file {sql_file_name}: {str(e)}")
        raise