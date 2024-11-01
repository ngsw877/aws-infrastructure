import axios from "axios";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const ssmClient = new SSMClient();

export const handler = async (): Promise<void> => {
	try {
		const command = new GetParameterCommand({
			Name: "/scheduled-batch/slack-webhook-url",
			WithDecryption: true,
		});
		const response = await ssmClient.send(command);
		const SLACK_WEBHOOK_URL = response.Parameter?.Value;

		if (!SLACK_WEBHOOK_URL) {
			throw new Error("Failed to retrieve SLACK_WEBHOOK_URL");
		}

		const message = {
			text: "This is a test message from the scheduled Lambda function. If you see this, the system is working correctly!",
		};

		await axios.post(SLACK_WEBHOOK_URL, message);
		console.log("Message sent to Slack successfully");
	} catch (error) {
		console.error("Error:", error);
		throw error;
	}
};
