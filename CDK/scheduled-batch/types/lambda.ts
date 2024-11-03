export interface SendNotificationParams {
  isSuccess: boolean; // Lambda処理が成功したかどうか
  title: string; // 通知のタイトル  
  message: string; // 通知の本文
  webhookUrlParameterName: string; // 通知先のSlack Webhook URLが格納されているパラメータ名
}
