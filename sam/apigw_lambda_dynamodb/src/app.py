import os
import json
import boto3

def lambda_handler(event, context):
    table_name = os.environ['TABLE_NAME'] 
    dynamodb_client = boto3.client('dynamodb')
    dynamodb_client.put_item(
        TableName=table_name,
        Item={
            'id': {'S': '1'},
            'value': {'S': 'Value1'}
        }
    )
    
    return {
        "statusCode": 200,
        "body": json.dumps({
            "message": "Data insertion succeeded!"
        }),
    }

