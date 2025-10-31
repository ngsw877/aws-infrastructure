import json
from datetime import datetime
from zoneinfo import ZoneInfo


def handler(event, context):
    """
    現在時刻を日本時間（JST）で返すLambda関数
    """
    # 日本時間（JST）で現在時刻を取得
    jst = ZoneInfo("Asia/Tokyo")
    now = datetime.now(jst)

    return {
        'statusCode': 200,
        'body': json.dumps({
            'timestamp': now.isoformat(),
            'timezone': 'Asia/Tokyo (JST)',
            'formatted': now.strftime('%Y-%m-%d %H:%M:%S %Z'),
            'unix_time': int(now.timestamp())
        }, ensure_ascii=False)
    }