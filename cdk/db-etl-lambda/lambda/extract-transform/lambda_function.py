import json
import os
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, Any
from aws_lambda_powertools import Logger, Metrics
from aws_lambda_powertools.metrics import MetricUnit
from aws_lambda_powertools.logging import correlation_paths
import time
import boto3

# 共通モジュールからインポート
from etl_common import get_db_credentials, ConnectionPool, load_sql_file

# Lambda Powertools設定
logger = Logger()
metrics = Metrics()

# グローバル接続プール
db_pool = ConnectionPool()

@logger.inject_lambda_context(correlation_id_path=correlation_paths.EVENT_BRIDGE)
@metrics.log_metrics(capture_cold_start_metric=True)
def lambda_handler(event, context):
    """
    RDSからデータを抽出・変換してS3に保存するLambda関数
    """
    try:
        # 環境変数から設定を取得
        source_db_host = os.environ['SOURCE_DB_HOST']
        source_db_name = os.environ['SOURCE_DB_NAME']
        secret_arn = os.environ['SOURCE_DB_SECRET_ARN']
        s3_bucket = os.environ['S3_BUCKET']
        
        # Secrets Managerから認証情報を取得
        source_db_user, source_db_password = get_db_credentials(secret_arn)
        
        # 処理対象日の設定（前日）
        target_date = datetime.now().date() - timedelta(days=1)
        logger.info(f"Processing data for date: {target_date}")
        
        # DB接続とETL処理
        with db_pool.get_connection(source_db_host, source_db_name, source_db_user, source_db_password) as conn:
            # ETL処理を実行
            start_time = time.time()
            extracted_data = extract_transform_data(conn, target_date)
            extraction_time = time.time() - start_time
            
            # メトリクスを記録
            metrics.add_metric(name="ExtractionTime", unit=MetricUnit.Seconds, value=extraction_time)
            metrics.add_metric(name="RecordsExtracted", unit=MetricUnit.Count, value=len(extracted_data))
        
        # S3に保存
        s3_key = save_to_s3(extracted_data, s3_bucket, target_date)
        
        logger.info(f"ETL completed successfully for {target_date}", extra={
            "s3_key": s3_key,
            "records_processed": len(extracted_data),
            "extraction_time": extraction_time
        })
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'ETL extract-transform completed successfully',
                's3_key': s3_key,
                'processed_date': str(target_date),
                'records_processed': len(extracted_data)
            })
        }
        
    except Exception as e:
        logger.error(f"Error in ETL process: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e)
            })
        }

def extract_transform_data(conn, target_date) -> Dict[str, Any]:
    """
    データの抽出・変換処理
    """
    logger.info("Starting data extraction and transformation")
    
    # SQLファイルから読み込み
    customer_analytics_query = load_sql_file('customer_analytics.sql')
    product_sales_query = load_sql_file('product_sales.sql')
    daily_sales_query = load_sql_file('daily_sales.sql')
    
    # データフレームに変換
    customer_analytics_df = pd.read_sql(customer_analytics_query, conn, params=[target_date, target_date])
    product_sales_df = pd.read_sql(product_sales_query, conn, params=[target_date, target_date, target_date])
    daily_sales_df = pd.read_sql(daily_sales_query, conn, params=[target_date, target_date, target_date])
    
    logger.info(f"Extracted {len(customer_analytics_df)} customer records")
    logger.info(f"Extracted {len(product_sales_df)} product records")
    logger.info(f"Extracted {len(daily_sales_df)} daily sales records")
    
    return {
        'customer_analytics': customer_analytics_df.to_dict('records'),
        'product_sales_summary': product_sales_df.to_dict('records'),
        'daily_sales_summary': daily_sales_df.to_dict('records')
    }

def save_to_s3(data: Dict[str, Any], bucket: str, target_date) -> str:
    """
    変換されたデータをS3に保存
    """
    s3_client = boto3.client('s3')
    
    # S3キーの生成
    s3_key = f"etl-data/{target_date}/transformed_data.json"
    
    # JSONとして保存
    json_data = json.dumps(data, default=str, ensure_ascii=False, indent=2)
    
    s3_client.put_object(
        Bucket=bucket,
        Key=s3_key,
        Body=json_data,
        ContentType='application/json'
    )
    
    logger.info(f"Data saved to S3: s3://{bucket}/{s3_key}")
    return s3_key