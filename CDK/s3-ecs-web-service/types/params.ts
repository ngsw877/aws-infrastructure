import type { StackProps } from "aws-cdk-lib";

export interface GlobalStackProps extends StackProps {
    hostedZoneId: string;
    appDomain: string;
    crossRegionReferences: boolean,
    env: {
        account: string;
        region: string;
    };
};