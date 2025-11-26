import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';

export class EcsInstanceWithEfsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, 'Vpc', {
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

    // S3バケット（データアップロード用）
    const dataBucket = new s3.Bucket(this, 'DataBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // EC2用セキュリティグループ
    const ec2SecurityGroup = new ec2.SecurityGroup(this, 'Ec2SecurityGroup', {
      vpc,
      description: 'Security group for ECS EC2 instances',
      allowAllOutbound: true,
    });

    // EFS用セキュリティグループ
    const efsSecurityGroup = new ec2.SecurityGroup(this, 'EfsSecurityGroup', {
      vpc,
      description: 'Security group for EFS',
      allowAllOutbound: true,
    });

    // EC2からEFSへのアクセスを許可
    efsSecurityGroup.addIngressRule(
      ec2.Peer.securityGroupId(ec2SecurityGroup.securityGroupId),
      ec2.Port.tcp(2049),
      'Allow NFS access from EC2 instances'
    );

    // EFSのファイルシステムポリシーを作成
    const efsFileSystemPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          principals: [new iam.AnyPrincipal()],
          actions: [
            'elasticfilesystem:ClientRootAccess',
            'elasticfilesystem:ClientWrite',
            'elasticfilesystem:ClientMount',
          ],
          resources: ['*'],
          conditions: {
            Bool: {
              'elasticfilesystem:AccessedViaMountTarget': 'true',
            },
          },
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.DENY,
          principals: [new iam.AnyPrincipal()],
          actions: ['*'],
          resources: ['*'],
          conditions: {
            Bool: {
              'aws:SecureTransport': 'false',
            },
          },
        }),
      ],
    });

    // EFSファイルシステム
    const fileSystem = new efs.FileSystem(this, 'EfsFileSystem', {
      vpc,
      securityGroup: efsSecurityGroup,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      throughputMode: efs.ThroughputMode.BURSTING,
      encrypted: true,
      fileSystemPolicy: efsFileSystemPolicy,
    });

    // EC2インスタンス用IAMロール
    const ec2Role = new iam.Role(this, 'Ec2Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonEC2ContainerServiceforEC2Role'),
      ],
    });

    // ECSタスク用IAMロール
    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // S3へのアクセス権限
    dataBucket.grantReadWrite(taskRole);

    // ECS Exec用のSSM権限
    taskRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ssmmessages:CreateControlChannel',
        'ssmmessages:CreateDataChannel',
        'ssmmessages:OpenControlChannel',
        'ssmmessages:OpenDataChannel',
      ],
      resources: ['*'],
    }));

    // タスク実行ロール
    const executionRole = new iam.Role(this, 'ExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    // ECSクラスター
    const cluster = new ecs.Cluster(this, 'EcsCluster', {
      vpc,
      containerInsightsV2: ecs.ContainerInsights.ENABLED,
    });

    // UserData（ECSエージェント設定）
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      '#!/bin/bash',
      'mkdir -p /etc/ecs',
      `cat << 'EOF' > /etc/ecs/ecs.config`,
      `ECS_CLUSTER=${cluster.clusterName}`,
      'ECS_ENABLE_TASK_IAM_ROLE=true',
      'ECS_ENABLE_TASK_ENI=true',
      'EOF',
    );

    // Auto Scaling Group
    const autoScalingGroup = new autoscaling.AutoScalingGroup(this, 'Asg', {
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3A, ec2.InstanceSize.SMALL),
      machineImage: ecs.EcsOptimizedImage.amazonLinux2023(),
      securityGroup: ec2SecurityGroup,
      role: ec2Role,
      minCapacity: 1,
      maxCapacity: 2,
      userData: userData,
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: autoscaling.BlockDeviceVolume.ebs(30, {
            volumeType: autoscaling.EbsDeviceVolumeType.GP3,
            encrypted: true,
          }),
        },
      ],
      updatePolicy: autoscaling.UpdatePolicy.rollingUpdate(),
      healthCheck: autoscaling.HealthCheck.ec2({
        grace: cdk.Duration.seconds(60),
      }),
    });

    // Capacity Provider
    const capacityProvider = new ecs.AsgCapacityProvider(this, 'CapacityProvider', {
      capacityProviderName: 'efs-test-cp',
      autoScalingGroup,
      machineImageType: ecs.MachineImageType.AMAZON_LINUX_2,
      enableManagedTerminationProtection: false,
    });
    cluster.addAsgCapacityProvider(capacityProvider);

    // デフォルトのCapacity Provider Strategyを設定
    cluster.addDefaultCapacityProviderStrategy([
      {
        capacityProvider: capacityProvider.capacityProviderName,
        weight: 1,
      },
    ]);

    // タスク定義（EC2起動タイプ）
    const taskDefinition = new ecs.Ec2TaskDefinition(this, 'TaskDefinition', {
      taskRole: taskRole,
      executionRole: executionRole,
      networkMode: ecs.NetworkMode.BRIDGE,
      volumes: [
        {
          name: 'efs-volume',
          efsVolumeConfiguration: {
            fileSystemId: fileSystem.fileSystemId,
            transitEncryption: 'ENABLED',
          },
        },
      ],
    });

    // Pythonコンテナ（マウントテスト用）
    const container = taskDefinition.addContainer('app', {
      image: ecs.ContainerImage.fromRegistry('python:3.12.8-slim-bookworm'),
      memoryReservationMiB: 256,
      command: ['sleep', 'infinity'],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'app',
      }),
      environment: {
        S3_BUCKET: dataBucket.bucketName,
      },
    });

    // EFSマウント
    container.addMountPoints({
      sourceVolume: 'efs-volume',
      containerPath: '/mnt/efs',
      readOnly: false,
    });

    // ECSサービス
    const service = new ecs.Ec2Service(this, 'EcsService', {
      cluster,
      taskDefinition,
      desiredCount: 1,
      enableExecuteCommand: true,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      capacityProviderStrategies: [
        {
          capacityProvider: capacityProvider.capacityProviderName,
          weight: 1,
        },
      ],
    });

    // 出力
    new cdk.CfnOutput(this, 'ClusterName', {
      value: cluster.clusterName,
      description: 'ECS Cluster Name',
    });

    new cdk.CfnOutput(this, 'EfsFileSystemId', {
      value: fileSystem.fileSystemId,
      description: 'EFS File System ID',
    });

    new cdk.CfnOutput(this, 'DataBucketName', {
      value: dataBucket.bucketName,
      description: 'S3 Bucket Name',
    });

    new cdk.CfnOutput(this, 'ServiceName', {
      value: service.serviceName,
      description: 'ECS Service Name',
    });
  }
}