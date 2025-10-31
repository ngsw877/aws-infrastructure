import json


def handler(event, context):
    """
    受け取ったイベントとコンテキスト情報をそのまま返すLambda関数
    デバッグやテストに便利
    """
    # コンテキスト情報を辞書化
    context_info = {
        'aws_request_id': context.aws_request_id,
        'function_name': context.function_name,
        'function_version': context.function_version,
        'memory_limit_in_mb': context.memory_limit_in_mb,
        'log_group_name': context.log_group_name,
        'log_stream_name': context.log_stream_name
    }

    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'Event echo response',
            'received_event': event,
            'context_info': context_info
        }, ensure_ascii=False, indent=2)
    }