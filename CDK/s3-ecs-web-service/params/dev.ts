import { Aws, Duration } from "aws-cdk-lib";
import type { GlobalStackProps, MainStackProps, Params } from "../types/params";

const globalStackProps: GlobalStackProps = {
	env: {
		account: Aws.ACCOUNT_ID,
		region: "us-east-1",
	},
	crossRegionReferences: true,
	hostedZoneId: "Z03555611YEKDMTHN9OGE",
	appDomain: "dev.s3-ecs-web-service.kk-study.click",
};

const mainStackProps: MainStackProps = {
	env: {
		account: Aws.ACCOUNT_ID,
		region: "ap-northeast-1",
	},
	crossRegionReferences: true,
	natGatewaysCount: 0,
	logRetentionDays: 30,
	defaultTtl: Duration.days(1),
	maxTtl: Duration.days(365),
	minTtl: Duration.seconds(0),
};

export const params: Params = {
	globalStackProps: globalStackProps,
	mainStackProps: mainStackProps,
};
