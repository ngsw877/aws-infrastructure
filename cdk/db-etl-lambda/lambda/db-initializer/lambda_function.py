import json
import os
import psycopg2
from typing import Dict, Any
from aws_lambda_powertools import Logger, Metrics
from aws_lambda_powertools.metrics import MetricUnit

# 共通モジュールからインポート
from etl_common import get_db_credentials, load_sql_file

# Lambda Powertools設定
logger = Logger()
metrics = Metrics()

@logger.inject_lambda_context
@metrics.log_metrics(capture_cold_start_metric=True)
def lambda_handler(event, context):
    """
    手動実行用DB初期化Lambda関数
    """
    try:
        logger.info("Starting database initialization...")
        
        # DB初期化処理
        result = initialize_databases()
        
        logger.info("Database initialization completed successfully", extra={"result": result})
        metrics.add_metric(name="DBInitializationSuccess", unit=MetricUnit.Count, value=1)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Database initialization completed successfully',
                'result': result
            })
        }
        
    except Exception as e:
        logger.error(f"Error in DB initialization: {str(e)}")
        metrics.add_metric(name="DBInitializationError", unit=MetricUnit.Count, value=1)
        
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'message': 'Database initialization failed'
            })
        }

def initialize_databases() -> Dict[str, Any]:
    """
    ソースDBとターゲットDBを初期化
    """
    result = {}
    
    # ソースDB初期化
    logger.info("Initializing source database...")
    source_result = initialize_source_db()
    result['source_db'] = source_result
    
    # ターゲットDB初期化  
    logger.info("Initializing target database...")
    target_result = initialize_target_db()
    result['target_db'] = target_result
    
    return result

def initialize_source_db() -> Dict[str, Any]:
    """
    ソースDB（RDS PostgreSQL）の初期化
    """
    # 環境変数から接続情報取得
    host = os.environ['SOURCE_DB_HOST']
    database = os.environ['SOURCE_DB_NAME']
    secret_arn = os.environ['SOURCE_DB_SECRET_ARN']
    
    # Secrets Managerから認証情報を取得
    user, password = get_db_credentials(secret_arn)
    
    conn = psycopg2.connect(
        host=host,
        database=database,
        user=user,
        password=password,
        port=5432
    )
    
    try:
        cursor = conn.cursor()
        
        # テーブル作成SQL
        create_tables_sql = load_sql_file('create_source_tables.sql')
        
        # テーブル作成実行
        cursor.execute(create_tables_sql)
        
        # データ存在チェック
        cursor.execute("SELECT COUNT(*) FROM customers")
        customer_count = cursor.fetchone()[0]
        
        if customer_count == 0:
            # サンプルデータ挿入
            insert_sample_data(cursor)
            logger.info("Sample data inserted into source database")
        else:
            logger.info(f"Source database already has {customer_count} customers, skipping data insertion")
        
        conn.commit()
        
        # 作成されたテーブル数確認
        cursor.execute(load_sql_file('count_tables.sql'))
        table_count = cursor.fetchone()[0]
        
        return {
            'status': 'success',
            'tables_created': table_count,
            'sample_data_inserted': customer_count == 0
        }
        
    finally:
        cursor.close()
        conn.close()

def insert_sample_data(cursor):
    """
    サンプルデータの挿入
    """
    # SQLファイルから読み込んで実行
    cursor.execute(load_sql_file('insert_source_sample_data.sql'))

def initialize_target_db() -> Dict[str, Any]:
    """
    ターゲットDB（Aurora Serverless v2）の初期化
    """
    # 環境変数から接続情報取得
    host = os.environ['TARGET_DB_HOST']
    database = os.environ['TARGET_DB_NAME']
    secret_arn = os.environ['TARGET_DB_SECRET_ARN']
    
    # Secrets Managerから認証情報を取得
    user, password = get_db_credentials(secret_arn)
    
    conn = psycopg2.connect(
        host=host,
        database=database,
        user=user,
        password=password,
        port=5432
    )
    
    try:
        cursor = conn.cursor()
        
        # テーブル作成SQL
        create_tables_sql = load_sql_file('create_target_tables.sql')
        
        # ビュー作成SQL
        create_views_sql = load_sql_file('create_target_views.sql')
        
        # テーブル作成実行
        cursor.execute(create_tables_sql)
        
        # ビュー作成実行
        cursor.execute(create_views_sql)
        
        conn.commit()
        
        # 作成されたテーブル数確認
        cursor.execute(load_sql_file('count_tables.sql'))
        table_count = cursor.fetchone()[0]
        
        # 作成されたビュー数確認
        cursor.execute(load_sql_file('count_views.sql'))
        view_count = cursor.fetchone()[0]
        
        return {
            'status': 'success',
            'tables_created': table_count,
            'views_created': view_count
        }
        
    finally:
        cursor.close()
        conn.close()

