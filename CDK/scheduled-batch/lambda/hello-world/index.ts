import type { ScheduledEvent } from "aws-lambda";
import {
  createLambdaResultMessage,
  sendLambdaResultNotification,
} from "../common/notification";

const TEST_MESSAGE = process.env.TEST_MESSAGE as string;
const BATCH_SUCCESS_WEBHOOK_PARAMETER_STORE_NAME = process.env.BATCH_SUCCESS_WEBHOOK_PARAMETER_STORE_NAME as string;
const BATCH_FAILURE_WEBHOOK_PARAMETER_STORE_NAME = process.env.BATCH_FAILURE_WEBHOOK_PARAMETER_STORE_NAME as string;
const LAMBDA_FUNCTION_NAME = process.env.AWS_LAMBDA_FUNCTION_NAME as string;

const successMessage = "テスト用のLambda関数が正常に終了しました。";
const errorMessage = "テスト用のLambda関数が異常終了しました。";

export const handler = async (event: ScheduledEvent) => {
  try {
    // テスト用のメソッドを呼び出し
    helloWorld(TEST_MESSAGE);

    console.log(successMessage);
    // バッチ処理成功の通知
    await sendLambdaResultNotification(
      true,
      "テストバッチ成功",
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
      "テストバッチ失敗",
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

const helloWorld = (testMessage = "hello world!"): void => {
  console.log(testMessage);
};
