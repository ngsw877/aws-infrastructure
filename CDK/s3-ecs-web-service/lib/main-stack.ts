import * as cdk from "aws-cdk-lib";
import type { Construct } from "constructs";
import { Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { CloudFrontToS3 } from "@aws-solutions-constructs/aws-cloudfront-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as route53 from "aws-cdk-lib/aws-route53";
import type { MainStackProps } from "../types/params";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import {
	BlockPublicAccess,
	Bucket,
	BucketAccessControl,
	BucketEncryption,
} from "aws-cdk-lib/aws-s3";

export class MainStack extends cdk.Stack {
	constructor(scope: Construct, id: string, props: MainStackProps) {
		super(scope, id, props);

		if (!props.cloudfrontCertificate || !props.hostedZone) {
			throw new Error("GlobalStackから取得した、cloudfrontCertificateとhostedZoneの両方が必須です。");
		}

		// VPCとサブネット
		const vpc = new ec2.Vpc(this, "Vpc", {
			maxAzs: 2,
			subnetConfiguration: [
				{
					cidrMask: 24,
					name: "Public",
					subnetType: ec2.SubnetType.PUBLIC,
				},
				{
					cidrMask: 24,
					name: "Private",
					subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
				},
			],
			natGateways: props.natGatewaysCount,
		});

		// S3バケットの設定
		// フロントエンド用S3バケット
		const frontendBucket = new Bucket(this, "FrontendBucket", {
			versioned: true,
			blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
			encryption: BucketEncryption.S3_MANAGED,
			enforceSSL: true,
		});

		// アップロードされたファイル用S3バケット
		const uploadedFilesBucket = new Bucket(this, "UploadedFilesBucket", {
			versioned: true,
			blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
			encryption: BucketEncryption.S3_MANAGED,
			enforceSSL: true,
		});

		// CloudFrontログ用S3バケット
		const cloudFrontLogsBucket = new Bucket(this, "CloudFrontLogsBucket", {
			lifecycleRules: [
				{
					id: "cloudfront-logs-expiration",
					enabled: true,
					expiration: Duration.days(props?.logRetentionDays ?? 90),
				},
			],
			blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
			encryption: BucketEncryption.S3_MANAGED,
			enforceSSL: true,
			accessControl: BucketAccessControl.LOG_DELIVERY_WRITE,
		});

		// Frontend用CloudFront
		const frontendCloudFront = new CloudFrontToS3(this, "FrontendCloudFront", {
			existingBucketObj: frontendBucket,
			cloudFrontDistributionProps: {
				certificate: props.cloudfrontCertificate,
				domainNames: [props.hostedZone.zoneName],
				defaultBehavior: {
					viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
					// オリジンリクエストポリシー
					originRequestPolicy: new cloudfront.OriginRequestPolicy(
						this,
						"FrontendOriginRequestPolicy",
						{
							originRequestPolicyName: `${this.stackName}-FrontendOriginRequestPolicy`,
							comment: "FrontendOriginRequestPolicy",
						},
					),
					// キャッシュポリシー
					cachePolicy: new cloudfront.CachePolicy(this, "FrontendCachePolicy", {
						cachePolicyName: `${this.stackName}-FrontendCachePolicy`,
						comment: "FrontendCachePolicy",
						// キャッシュ期間
						defaultTtl: cdk.Duration.days(1),
						maxTtl: cdk.Duration.days(365),
						minTtl: cdk.Duration.seconds(0),
						// 圧縮サポート
						enableAcceptEncodingBrotli: true,
						enableAcceptEncodingGzip: true,
					}),
				},
				priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
				httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
				logBucket: cloudFrontLogsBucket,
				logFilePrefix: "FrontendCloudFront/",
				defaultRootObject: "index.html",
				errorResponses: [
					{
						httpStatus: 404,
						responseHttpStatus: 404,
						responsePagePath: "/404.html",
						ttl: Duration.seconds(10),
					},
				],
			},
		});

		new route53.ARecord(this, "FrontendCloudFrontAliasRecord", {
			zone: props.hostedZone,
			recordName: props.hostedZone.zoneName,
			target: route53.RecordTarget.fromAlias(
				new targets.CloudFrontTarget(
					frontendCloudFront.cloudFrontWebDistribution,
				),
			),
		});

	}
}
