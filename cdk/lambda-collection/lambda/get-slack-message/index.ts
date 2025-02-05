import { WebClient } from "@slack/web-api";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { getParameterStoreValue } from "../../../scheduled-batch/lambda/common/ssm";
import { decode } from 'he';

dayjs.extend(utc);
dayjs.extend(timezone);

const SLACK_CHANNEL_ID_PARAMETER_STORE_NAME = process.env.SLACK_CHANNEL_ID_PARAMETER_STORE_NAME;
const SLACK_TOKEN_PARAMETER_STORE_NAME = process.env.SLACK_TOKEN_PARAMETER_STORE_NAME;

if (!SLACK_CHANNEL_ID_PARAMETER_STORE_NAME || !SLACK_TOKEN_PARAMETER_STORE_NAME) {
  throw new Error("必要な環境変数が設定されていません");
}

export const handler = async () => {
  try {
    const slackToken = await getParameterStoreValue(SLACK_TOKEN_PARAMETER_STORE_NAME);
    const slackChannelId = await getParameterStoreValue(SLACK_CHANNEL_ID_PARAMETER_STORE_NAME);

    const slack = new WebClient(slackToken);

    // 現在から1時間前のUNIXタイムスタンプを取得
    const oneHourAgoUnixTimestamp = dayjs().tz("Asia/Tokyo").subtract(1, 'hour').unix().toString();

    // 指定したSlackチャンネルの、1時間前以降のメッセージを取得
    // API仕様書: https://api.slack.com/methods/conversations.history
    const result = await slack.conversations.history({
      channel: slackChannelId,
      oldest: oneHourAgoUnixTimestamp,
    });

    // messagesが存在するか確認
    if (result.messages && Array.isArray(result.messages)) {
      const messages = result.messages.map((msg) => ({
        text: decode(msg.text ?? ""),
        formattedDate: dayjs.unix(msg.ts ? Number.parseFloat(msg.ts) : 0).tz("Asia/Tokyo").format('YYYY-MM-DD HH:mm:ss'),
      }));
      return {
        statusCode: 200,
        body: {
          messages,
        },
      };
    }
    return {
      statusCode: 404,
      body: JSON.stringify({ message: "メッセージが取得できませんでした。" }),
    };
  } catch (error) {
    console.error("エラー:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "エラーが発生しました。" }),
    };
  }
};
