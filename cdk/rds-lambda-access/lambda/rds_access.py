import os
import json
import boto3
import psycopg2

def handler(event, context):
    """
    RDSインスタンスに接続し、簡単なSELECT文を実行するLambda関数
    
    Secrets Managerから認証情報を取得し、RDSに接続します。
    将来的に、取得したデータをS3に格納する機能も追加予定です。
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
        
        # クエリを実行
        with conn.cursor() as cursor:
            cursor.execute("SELECT current_timestamp, current_database(), current_user")
            result = cursor.fetchone()
            
            # 結果の処理
            timestamp, database, user = result
            message = f"Connected successfully! Time: {timestamp}, Database: {database}, User: {user}"
            print(message)
            
            # テーブルが存在するか確認し、なければ作成
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name = 'users'
                )
            """)
            table_exists = cursor.fetchone()[0]
            
            if not table_exists:
                print("Creating users table...")
                cursor.execute("""
                    CREATE TABLE users (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(100) NOT NULL,
                        age INT
                    )
                """)
                
                # サンプルデータを挿入
                cursor.execute("""
                    INSERT INTO users (name, age) VALUES
                    ('Alice', 25), ('Bob', 30), ('Charlie', 22)
                """)
                conn.commit()
                
            # データの取得
            cursor.execute("SELECT * FROM users")
            rows = cursor.fetchall()
            data = [{"id": row[0], "name": row[1], "age": row[2]} for row in rows]
        
        conn.close()
        
        # 将来的にはここでS3にデータを格納する処理を追加
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': message,
                'data': data
            }, default=str)
        }
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e)
            })
        } 