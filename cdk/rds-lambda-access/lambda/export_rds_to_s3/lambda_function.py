import os
import json
import boto3
import psycopg2
import csv
from datetime import datetime

def lambda_handler(event, context):
    """
    RDSインスタンスに接続し、データを取得してCSV形式でS3に保存するLambda関数
    """
    
    # 環境変数からSecrets Manager ARNとS3バケット名を取得
    secret_arn = os.environ['DB_SECRET_ARN']
    s3_bucket = os.environ['S3_BUCKET_NAME']
    
    try:
        # Secrets Managerから全ての接続情報を取得
        secrets_client = boto3.client('secretsmanager')
        response = secrets_client.get_secret_value(SecretId=secret_arn)
        secret = json.loads(response['SecretString'])

        username = secret['username']
        password = secret['password']
        db_host = secret['host']
        db_port = secret['port']
        db_name = secret['dbname']
        
        print(f"Connecting to PostgreSQL database: {db_host}")
        
        # PostgreSQLへの接続
        conn = psycopg2.connect(
            host=db_host,
            port=db_port,
            dbname=db_name,
            user=username,
            password=password
        )
        
        # データを取得
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM users")
            rows = cursor.fetchall()
            # カラム名を取得
            columns = [desc[0] for desc in cursor.description]
            
            # データを整形
            data = [dict(zip(columns, row)) for row in rows]
            print(f"Retrieved {len(rows)} records from database")
        
        conn.close()
        
        # 現在のタイムスタンプをファイル名に使用
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        csv_filename = f"/tmp/users_{timestamp}.csv"
        s3_key = f"exports/users_{timestamp}.csv"
        
        # データをCSVファイルに書き込む
        with open(csv_filename, 'w', newline='') as csvfile:
            # カラム名をヘッダーとして使用
            writer = csv.DictWriter(csvfile, fieldnames=columns)
            writer.writeheader()
            writer.writerows(data)
            
        print(f"CSV file created at {csv_filename}")
        
        # CSVファイルをS3にアップロード
        s3 = boto3.client('s3')
        s3.upload_file(csv_filename, s3_bucket, s3_key)
        print(f"CSV file uploaded to s3://{s3_bucket}/{s3_key}")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': f'データの取得とCSVエクスポートが完了しました✨',
                's3_location': f's3://{s3_bucket}/{s3_key}',
                'record_count': len(rows)
            })
        }
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e)
            })
        } 