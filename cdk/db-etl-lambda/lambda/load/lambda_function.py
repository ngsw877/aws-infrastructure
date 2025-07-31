import json
import os
import boto3
import psycopg2
from psycopg2.extras import execute_values
from typing import Dict, Any, List
from aws_lambda_powertools import Logger, Metrics
from aws_lambda_powertools.metrics import MetricUnit
from aws_lambda_powertools.logging import correlation_paths
import time

# 共通モジュールからインポート
from etl_common import get_db_credentials, ConnectionPool, load_sql_file

# Lambda Powertools設定
logger = Logger()
metrics = Metrics()

# クライアント初期化
s3_client = boto3.client('s3')

# グローバル接続プール
db_pool = ConnectionPool()

def read_s3_with_retry(bucket_name: str, object_key: str, max_retries: int = 3) -> Dict[str, Any]:
    """
    S3からデータを読み込み（リトライ対応）
    """
    for attempt in range(max_retries):
        try:
            response = s3_client.get_object(Bucket=bucket_name, Key=object_key)
            data = json.loads(response['Body'].read().decode('utf-8'))
            return data
        except Exception as e:
            if attempt == max_retries - 1:
                logger.error(f"Failed to read S3 object after {max_retries} attempts: {str(e)}")
                metrics.add_metric(name="S3ReadError", unit=MetricUnit.Count, value=1)
                raise
            logger.warning(f"S3 read attempt {attempt + 1} failed, retrying: {str(e)}")
            time.sleep(2 ** attempt)  # 指数バックオフ

@logger.inject_lambda_context(correlation_id_path=correlation_paths.S3_OBJECT_LAMBDA)
@metrics.log_metrics(capture_cold_start_metric=True)
def lambda_handler(event, context):
    """
    S3からデータを読み込んでAurora Serverless v2に挿入するLambda関数
    """
    try:
        # S3イベントから情報を取得（複数レコード対応）
        for record in event['Records']:
            s3_event = record['s3']
            bucket_name = s3_event['bucket']['name']
            object_key = s3_event['object']['key']
            
            logger.info(f"Processing S3 object: s3://{bucket_name}/{object_key}")
            
            # 環境変数から設定を取得
            target_db_host = os.environ['TARGET_DB_HOST']
            target_db_name = os.environ['TARGET_DB_NAME']
            secret_arn = os.environ['TARGET_DB_SECRET_ARN']
            
            # Secrets Managerから認証情報を取得
            target_db_user, target_db_password = get_db_credentials(secret_arn)
            
            # S3からデータを読み込み（リトライ対応）
            start_time = time.time()
            data = read_s3_with_retry(bucket_name, object_key)
            s3_read_time = time.time() - start_time
            
            metrics.add_metric(name="S3ReadTime", unit=MetricUnit.Seconds, value=s3_read_time)
            
            # DB接続とデータロード
            with db_pool.get_connection(target_db_host, target_db_name, target_db_user, target_db_password) as conn:
                start_time = time.time()
                load_results = load_data_to_aurora(conn, data)
                load_time = time.time() - start_time
                
                # メトリクスを記録
                metrics.add_metric(name="DataLoadTime", unit=MetricUnit.Seconds, value=load_time)
                for table, count in load_results.items():
                    metrics.add_metric(name=f"RecordsLoaded_{table}", unit=MetricUnit.Count, value=count)
            
            logger.info("Load completed successfully", extra={
                "s3_object": f"s3://{bucket_name}/{object_key}",
                "load_results": load_results,
                "load_time": load_time
            })
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'ETL load completed successfully',
                'records_processed': len(event['Records'])
            })
        }
        
    except Exception as e:
        logger.error(f"Error in load process: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e)
            })
        }

def load_data_to_aurora(conn, data: Dict[str, Any]) -> Dict[str, int]:
    """
    データをAurora Serverless v2にロード
    """
    cursor = conn.cursor()
    results = {}
    
    try:
        # 顧客分析データの挿入/更新
        if 'customer_analytics' in data and data['customer_analytics']:
            customer_count = upsert_customer_analytics(cursor, data['customer_analytics'])
            results['customer_analytics'] = customer_count
            logger.info(f"Processed {customer_count} customer analytics records")
        
        # 商品売上サマリの挿入/更新
        if 'product_sales_summary' in data and data['product_sales_summary']:
            product_count = upsert_product_sales_summary(cursor, data['product_sales_summary'])
            results['product_sales_summary'] = product_count
            logger.info(f"Processed {product_count} product sales summary records")
        
        # 日次売上サマリの挿入/更新
        if 'daily_sales_summary' in data and data['daily_sales_summary']:
            daily_count = upsert_daily_sales_summary(cursor, data['daily_sales_summary'])
            results['daily_sales_summary'] = daily_count
            logger.info(f"Processed {daily_count} daily sales summary records")
        
        conn.commit()
        
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
    
    return results

def upsert_customer_analytics(cursor, customer_data: List[Dict]) -> int:
    """
    顧客分析データのUPSERT
    """
    upsert_query = load_sql_file('upsert_customer_analytics.sql')
    
    values = [
        (
            record['customer_id'],
            record['total_orders'],
            record['total_amount'],
            record['avg_order_value'],
            record['last_order_date'],
            record['region']
        )
        for record in customer_data
    ]
    
    execute_values(cursor, upsert_query, values)
    return len(values)

def upsert_product_sales_summary(cursor, product_data: List[Dict]) -> int:
    """
    商品売上サマリのUPSERT
    """
    upsert_query = load_sql_file('upsert_product_sales_summary.sql')
    
    values = [
        (
            record['product_id'],
            record['category'],
            record['total_quantity'],
            record['total_revenue'],
            record['order_count'],
            record['date']
        )
        for record in product_data
    ]
    
    execute_values(cursor, upsert_query, values)
    return len(values)

def upsert_daily_sales_summary(cursor, daily_data: List[Dict]) -> int:
    """
    日次売上サマリのUPSERT
    """
    upsert_query = load_sql_file('upsert_daily_sales_summary.sql')
    
    values = [
        (
            record['date'],
            record['total_orders'],
            record['total_revenue'],
            record['unique_customers'],
            record['region']
        )
        for record in daily_data
    ]
    
    execute_values(cursor, upsert_query, values)
    return len(values)