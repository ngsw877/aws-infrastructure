import { CloudFormationClient, ListStacksCommand, DeleteStackCommand, Stack, StackStatus } from "@aws-sdk/client-cloudformation";
import type { ScheduledEvent } from "aws-lambda";
import { createLambdaResultMessage, notifyLambdaResult } from "../common/notification";

// 環境変数から設定値を取得
const BATCH_SUCCESS_WEBHOOK_PARAMETER_STORE_NAME = process.env.BATCH_SUCCESS_WEBHOOK_PARAMETER_STORE_NAME as string;
const BATCH_FAILURE_WEBHOOK_PARAMETER_STORE_NAME = process.env.BATCH_FAILURE_WEBHOOK_PARAMETER_STORE_NAME as string;
const DAYS_BEFORE_DELETION = Number(process.env.DAYS_BEFORE_DELETION || "7");

// CloudFormationクライアントの初期化
const cfnClient = new CloudFormationClient({ region: process.env.AWS_REGION });

/**
 * CloudFormationスタックの自動削除バッチ処理
 * 
 * 処理概要:
 * 1. REVIEW_IN_PROGRESSステータスのスタックを検索
 * 2. 作成から指定日数（デフォルト7日）以上経過したスタックを削除
 * 3. 削除結果をSlackに通知
 * 
 * @param event EventBridgeからのスケジュールイベント
 * @returns Lambda実行結果
 */
export const handler = async (event: ScheduledEvent) => {
  // 削除に成功したスタック名を記録する配列
  const deletedStacks: string[] = [];
  
  try {
    // REVIEW_IN_PROGRESSステータスのスタック一覧を取得
    // REVIEW_IN_PROGRESSは、変更セットが作成されたが実行されていない状態
    const listCommand = new ListStacksCommand({
      StackStatusFilter: [StackStatus.REVIEW_IN_PROGRESS]
    });
    const { StackSummaries } = await cfnClient.send(listCommand);
    
    // 削除対象のスタックが存在しない場合の処理
    if (!StackSummaries || StackSummaries.length === 0) {
      console.log("削除対象のスタックはありませんでした");
      await notifyLambdaResult({
        isSuccess: true,
        title: "CloudFormationスタック削除バッチ成功",
        message: createLambdaResultMessage("削除対象のスタックはありませんでした"),
        webhookUrlParameterName: BATCH_SUCCESS_WEBHOOK_PARAMETER_STORE_NAME,
      });
      return { statusCode: 200, body: "No stacks to delete" };
    }
    
    // 削除基準日を計算（現在日時から指定日数前）
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - DAYS_BEFORE_DELETION);
    
    // 各スタックを検査し、条件に合致するものを削除
    for (const stack of StackSummaries) {
      // 削除条件: 作成日時が存在し、削除基準日より前に作成されている
      if (stack.CreationTime && stack.CreationTime < cutoffDate && stack.StackName) {
        try {
          // スタックの削除を実行
          await cfnClient.send(new DeleteStackCommand({ StackName: stack.StackName }));
          deletedStacks.push(stack.StackName);
          console.log(`削除したスタック: ${stack.StackName} (作成日時: ${stack.CreationTime.toISOString()})`);
        } catch (error) {
          // 個別のスタック削除失敗は記録して処理を継続
          console.error(`スタック ${stack.StackName} の削除に失敗:`, error);
        }
      }
    }
    
    // 処理結果メッセージの生成
    const successMessage = deletedStacks.length > 0 
      ? `${deletedStacks.length}個のスタックを削除しました:\n${deletedStacks.join('\n')}`
      : "削除対象のスタックはありませんでした";
    
    // 成功通知をSlackに送信
    console.log(successMessage);
    await notifyLambdaResult({
      isSuccess: true,
      title: "CloudFormationスタック削除バッチ成功",
      message: createLambdaResultMessage(successMessage),
      webhookUrlParameterName: BATCH_SUCCESS_WEBHOOK_PARAMETER_STORE_NAME,
    });
    
    return { statusCode: 200, body: successMessage };
  } catch (error) {
    // 予期しないエラーが発生した場合の処理
    const errorMessage = `CloudFormationスタック削除中にエラーが発生しました`;
    console.error(errorMessage, error);
    
    // エラー通知をSlackに送信
    await notifyLambdaResult({
      isSuccess: false,
      title: "CloudFormationスタック削除バッチ失敗",
      message: createLambdaResultMessage(`${errorMessage}\n${error}`),
      webhookUrlParameterName: BATCH_FAILURE_WEBHOOK_PARAMETER_STORE_NAME,
    });
    
    return { statusCode: 500, body: errorMessage };
  }
};