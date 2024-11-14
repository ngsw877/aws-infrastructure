
import type { 
	StackProps,
	Duration,
	aws_certificatemanager as acm,
	aws_logs as logs,
} from "aws-cdk-lib";
import type * as route53 from "aws-cdk-lib/aws-route53";

export interface GlobalStackProps extends StackProps {
	hostedZoneId: string;
	appDomain: string;
}

export interface MainStackProps extends StackProps {
	natGatewaysCount: number;
	logRetentionDays?: logs.RetentionDays;
	defaultTtl?: Duration;
	maxTtl?: Duration;
	minTtl?: Duration;
	backendEcsTaskCpu: number;
	backendEcsTaskMemory: number;
	backendMaxTaskCount: number;
	backendMinTaskCount: number;
	backendDesiredCount: number;
	backendEcsScaleOutPeriod: Duration;
	backendEcsScaleOutEvaluationPeriods: number;
	backendEcsScaleInPeriod: Duration;
	backendEcsScaleInEvaluationPeriods: number;
	// 以下は、GlobalStackのスタックからインポートする
	cloudfrontCertificate?: acm.ICertificate;
	hostedZone?: route53.IHostedZone;
}

export interface Params {
	globalStackProps: GlobalStackProps;
	mainStackProps: MainStackProps;
}
