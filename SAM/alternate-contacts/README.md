# このディレクトリについて

このディレクトリには、AWS Organizationのメンバーアカウントに対して、セキュリティ代替連絡先を自動設定するためのコードが格納されています。

この実装により、AWS Security Hubのセキュリティ基準の一つである<br>
「Account.1 Security contact information should be provided for an AWS account」に準拠することができます。


自動設定方法は、以下の２パターンあります。

1. 既存メンバーアカウントへの一括設定
2. 新規メンバーアカウントへの自動設定


# セキュリティ代替連絡先の自動設定方法

### 事前準備
1. AWS Organizationsの管理アカウントでCLIログインする
2. 設定ファイル`security-contact-config.json`を編集し、セキュリティ代替連絡先情報等を設定する

## 方法①：既存メンバーアカウントへの一括設定方法
スクリプトを実行し、既存の全メンバーアカウントに対して共通のセキュリティ代替連絡先を一括設定します。

```shell
./put-sec-alt-contacts-for-all-member-accounts.sh
```

<small>※ このスクリプトでAWS Organizationsの管理アカウントには設定できないため、管理アカウントのセキュリティ代替連絡先はマネジメントコンソール等から設定する必要があります。</small>

なお、このスクリプトはAWS公式ブログで紹介されているスクリプトをベースにしています。
- 参考：
  - [Programmatically managing alternate contacts on member accounts with AWS Organizations](https://aws.amazon.com/jp/blogs/mt/programmatically-managing-alternate-contacts-on-member-accounts-with-aws-organizations/)


## 方法②：新規メンバーアカウントへの自動設定方法
SAMテンプレートからスタックを作成し、組織に新規でメンバーアカウントが追加されたら、自動でセキュリティ代替連絡先を設定できるようにします。<br>
仕組みとしては、EventBridgeルールが発火し、Lambda関数が実行されることにより<br>
セキュリティ代替連絡先を自動設定します。

なお、このSAMプロジェクトはAWS公式で提供されている[aws-account-alternate-contacts-bootstrap](https://github.com/aws-samples/aws-account-alternate-contacts-bootstrap)をベースにしています。

- 参考：AWS公式ブログ
  - [Automatically update alternate contacts for newly created AWS Accounts](https://aws.amazon.com/jp/blogs/mt/automatically-update-alternate-contacts-for-newly-created-aws-accounts/)

### デプロイ手順

1. ディレクトリ移動
```shell
cd aws-account-alternate-contacts-bootstrap
```

2. SAMのアーティファクトをアップロードするS3バケットを作成（初回のみ）
```shell
./create-bucket.sh
```

3. SAMテンプレートをデプロイ
```shell
./deploy.sh
```

CloudFormationスタックが作成され、メンバーアカウントが追加されたら自動でセキュリティ代替連絡先が設定されるようになります。

### スタックの削除手順

1. ディレクトリ移動
```shell
cd aws-account-alternate-contacts-bootstrap
```

2. スタックとを関連リソースを削除
```shell
./cleanup.sh
```
