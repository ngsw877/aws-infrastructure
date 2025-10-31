import json

def handler(event, context):
    """
    Hello Worldを返すシンプルなLambda関数
    """
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'Hello World'
        })
    }
