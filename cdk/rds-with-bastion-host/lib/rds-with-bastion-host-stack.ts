import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as fs from 'fs';
import * as path from 'path';

export class RdsWithBastionHostStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPCの作成（NAT Gatewayあり）
    const vpc = new ec2.Vpc(this, 'RdsVpc', {
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

    // RDS用のセキュリティグループ
    const rdsSecurityGroup = new ec2.SecurityGroup(this, 'RdsSecurityGroup', {
      vpc,
      description: 'Security group for RDS PostgreSQL',
      allowAllOutbound: false,
    });

    // RDS認証情報用のSecrets Managerシークレットを作成
    const dbCredentialsSecret = new secretsmanager.Secret(this, 'DBCredentialsSecret', {
      secretName: 'rds-postgres-credentials',
      description: 'RDS PostgreSQL database credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'postgres' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        includeSpace: false,
        passwordLength: 32,
      },
    });

    // RDS PostgreSQLの作成
    const dbInstance = new rds.DatabaseInstance(this, 'PostgresDatabase', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO
      ),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [rdsSecurityGroup],
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      databaseName: 'blog_db',
      credentials: rds.Credentials.fromSecret(dbCredentialsSecret),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      backupRetention: cdk.Duration.days(7),
      multiAz: false,
      deletionProtection: false,
      iamAuthentication: true,
      storageEncrypted: true,
    });

    // SQLファイルをソースコードから読み込む
    const initSql = fs.readFileSync(path.join(__dirname, '../assets/init.sql'), 'utf8');

    // 踏み台ホストの作成（BastionHostLinuxを使用）
    const bastionHost = new ec2.BastionHostLinux(this, 'BastionHost', {
      vpc,
      subnetSelection: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO
      ),
    });

    // psqlのインストールとSQLファイルの配置（ユーザーデータ）
    bastionHost.instance.addUserData(
      '#!/bin/bash',
      'set -e',
      '',
      '# パッケージのインストール',
      'dnf update -y',
      'dnf install -y postgresql16',
      '',
      '# SQLファイルを作成',
      'cat > /home/ec2-user/init.sql << "EOSQL"',
      initSql,
      'EOSQL',
      'chown ec2-user:ec2-user /home/ec2-user/init.sql',
      'chmod 644 /home/ec2-user/init.sql',
      '',
      '# 接続方法の案内ファイルを作成',
      'cat > /home/ec2-user/README.txt << "EOF"',
      '====================================',
      'RDS接続方法',
      '====================================',
      '',
      '1. RDSエンドポイントとパスワードを取得:',
      '',
      `aws secretsmanager get-secret-value --secret-id ${dbCredentialsSecret.secretArn} --query SecretString --output text`,
      '',
      '2. 上記のコマンドでユーザー名とパスワードを確認',
      '',
      '3. PostgreSQLに接続:',
      '',
      `psql -h ${dbInstance.dbInstanceEndpointAddress} -U postgres -d blog_db`,
      '',
      '4. init.sqlを実行してデータベースを初期化:',
      '',
      '\\i /home/ec2-user/init.sql',
      '',
      'または:',
      '',
      `psql -h ${dbInstance.dbInstanceEndpointAddress} -U postgres -d blog_db -f /home/ec2-user/init.sql`,
      '',
      '====================================',
      'EOF',
      'chown ec2-user:ec2-user /home/ec2-user/README.txt',
      'chmod 644 /home/ec2-user/README.txt'
    );

    // RDSへの接続を踏み台からのみ許可
    rdsSecurityGroup.addIngressRule(
      bastionHost.connections.securityGroups[0],
      ec2.Port.tcp(5432),
      'Allow PostgreSQL access from bastion host'
    );

    // 出力
    new cdk.CfnOutput(this, 'BastionInstanceId', {
      value: bastionHost.instanceId,
      description: 'Bastion EC2 Instance ID for SSM connection',
    });

    new cdk.CfnOutput(this, 'RdsEndpoint', {
      value: dbInstance.dbInstanceEndpointAddress,
      description: 'RDS PostgreSQL endpoint',
    });

    new cdk.CfnOutput(this, 'RdsSecretArn', {
      value: dbCredentialsSecret.secretArn,
      description: 'ARN of the secret containing database credentials',
    });
  }
}
