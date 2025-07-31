import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { S3ToLambda } from '@aws-solutions-constructs/aws-s3-lambda';
import * as path from 'path';

export class DbEtlLambdaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC作成（データベース用）
    const vpc = new ec2.Vpc(this, 'EtlVpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'Database',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // データベース認証情報（Secrets Manager）
    const sourceDbCredentials = new secretsmanager.Secret(this, 'SourceDbCredentials', {
      secretName: 'etl/source-db-credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'postgres' }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\',
      },
    });

    const targetDbCredentials = new secretsmanager.Secret(this, 'TargetDbCredentials', {
      secretName: 'etl/target-db-credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'postgres' }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\',
      },
    });

    // ソースDB（RDS PostgreSQL）
    const sourceDb = new rds.DatabaseInstance(this, 'SourceDatabase', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      credentials: rds.Credentials.fromSecret(sourceDbCredentials),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      databaseName: 'sourcedb',
      deletionProtection: false,  // 学習用なので削除可能
      removalPolicy: cdk.RemovalPolicy.DESTROY,  // 学習用なので削除可能
    });

    // ターゲットDB（Aurora Serverless v2 PostgreSQL）
    const targetDbCluster = new rds.ServerlessCluster(this, 'TargetDatabase', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_3,
      }),
      credentials: rds.Credentials.fromSecret(targetDbCredentials),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      defaultDatabaseName: 'targetdb',
      deletionProtection: false,  // 学習用なので削除可能
      removalPolicy: cdk.RemovalPolicy.DESTROY,  // 学習用なので削除可能
      scaling: {
        autoPause: cdk.Duration.minutes(5),  // 学習用なのでコスト削減
        minCapacity: rds.AuroraCapacityUnit.ACU_1,  // 最小は1
        maxCapacity: rds.AuroraCapacityUnit.ACU_2,
      },
    });

    // ETLデータ用S3バケット
    const etlBucket = new s3.Bucket(this, 'EtlDataBucket', {
      bucketName: `etl-data-bucket-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,  // 学習用なので削除可能
      autoDeleteObjects: true,  // 学習用なので自動削除
      versioned: false,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [{
        id: 'delete-old-etl-data',
        expiration: cdk.Duration.days(30),  // 30日後に自動削除
        abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
      }],
      serverAccessLogsPrefix: 'access-logs/',  // アクセスログを有効化
    });

    // 共通Python依存関係Layer
    const pythonCommonLayer = new lambda.LayerVersion(this, 'PythonCommonLayer', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../layers/python-common'), {
        bundling: {
          image: lambda.Runtime.PYTHON_3_11.bundlingImage,
          command: [
            'bash', '-c',
            [
              'pip install -r requirements.txt -t /asset-output/python --platform manylinux2014_aarch64 --only-binary=:all: --python-version 3.11 --implementation cp',
              'cp -r /asset-output/python/* /asset-output/ 2>/dev/null || true'
            ].join(' && ')
          ],
        },
      }),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_11],
      description: 'Common Python dependencies (psycopg2, pandas, boto3, powertools)',
    });

    // 共通コードLayer
    const commonCodeLayer = new lambda.LayerVersion(this, 'CommonCodeLayer', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../layers/common-code')),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_11],
      description: 'Common ETL code (db_utils)',
    });

    // Extract-Transform Lambda関数
    const extractTransformLambda = new lambda.Function(this, 'ExtractTransformLambda', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'lambda_function.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/extract-transform')),
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      environment: {
        SOURCE_DB_HOST: sourceDb.instanceEndpoint.hostname,
        SOURCE_DB_NAME: 'sourcedb',
        SOURCE_DB_SECRET_ARN: sourceDbCredentials.secretArn,
        S3_BUCKET: etlBucket.bucketName,
        // Lambda Powertools
        POWERTOOLS_SERVICE_NAME: 'etl-extract-transform',
        POWERTOOLS_METRICS_NAMESPACE: 'ETL',
        LOG_LEVEL: 'INFO',
      },
      layers: [pythonCommonLayer, commonCodeLayer],
    });

    // Lambda関数にデータベースとS3への権限を付与
    sourceDb.connections.allowDefaultPortFrom(extractTransformLambda);
    sourceDbCredentials.grantRead(extractTransformLambda);
    etlBucket.grantWrite(extractTransformLambda);

    // S3からLambdaを呼び出す構成（AWS Solutions Constructs使用）
    const s3ToLoadLambda = new S3ToLambda(this, 'S3ToLoadLambda', {
      existingBucketObj: etlBucket,
      lambdaFunctionProps: {
        runtime: lambda.Runtime.PYTHON_3_11,
        handler: 'lambda_function.lambda_handler',
        code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/load')),
        timeout: cdk.Duration.minutes(10),
        memorySize: 512,
        vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        environment: {
          TARGET_DB_HOST: targetDbCluster.clusterEndpoint.hostname,
          TARGET_DB_NAME: 'targetdb',
          TARGET_DB_SECRET_ARN: targetDbCredentials.secretArn,
          // Lambda Powertools
          POWERTOOLS_SERVICE_NAME: 'etl-load',
          POWERTOOLS_METRICS_NAMESPACE: 'ETL',
          LOG_LEVEL: 'INFO',
        },
        layers: [pythonCommonLayer, commonCodeLayer],
      },
      bucketProps: undefined,  // 既存のバケットを使用
    });

    // Load Lambda関数にターゲットDBへの権限を付与
    targetDbCluster.connections.allowDefaultPortFrom(s3ToLoadLambda.lambdaFunction);
    targetDbCredentials.grantRead(s3ToLoadLambda.lambdaFunction);

    // DB初期化Lambda関数
    const dbInitializerLambda = new lambda.Function(this, 'DbInitializerLambda', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'lambda_function.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/db-initializer')),
      timeout: cdk.Duration.minutes(10),
      memorySize: 512,
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      environment: {
        SOURCE_DB_HOST: sourceDb.instanceEndpoint.hostname,
        SOURCE_DB_NAME: 'sourcedb',
        SOURCE_DB_SECRET_ARN: sourceDbCredentials.secretArn,
        TARGET_DB_HOST: targetDbCluster.clusterEndpoint.hostname,
        TARGET_DB_NAME: 'targetdb',
        TARGET_DB_SECRET_ARN: targetDbCredentials.secretArn,
        // Lambda Powertools
        POWERTOOLS_SERVICE_NAME: 'db-initializer',
        POWERTOOLS_METRICS_NAMESPACE: 'ETL',
        LOG_LEVEL: 'INFO',
      },
      layers: [pythonCommonLayer, commonCodeLayer],
    });

    // DB初期化Lambda関数に必要な権限を付与
    sourceDb.connections.allowDefaultPortFrom(dbInitializerLambda);
    targetDbCluster.connections.allowDefaultPortFrom(dbInitializerLambda);
    sourceDbCredentials.grantRead(dbInitializerLambda);
    targetDbCredentials.grantRead(dbInitializerLambda);

    // 日次バッチ処理のスケジュール（毎日午前2時に実行）
    const dailyEtlRule = new events.Rule(this, 'DailyEtlSchedule', {
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '2',
        day: '*',
        month: '*',
        year: '*'
      }),
    });

    dailyEtlRule.addTarget(new targets.LambdaFunction(extractTransformLambda));

    // 出力
    new cdk.CfnOutput(this, 'SourceDbEndpoint', {
      value: sourceDb.instanceEndpoint.hostname,
      description: 'Source Database Endpoint'
    });

    new cdk.CfnOutput(this, 'TargetDbEndpoint', {
      value: targetDbCluster.clusterEndpoint.hostname,
      description: 'Target Database Endpoint'
    });

    new cdk.CfnOutput(this, 'EtlBucketName', {
      value: etlBucket.bucketName,
      description: 'ETL Data S3 Bucket Name'
    });

    new cdk.CfnOutput(this, 'ExtractTransformLambdaName', {
      value: extractTransformLambda.functionName,
      description: 'Extract Transform Lambda Function Name'
    });

    new cdk.CfnOutput(this, 'LoadLambdaName', {
      value: s3ToLoadLambda.lambdaFunction.functionName,
      description: 'Load Lambda Function Name'
    });

    new cdk.CfnOutput(this, 'DbInitializerLambdaName', {
      value: dbInitializerLambda.functionName,
      description: 'DB Initializer Lambda Function Name'
    });
  }
}
