import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class DynamodbMigrationTestStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 共通のテーブル設定
    const tableProps = {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'type',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    };

    // ソーステーブル（データ移行元）
    const sourceTable = new dynamodb.Table(this, 'SourceTable', {
      tableName: 'SourceTable',
      ...tableProps,
    });

    // ターゲットテーブル（データ移行先）
    const destinationTable = new dynamodb.Table(this, 'DestinationTable', {
      tableName: 'DestinationTable',
      ...tableProps,
    });

    // サンプルテーブル（スタック再作成での移行検証用）
    const sampleTable = new dynamodb.Table(this, 'SampleTable', {
      tableName: 'SampleTable',
      ...tableProps,
    });

    // テーブル名を出力
    new cdk.CfnOutput(this, 'SourceTableName', {
      value: sourceTable.tableName,
      description: 'Source DynamoDB Table Name',
    });
    new cdk.CfnOutput(this, 'DestinationTableName', {
      value: destinationTable.tableName,
      description: 'Destination DynamoDB Table Name',
    });
    new cdk.CfnOutput(this, 'SampleTableName', {
      value: sampleTable.tableName,
      description: 'Sample DynamoDB Table Name',
    });
  }
}
