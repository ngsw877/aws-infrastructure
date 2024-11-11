import type { StackProps } from "aws-cdk-lib";
import type * as acm from "aws-cdk-lib/aws-certificatemanager";
import type * as route53 from "aws-cdk-lib/aws-route53";

export interface GlobalStackProps extends StackProps {
	hostedZoneId: string;
	appDomain: string;
}

export interface MainStackProps extends StackProps {
	natGatewaysCount: number;
	logRetentionDays?: number;
	cloudfrontCertificate?: acm.ICertificate;
	hostedZone?: route53.IHostedZone;
}

export interface Params {
	globalStackProps: GlobalStackProps;
	mainStackProps: MainStackProps;
}
