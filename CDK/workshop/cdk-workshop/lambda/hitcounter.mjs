import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { Lambda, InvokeCommand } from "@aws-sdk/client-lambda";

export const handler = async (event) => {
	console.log("request:", JSON.stringify(event, undefined, 2));

	// create AWS SDK clients
	const dynamo = new DynamoDB();
	const lambda = new Lambda();

	// update dynamo entry for "path" with hits++
	await dynamo.updateItem({
		TableName: process.env.HITS_TABLE_NAME,
		Key: { path: { S: event.path } },
		UpdateExpression: "ADD hits :incr",
		ExpressionAttributeValues: { ":incr": { N: "1" } },
	});

	// call downstream function and capture response
	const command = new InvokeCommand({
		FunctionName: process.env.DOWNSTREAM_FUNCTION_NAME,
		Payload: JSON.stringify(event),
	});

	const { Payload } = await lambda.send(command);
	const result = Buffer.from(Payload).toString();

	console.log("downstream response:", JSON.stringify(result, undefined, 2));

	// return response back to upstream caller
	return JSON.parse(result);
};
