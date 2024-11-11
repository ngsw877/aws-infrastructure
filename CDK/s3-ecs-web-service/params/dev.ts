import * as cdk from "aws-cdk-lib";
import type { GlobalStackProps, MainStackProps, Params } from "../types/params";

const globalStackProps: GlobalStackProps = {
	env: {
		account: cdk.Aws.ACCOUNT_ID,
		region: "us-east-1",
	},
	crossRegionReferences: true,
	hostedZoneId: "Z03555611YEKDMTHN9OGE",
	appDomain: "dev.s3-ecs-web-service.kk-study.click",
};

const mainStackProps: MainStackProps = {
	env: {
		account: cdk.Aws.ACCOUNT_ID,
		region: "ap-northeast-1",
	},
	crossRegionReferences: true,
	natGatewaysCount: 0,
	logRetentionDays: 30,
};

export const params: Params = {
	globalStackProps: globalStackProps,
	mainStackProps: mainStackProps,
};
