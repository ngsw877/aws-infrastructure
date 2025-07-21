import json
import os
import time
import urllib.request
import urllib.parse
from typing import Dict, Any

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    print(f'Received event: {json.dumps(event, indent=2)}')
    
    # イベント形式の確認
    if not event.get('Records') or not event['Records'][0].get('Sns'):
        raise ValueError('Invalid event format: Expected SNS event with Records array')
    
    # SNSメッセージをパース
    sns_message = json.loads(event['Records'][0]['Sns']['Message'])
    alarm_name = sns_message.get('AlarmName')
    new_state = sns_message.get('NewStateValue')
    reason = sns_message.get('NewStateReason')
    
    # Slack用メッセージを作成
    slack_message = {
        'text': f'CloudWatch Alarm: {alarm_name}',
        'attachments': [{
            'color': 'danger' if new_state == 'ALARM' else 'good',
            'fields': [
                {
                    'title': 'Alarm Name',
                    'value': alarm_name,
                    'short': True
                },
                {
                    'title': 'State',
                    'value': new_state,
                    'short': True
                },
                {
                    'title': 'Reason',
                    'value': reason,
                    'short': False
                }
            ],
            'footer': 'AWS CloudWatch',
            'footer_icon': 'https://a0.awsstatic.com/main/images/logos/aws_logo_smile_179x109.png',
            'ts': int(time.time())
        }]
    }
    
    # 環境変数からSlack Webhook URLを取得
    slack_webhook_url = os.environ.get('SLACK_WEBHOOK_URL')
    if not slack_webhook_url:
        raise ValueError('SLACK_WEBHOOK_URL environment variable is not set')
    
    # Slack Webhookに送信
    data = json.dumps(slack_message).encode('utf-8')
    req = urllib.request.Request(
        slack_webhook_url,
        data=data,
        headers={'Content-Type': 'application/json'}
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            response_body = response.read().decode('utf-8')
            print(f'Response: {response_body}')
            
            return {
                'statusCode': response.status,
                'body': response_body
            }
    except Exception as e:
        print(f'Request error: {str(e)}')
        raise e