import json
import boto3
dynamodb_client = boto3.client('dynamodb')

def lambda_handler(event, context):
    dynamodb_client.put_item(TableName='SampleTable', Item={'id': {'S': '1'}, 'value': {'S': 'Value1'}})
    return {
        "statusCode": 200,
        "body": json.dumps({
            "message": "Data insertion succeeded!"
        }),
    }

