import { RemovalPolicy } from "aws-cdk-lib";
import {
	AttributeType,
	Table,
	TableEncryption,
} from "aws-cdk-lib/aws-dynamodb";
import {
	Function as LambdaFunction,
	Code,
	type IFunction,
	Runtime,
} from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import * as logs from "aws-cdk-lib/aws-logs"; // ロググループ用のインポート

export interface HitCounterProps {
	/** the function for which we want to count url hits **/
	downstream: IFunction;

	/**
	 * The read capacity units for the table
	 *
	 * Must be greater than 5 and lower than 20
	 *
	 * @default 5
	 */
	readCapacity?: number;
}

export class HitCounter extends Construct {
	/** allows accessing the counter function */
	public readonly handler: LambdaFunction;

	/** allows accessing the hit counter table */
	public readonly table: Table;

	constructor(scope: Construct, id: string, props: HitCounterProps) {
		// バリデーションテスト
		if (
			props.readCapacity !== undefined &&
			(props.readCapacity < 5 || props.readCapacity > 20)
		) {
			throw new Error("readCapacity must be greater than 5 and less than 20");
		}

		super(scope, id);

		this.table = new Table(this, "Hits", {
			partitionKey: {
				name: "path",
				type: AttributeType.STRING,
			},
			encryption: TableEncryption.AWS_MANAGED,
			readCapacity: props.readCapacity ?? 5,
			removalPolicy: RemovalPolicy.DESTROY,
		});

		const logGroup = new logs.LogGroup(this, "HitCounterLogGroup", {
			retention: logs.RetentionDays.ONE_WEEK,
			removalPolicy: RemovalPolicy.DESTROY,
		});

		this.handler = new LambdaFunction(this, "HitCounterHandler", {
			runtime: Runtime.NODEJS_18_X,
			handler: "hitcounter.handler",
			code: Code.fromAsset("lambda"),
			logGroup: logGroup,
			environment: {
				DOWNSTREAM_FUNCTION_NAME: props.downstream.functionName,
				HITS_TABLE_NAME: this.table.tableName,
			},
		});

		// grant the lambda role read/write permissions to our table
		this.table.grantReadWriteData(this.handler);

		// grant the lambda role invoke permissions to the downstream function
		props.downstream.grantInvoke(this.handler);
	}
}
