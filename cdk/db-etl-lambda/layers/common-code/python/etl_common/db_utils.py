"""
データベース関連のユーティリティ
"""
import json
import psycopg2
from contextlib import contextmanager
import boto3
from aws_lambda_powertools import Logger, Metrics
from aws_lambda_powertools.metrics import MetricUnit

# Lambda Powertools設定
logger = Logger()
metrics = Metrics()

# クライアント初期化
secrets_client = boto3.client('secretsmanager')


def get_db_credentials(secret_arn: str) -> tuple:
    """
    Secrets Managerから認証情報を取得
    """
    try:
        response = secrets_client.get_secret_value(SecretId=secret_arn)
        secret = json.loads(response['SecretString'])
        return secret['username'], secret['password']
    except Exception as e:
        logger.error(f"Failed to retrieve secret: {str(e)}")
        metrics.add_metric(name="SecretRetrievalError", unit=MetricUnit.Count, value=1)
        raise


class ConnectionPool:
    """DB接続プールの管理"""
    def __init__(self):
        self.conn = None
    
    @contextmanager
    def get_connection(self, host, database, user, password, port=5432):
        """接続をコンテキストマネージャとして取得"""
        try:
            if self.conn is None or self.conn.closed:
                self.conn = psycopg2.connect(
                    host=host,
                    database=database,
                    user=user,
                    password=password,
                    port=port,
                    connect_timeout=10,
                    keepalives=1,
                    keepalives_idle=30,
                    keepalives_interval=10,
                    keepalives_count=5
                )
            yield self.conn
        except psycopg2.OperationalError as e:
            logger.error(f"Database connection error: {str(e)}")
            metrics.add_metric(name="DBConnectionError", unit=MetricUnit.Count, value=1)
            raise
        except Exception as e:
            if self.conn:
                self.conn.rollback()
            raise