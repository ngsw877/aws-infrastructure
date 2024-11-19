import axios from "axios";
import { getParameterStoreValue } from "./ssm";
import type { SendNotificationParams } from "../../types/lambda";

const LAMBDA_FUNCTION_NAME = process.env.AWS_LAMBDA_FUNCTION_NAME as string;

/**
 * Lambda実行結果の通知メッセージを作成する
 * @param message 通知メッセージ
 * @returns フォーマットされた通知メッセージ
 */
export const createLambdaResultMessage = (message: string): string => {
  return `Lambda関数名：\n[ ${LAMBDA_FUNCTION_NAME} ]\n\n${message}`;
};

/**
 * Lambda実行結果をSlackに通知する
 * @params
 * @throws Error Webhook URLが取得できない場合
 */
export const notifyLambdaResult = async (
  params: SendNotificationParams,
): Promise<void> => {
  // パラメータストアからWebhook URLを取得
  const webhookUrl = await getParameterStoreValue(
    params.webhookUrlParameterName,
  );

  // Webhook URLが取得できない場合はエラー
  if (!webhookUrl) {
    throw new Error("Webhook URLが取得できませんでした");
  }

  // Slackに通知するためのペイロードを作成
  const payload = {
    username: params.isSuccess
      ? "Scheduled Batch Success Bot"
      : "Scheduled Batch Error Bot",
    icon_emoji: params.isSuccess ? ":white_check_mark:" : ":rotating_light:",
    attachments: [
      {
        title: params.title,
        text: params.message,
        color: params.isSuccess
          ? "#36a64f" // 緑
          : "#ff0000", // 赤
      },
    ],
  };

  try {
    // Slackに通知
    await axios.post(webhookUrl, payload);
    console.log("通知が送信されました");
  } catch (error) {
    console.error("通知の送信中にエラーが発生しました:", error);
  }
};
