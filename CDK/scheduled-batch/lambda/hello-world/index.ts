import type { ScheduledEvent } from "aws-lambda";
import {
  createLambdaResultMessage,
  notifyLambdaResult,
} from "../common/notification";
import { throwErrorIfForceErrorEnabled } from "../common/debug";

const TEST_MESSAGE = process.env.TEST_MESSAGE as string;
const BATCH_SUCCESS_WEBHOOK_PARAMETER_STORE_NAME = process.env
  .BATCH_SUCCESS_WEBHOOK_PARAMETER_STORE_NAME as string;
const BATCH_FAILURE_WEBHOOK_PARAMETER_STORE_NAME = process.env
  .BATCH_FAILURE_WEBHOOK_PARAMETER_STORE_NAME as string;

const successMessage = "テスト用のLambda関数が正常に終了しました。";
const errorMessage = "テスト用のLambda関数が異常終了しました。";

export const handler = async (event: ScheduledEvent) => {
  try {
    // もし環境変数IS_FORCE_ERROR_ENABLEDがtrueの場合は、デバッグ用の意図的なエラーを発生させる
    throwErrorIfForceErrorEnabled();

    // テスト用のメソッドを呼び出し
    helloWorld(TEST_MESSAGE);

    console.log(successMessage);
    // バッチ処理成功の通知
    await notifyLambdaResult({
      isSuccess: true,
      title: "テストバッチ成功",
      message: createLambdaResultMessage(successMessage),
      webhookUrlParameterName: BATCH_SUCCESS_WEBHOOK_PARAMETER_STORE_NAME,
    });

    return { statusCode: 200, body: successMessage };
  } catch (error) {
    console.error(errorMessage, error);
    // バッチ処理失敗の通知
    await notifyLambdaResult({
      isSuccess: false,
      title: "テストバッチ失敗",
      message: createLambdaResultMessage(`${errorMessage}\n${error}`),
      webhookUrlParameterName: BATCH_FAILURE_WEBHOOK_PARAMETER_STORE_NAME,
    });

    return { statusCode: 500, body: errorMessage };
  }
};

const helloWorld = (testMessage = "hello world!"): void => {
  console.log(testMessage);
};
