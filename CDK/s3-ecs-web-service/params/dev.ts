import * as cdk from "aws-cdk-lib";
import type { GlobalStackProps } from "../types/params";

export const globalStackProps: GlobalStackProps = {
    hostedZoneId: "Z03555611YEKDMTHN9OGE",
    appDomain: "dev.s3-ecs-web-service.kk-study.click",
    crossRegionReferences: true,
    env: {
        account: cdk.Aws.ACCOUNT_ID,
        region: "us-east-1",
    },
};
