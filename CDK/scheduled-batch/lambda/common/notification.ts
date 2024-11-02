import axios from "axios";
import { getParameterStoreValue } from "./ssm";

/**
 * Lambda実行結果の通知メッセージを作成する
 * @param lambdaFunctionName Lambda関数名
 * @param message 通知メッセージ
 * @returns フォーマットされた通知メッセージ
 */
export const createLambdaResultMessage = (
  lambdaFunctionName: string,
  message: string,
): string => {
  return `Lambda関数名：\n[ ${lambdaFunctionName} ]\n\n${message}`;
};

/**
 * Lambda実行結果をSlackに通知する
 * @param isSuccess Lambda処理が成功したかどうか
 * @param title 通知のタイトル
 * @param message 通知の本文
 * @param successWebhookParameterName 成功時のWebhook URLが格納されているパラメータ名
 * @param failureWebhookParameterName 失敗時のWebhook URLが格納されているパラメータ名
 */
export const sendLambdaResultNotification = async (
  isSuccess: boolean,
  title: string,
  message: string,
  successWebhookParameterName: string,
  failureWebhookParameterName: string,
): Promise<void> => {
  // パラメータストアからWebhook URLを取得
  const webhookUrl = await getParameterStoreValue(
    isSuccess ? successWebhookParameterName : failureWebhookParameterName,
  );

  // Webhook URLが取得できない場合はエラー
  if (!webhookUrl) {
    console.error("Webhook URLが取得できませんでした");
    return;
  }

  // Slackに通知するためのペイロードを作成
  const payload = {
    username: isSuccess
      ? "Scheduled Batch Success Bot"
      : "Scheduled Batch Error Bot",
    icon_emoji: isSuccess ? ":white_check_mark:" : ":rotating_light:",
    attachments: [
      {
        title: title,
        text: message,
        color: isSuccess ? "#36a64f" : "#ff0000",
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
