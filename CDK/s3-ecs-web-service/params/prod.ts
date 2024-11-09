import * as cdk from "aws-cdk-lib";
import type { GlobalStackProps } from "../types/params";

export const globalStackProps: GlobalStackProps = {
    hostedZoneId: "Z0239427N76R84Y5LWB8",
    appDomain: "prod.s3-ecs-web-service.kk-study.click",
    crossRegionReferences: true,
    env: {
        account: cdk.Aws.ACCOUNT_ID,
        region: "us-east-1",
    },
};
