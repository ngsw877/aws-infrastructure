import { ECSClient, UpdateServiceCommand } from "@aws-sdk/client-ecs";
import type { ScheduledEvent } from "aws-lambda";
import {
  createLambdaResultMessage,
  sendLambdaResultNotification,
} from "../common/notification";

const ECS_CLUSTER_NAME = process.env.ECS_CLUSTER_NAME as string;
const ECS_SERVICE_NAME = process.env.ECS_SERVICE_NAME as string;
const BATCH_SUCCESS_WEBHOOK_PARAMETER_STORE_NAME = process.env
  .BATCH_SUCCESS_WEBHOOK_PARAMETER_STORE_NAME as string;
const BATCH_FAILURE_WEBHOOK_PARAMETER_STORE_NAME = process.env
  .BATCH_FAILURE_WEBHOOK_PARAMETER_STORE_NAME as string;
const LAMBDA_FUNCTION_NAME = process.env.AWS_LAMBDA_FUNCTION_NAME as string;

const ecsClient = new ECSClient({ region: process.env.AWS_REGION });
const successMessage = `ECSサービス "${ECS_SERVICE_NAME}" のタスクが正常に再起動されました`;
const errorMessage = `ECSサービス "${ECS_SERVICE_NAME}" のタスクの再起動中にエラーが発生しました`;

export const handler = async (event: ScheduledEvent) => {
  try {
    const updateServiceCommand = new UpdateServiceCommand({
      cluster: ECS_CLUSTER_NAME,
      service: ECS_SERVICE_NAME,
      forceNewDeployment: true,
    });

    // ECSサービスのタスクを再起動
    await ecsClient.send(updateServiceCommand);

    console.log(successMessage);
    // バッチ処理成功の通知
    await sendLambdaResultNotification(
      true,
      "ECSタスク再起動成功",
      createLambdaResultMessage(LAMBDA_FUNCTION_NAME, successMessage),
      BATCH_SUCCESS_WEBHOOK_PARAMETER_STORE_NAME,
      BATCH_FAILURE_WEBHOOK_PARAMETER_STORE_NAME,
    );
    return { statusCode: 200, body: successMessage };
  } catch (error) {
    console.error(errorMessage, error);
    // バッチ処理失敗の通知
    await sendLambdaResultNotification(
      false,
      "ECSタスク再起動エラー",
      createLambdaResultMessage(
        LAMBDA_FUNCTION_NAME,
        `${errorMessage}\n${error}`,
      ),
      BATCH_SUCCESS_WEBHOOK_PARAMETER_STORE_NAME,
      BATCH_FAILURE_WEBHOOK_PARAMETER_STORE_NAME,
    );
    return { statusCode: 500, body: errorMessage };
  }
};
