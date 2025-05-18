import os
import json
import boto3
import psycopg2

def lambda_handler(event, context):
    """
    RDSインスタンスに接続し、SQLファイルからテーブル作成とデータ挿入を行うLambda関数
    """
    
    # 環境変数からSecrets Manager ARNのみ取得
    secret_arn = os.environ['DB_SECRET_ARN']

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
        
        # SQLファイルを読み込む
        with open('init.sql', 'r') as file:
            sql_commands = file.read()
        
        # クエリを実行
        with conn.cursor() as cursor:
            print("Executing SQL commands from init.sql...")
            cursor.execute(sql_commands)
            conn.commit()
            print("Database initialization completed successfully!")
        
        conn.close()
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'データベース初期化が完了しました✨'
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