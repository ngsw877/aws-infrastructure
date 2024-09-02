import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';
// ファイルを読み込むためのパッケージを import
import { readFileSync } from "fs";

export class CdkSampleStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // VPC を作成
    const vpc = new ec2.Vpc(this, "BlogVpc", {
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
    });

    // WebServer インスタンスを作成
    const webServer1 = new ec2.Instance(this, "WordpressServer1", {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    // user-data.sh を読み込み、変数に格納
    const script = readFileSync('./lib/resources/user-data.sh' , "utf8");
    webServer1.addUserData(script);

    // RDS インスタンスを作成
    const dbServer = new rds.DatabaseInstance(this, "WordPressDB", {
      vpc,
      engine: rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_8_0_36 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
      databaseName: "wordpress"
    });

    // WebServer からのアクセスを許可
    dbServer.connections.allowDefaultPortFrom(webServer1);

    // ALB を作成
    const alb = new elbv2.ApplicationLoadBalancer(this, "LoadBalancer", {
      vpc,
      internetFacing: true,
    });

    // ALB のリスナーを作成
    const listener = alb.addListener('Listener', {
      port: 80
    });

    // ALB のリスナーのターゲットとしてWebServerインスタンスを登録
    listener.addTargets('ApplicationFleet', {
      port: 80,
      targets: [new targets.InstanceTarget(webServer1, 80)],
      healthCheck: {
        path: '/wp-includes/images/blank.gif'
      },
    });

    // ALB からインスタンスへのアクセスを許可
    webServer1.connections.allowFrom(alb, ec2.Port.tcp(80));
  }
}
