import * as cdk from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'node:path';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class RdsLambdaAccessStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const dbUser = 'app_user';
    const dbName = 'sample_app';

    // VPC作成（パブリックサブネット、プライベートサブネット、NAT Gatewayを含む）
    const vpc = new ec2.Vpc(this, 'RdsLambdaVpc', {
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
      ],
    });

    // セキュリティグループの作成
    const rdsSecurityGroup = new ec2.SecurityGroup(this, 'RdsSecurityGroup', {
      vpc,
      description: 'Allow database connections',
      allowAllOutbound: true,
    });

    // RDSインスタンスの作成（PostgreSQL）
    const rdsInstance = new rds.DatabaseInstance(this, 'RdsInstance', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO
      ),
      credentials: rds.Credentials.fromGeneratedSecret(dbUser),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [rdsSecurityGroup],
      allocatedStorage: 20,
      storageType: rds.StorageType.GP2,
      backupRetention: cdk.Duration.days(7),
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      parameterGroup: new rds.ParameterGroup(this, 'RdsParameterGroup', {
        engine: rds.DatabaseInstanceEngine.postgres({
          version: rds.PostgresEngineVersion.VER_16,
        }),
        parameters: {
          'timezone': 'Asia/Tokyo',
        },
      }),
      storageEncrypted: true,
      databaseName: dbName,
    });

    // 踏み台ホスト
    const bastionHost = new ec2.BastionHostLinux(this, 'BastionHost', {
      vpc,
      subnetSelection: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      instanceName: 'rds-lambda-access-bastion',
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO
      ),
    });
    
    // PostgreSQLクライアントのインストール
    bastionHost.instance.userData.addCommands(
      'sudo dnf update -y',
      'sudo dnf install -y postgresql16'
    );

    // 踏み台ホストからRDSへのアクセスを許可
    rdsInstance.connections.allowFrom(bastionHost, ec2.Port.tcp(5432));

    // Lambdaのセキュリティグループ
    const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc,
      description: 'Security group for Lambda function',
      allowAllOutbound: true,
    });

    // RDSセキュリティグループにLambdaからの接続を許可
    rdsSecurityGroup.addIngressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL access from Lambda'
    );

    // S3バケットの作成（CSV出力用）
    const csvBucket = new s3.Bucket(this, 'CsvBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    });

    // Lambda用のロール
    const lambdaRole = new iam.Role(this, 'LambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
    });

    // Secrets ManagerへのアクセスをLambdaに許可
    rdsInstance.secret?.grantRead(lambdaRole);

    // S3バケットへの書き込み権限をLambdaに追加
    csvBucket.grantReadWrite(lambdaRole);

    // DB初期化用のLambda関数
    const initDbLambda = new lambda.Function(this, 'InitDbLambda', {
      runtime: lambda.Runtime.PYTHON_3_13,
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/init_db'), {
        bundling: {
          image: lambda.Runtime.PYTHON_3_13.bundlingImage,
          command: [
            'bash', '-c', [
              'pip install -r requirements.txt -t /asset-output',
              'cp -au . /asset-output'
            ].join(' && ')
          ],
        },
      }),
      handler: 'lambda_function.lambda_handler',
      environment: {
        DB_SECRET_ARN: rdsInstance.secret?.secretArn || '',
      },
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [lambdaSecurityGroup],
      role: lambdaRole,
      architecture: lambda.Architecture.ARM_64,
    });

    // データ取得・CSV出力用のLambda関数
    const exportRdsToS3Lambda = new lambda.Function(this, 'ExportRdsToS3Lambda', {
      runtime: lambda.Runtime.PYTHON_3_13,
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/export_rds_to_s3'), {
        bundling: {
          image: lambda.Runtime.PYTHON_3_13.bundlingImage,
          command: [
            'bash', '-c', [
              'pip install -r requirements.txt -t /asset-output',
              'cp -au . /asset-output'
            ].join(' && ')
          ],
        },
      }),
      handler: 'lambda_function.lambda_handler',
      environment: {
        DB_SECRET_ARN: rdsInstance.secret?.secretArn || '',
        S3_BUCKET_NAME: csvBucket.bucketName,
      },
      timeout: cdk.Duration.minutes(3),
      memorySize: 256,
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [lambdaSecurityGroup],
      role: lambdaRole,
      architecture: lambda.Architecture.ARM_64,
    });

    // 出力
    new cdk.CfnOutput(this, 'BastionHostId', {
      value: bastionHost.instanceId,
      description: '踏み台サーバーのインスタンスID（SSMで接続してください）',
    });

    new cdk.CfnOutput(this, 'RdsEndpoint', {
      value: rdsInstance.dbInstanceEndpointAddress,
      description: 'RDSインスタンスのエンドポイント',
    });

    new cdk.CfnOutput(this, 'SecretArn', {
      value: rdsInstance.secret?.secretArn || '',
      description: 'データベース認証情報のSecrets Manager ARN',
    });
  }
}
