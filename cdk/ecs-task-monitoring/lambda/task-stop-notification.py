import json
import os
import urllib.error
import urllib.parse
import urllib.request
import base64
import gzip

import boto3
from botocore.exceptions import ClientError

SLACK_WEBHOOK_URL = os.environ["SLACK_WEBHOOK_URL"]
LOG_GROUP_NAME = os.environ["LOG_GROUP_NAME"]
IS_ALERT_ENABLED = os.environ["IS_ALERT_ENABLED"].lower() == "true"
REGION = os.environ["AWS_REGION"]

def lambda_handler(event, context):
    """Lambda関数のメインハンドラー"""
    print("Received event: " + json.dumps(event, indent=2))

    try:
        # CloudWatch Logsイベントをデコード
        log_data = decode_cloudwatch_logs_event(event)
        print("Decoded awslogs_data: " + json.dumps(log_data, indent=2))

        log_events = log_data["logEvents"]
        log_stream = log_data["logStream"]

        for log_event in log_events:
            # 実際のECSタスク停止イベントを取得
            detail = json.loads(log_event["message"])["detail"]
            # タスク情報を抽出
            task_definition_arn, cluster_name, service_name = extract_task_info(detail)
            # 通知をスキップすべきか判断
            if is_notification_skippable(task_definition_arn, log_event["timestamp"]):
                print("通知をスキップしました。")
                return
            # 通知メッセージを作成
            message_content = create_notification_message(detail, cluster_name, service_name, log_stream)
            # Slackに通知を送信
            send_slack_notification(message_content, SLACK_WEBHOOK_URL)

    except Exception as e:
        print(f"Error: {str(e)}")
        raise

    print("Slackへの通知が成功しました。")
    return

def get_previous_task_definition_arn(log_group_name):
    """前回のタスク定義ARNとタイムスタンプを取得する"""
    logs_client = boto3.client("logs")
    try:
        # ログストリームを取得（最新順）
        response = logs_client.describe_log_streams(
            logGroupName=log_group_name,
            orderBy="LastEventTime",
            descending=True,
            limit=2,
        )

        if len(response["logStreams"]) < 2:
            print("十分なログストリームがありません")
            return None, None

        previous_log_stream = response["logStreams"][1]["logStreamName"]

        # 最新の1個前のログストリームからイベントを取得
        events = logs_client.get_log_events(
            logGroupName=log_group_name,
            logStreamName=previous_log_stream,
            limit=1,
            startFromHead=False,
        )

        if not events["events"]:
            print(f"ログストリーム {previous_log_stream} にイベントがありません")
            return None, None

        message = events["events"][0]["message"]
        message_json = json.loads(message)
        
        previous_task_definition_arn = message_json["detail"]["taskDefinitionArn"]
        previous_timestamp = events["events"][0].get("timestamp")

        return previous_task_definition_arn, previous_timestamp

    except Exception as e:
        print(f"前回のログ取得エラー: {e}")
        return None, None

def decode_cloudwatch_logs_event(event):
    """CloudWatch Logsのイベントをデコードする"""
    base64_encoded_log_data = event["awslogs"]["data"]
    gzip_compressed_data = base64.b64decode(base64_encoded_log_data)
    uncompressed_log_payload = gzip.decompress(gzip_compressed_data)
    return json.loads(uncompressed_log_payload)

def extract_task_info(detail):
    """タスクの詳細情報を抽出する"""
    task_definition_arn = detail.get("taskDefinitionArn")
    cluster_arn = detail.get("clusterArn")
    cluster_name = cluster_arn.split("/")[-1]
    service_group = detail.get("group")
    
    # サービス名を取得
    service_name = ""
    if service_group and service_group.startswith("service:"):
        service_name = service_group.split(":")[-1].split("/")[-1]
    
    return task_definition_arn, cluster_name, service_name

def is_notification_skippable(task_definition_arn, current_timestamp):
    """通知をスキップすべきかどうかを判断する"""
    print(f"IS_ALERT_ENABLED: {IS_ALERT_ENABLED}")
    
    if IS_ALERT_ENABLED:
        print("アラートが有効なため、スキップしません")
        return False
        
    previous_task_definition_arn, previous_timestamp = get_previous_task_definition_arn(LOG_GROUP_NAME)
    print(f"前回のタスク定義ARN: {previous_task_definition_arn}")
    print(f"今回のタスク定義ARN: {task_definition_arn}")
    print(f"前回のタイムスタンプ: {previous_timestamp}")
    print(f"今回のタイムスタンプ: {current_timestamp}")
    
    if previous_task_definition_arn == task_definition_arn:
        print("同じタスク定義ARNです")
        if previous_timestamp is not None:
            time_diff = current_timestamp - previous_timestamp
            print(f"時間差: {time_diff} ミリ秒")
            if time_diff <= 30 * 60 * 1000:
                print("30分以内に繰り返されたため、通知をスキップします")
                return True
    
    print("スキップ条件を満たさないため、通知します")
    return False

def create_notification_message(detail, cluster_name, service_name, log_stream):
    """Slack通知用のメッセージを作成する"""
    stopped_reason = detail.get("stoppedReason")
    
    # コンテナの停止理由を取得
    container_reasons = []
    for container in detail.get("containers", []):
        if "reason" in container:
            container_reasons.append(f"{container["name"]}: {container["reason"]}")

    # CloudWatch LogsのURLを生成
    cloudwatch_url = f"https://{REGION}.console.aws.amazon.com/cloudwatch/home?region={REGION}#logsV2:log-groups/log-group/{LOG_GROUP_NAME}/log-events/{log_stream}"

    # ECSサービスのURLを生成
    ecs_service_url = f"https://{REGION}.console.aws.amazon.com/ecs/v2/clusters/{cluster_name}/services/{service_name}/tasks?region={REGION}"

    # メッセージを作成
    message_content = f"*ECSタスクが停止しました*\n```\nタスク定義: {detail.get("taskDefinitionArn")}\nタスク停止理由: {stopped_reason}\n"
    if container_reasons:
        message_content += f"コンテナ停止理由: {container_reasons}\n"
    message_content += "```\n"
    message_content += f"<{cloudwatch_url}|CloudWatchLogs>"
    if service_name:
        message_content += f"  <{ecs_service_url}|ECSサービス>"
    
    return message_content

def send_slack_notification(message_content, slack_webhook_url):
    """Slackに通知を送信する"""
    request = urllib.request.Request(
        slack_webhook_url,
        headers={"Content-Type": "application/json"},
        data=json.dumps({"text": message_content}).encode("utf-8"),
    )

    with urllib.request.urlopen(request) as response:
        if response.getcode() != 200:
            raise RuntimeError(f"Slack通知送信失敗: HTTPステータスコード={response.getcode()}, レスポンス={response.read().decode('utf-8')}")
