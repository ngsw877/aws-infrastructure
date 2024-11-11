import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import type { GlobalStackProps } from "../types/params";

export class GlobalStack extends cdk.Stack {
	public readonly cloudfrontCertificate: acm.ICertificate;
	public readonly hostedZone: route53.IHostedZone;

	constructor(scope: cdk.App, id: string, props: GlobalStackProps) {
		super(scope, id, props);

		// Route53ホストゾーンの定義
		this.hostedZone = route53.HostedZone.fromHostedZoneAttributes(
			this,
			"HostedZone",
			{
				hostedZoneId: props.hostedZoneId,
				zoneName: props.appDomain,
			},
		);

		// CloudFront用のACM証明書
		this.cloudfrontCertificate = new acm.Certificate(
			this,
			"CloudFrontCertificate",
			{
				certificateName: `${this.stackName}-cloudfront-certificate`,
				domainName: props.appDomain,
				validation: acm.CertificateValidation.fromDns(this.hostedZone),
			},
		);
	}
}
