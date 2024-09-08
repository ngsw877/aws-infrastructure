import {CfnOutput} from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import {Construct} from 'constructs';
import {readFileSync} from 'fs';

// Construct propsを定義
export interface WebServerInstanceProps {
    readonly vpc: ec2.IVpc
    readonly availabilityZone: string
}

// EC2 インスタンスを含む Construct を定義
export class WebServerInstance extends Construct {
    // 外部からインスタンスへアクセスできるように設定
    public readonly instance: ec2.Instance;

    constructor(scope: Construct, id: string, props: WebServerInstanceProps) {
        super(scope, id);

        // Construct propsからvpcを取り出す
        const { vpc, availabilityZone } = props;

        // SSMセッションマネージャー用のIAMロールを作成
        const role = new iam.Role(this, 'EC2SSMRole', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
            ],
        });

        const instance = new ec2.Instance(this, "Instance", {
            vpc,
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
            machineImage: new ec2.AmazonLinuxImage({
                generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
            }),
            vpcSubnets: {
                subnetType: ec2.SubnetType.PUBLIC,
                availabilityZones: [availabilityZone]
            },
            role: role,
            requireImdsv2: true
        });

        const script = readFileSync("./lib/resources/user-data.sh", "utf8");
        instance.userData.addCommands(script);

        instance.connections.allowFromAnyIpv4(ec2.Port.tcp(80));

        // 作成したEC2インスタンスをプロパティに設定
        this.instance = instance;

        new CfnOutput(this, "WordpressServer1PublicIPAddress", {
            value: `http://${instance.instancePublicIp}`,
        });
    }
}
