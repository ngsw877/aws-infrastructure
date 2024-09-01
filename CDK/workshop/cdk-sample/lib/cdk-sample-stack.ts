import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as elbv2targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';

// ファイルを読み込むためのパッケージを import
import { readFileSync } from "fs";

export class CdkSampleStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // VPC を作成
    const vpc = new ec2.Vpc(this, "BlogVpc", {
      ipAddresses:  ec2.IpAddresses.cidr('10.0.0.0/16'),
    });

    // ALB を作成
    const alb = new elbv2.ApplicationLoadBalancer(this, "WordPressALB", {
      vpc,
      internetFacing: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC }
    });

    alb.connections.allowFromAnyIpv4(ec2.Port.tcp(80));

    // ALB のリスナーを作成
    const listener = alb.addListener('Listener', {
      port: 80
    });


    // WebServer インスタンスを作成
    const webServer1 = new ec2.Instance(this, "WordpressServer1", {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
    });

    // user-data.sh を読み込み、変数に格納
    const script = readFileSync('./lib/resources/user-data.sh' , "utf8");
    webServer1.addUserData(script);

    webServer1.connections.allowFrom(alb, ec2.Port.tcp(80));

    const instanceTarget = new elbv2targets.InstanceTarget(webServer1);

    // ALB のリスナーのターゲットとしてWebServerインスタンスを登録
    listener.addTargets('Target', {
      port: 80,
      healthCheck: {
        path: '/wp-includes/images/blank.gif'
      },
      targets: [instanceTarget]
    });

    // RDS インスタンスを作成
    const dbServer = new rds.DatabaseInstance(this, "WordPressDB", {
      vpc,
      engine: rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_8_0_36 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
      databaseName: "wordpress"
    });

    // WebServer からのアクセスを許可
    dbServer.connections.allowDefaultPortFrom(webServer1);

  }
}
