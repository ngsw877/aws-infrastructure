import { 
    Aws, 
    Duration,
		aws_logs as logs,
} from "aws-cdk-lib";
import type { 
    GlobalStackProps, 
    MainStackProps, 
    Params 
} from "../types/params";

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
	logRetentionDays: logs.RetentionDays.ONE_MONTH,
	defaultTtl: Duration.days(1),
	maxTtl: Duration.days(365),
	minTtl: Duration.seconds(0),
	backendEcsTaskCpu: 256,
	backendEcsTaskMemory: 512,
	backendMaxTaskCount: 1,
	backendMinTaskCount: 1,
	backendDesiredCount: 0,
	backendEcsScaleOutPeriod: Duration.seconds(300),
	backendEcsScaleOutEvaluationPeriods: 3,
	backendEcsScaleInPeriod: Duration.seconds(300),
	backendEcsScaleInEvaluationPeriods: 3,
};

export const params: Params = {
	globalStackProps: globalStackProps,
	mainStackProps: mainStackProps,
};
