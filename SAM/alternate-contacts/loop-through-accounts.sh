#! /bin/bash

master_account_profile="default"

management_account=`aws organizations describe-organization --profile $master_account_profile --query Organization.MasterAccountId --output text`

for account in $(aws organizations list-accounts --profile $master_account_profile --query 'Accounts[].Id' --output text); do
    # 管理アカウントはスキップ
    # NOTE: 管理アカウントの代替連絡先の登録に、aws account put-alternate-contactコマンドを使用するとエラーが発生するため、管理アカウントでログインしマネジメントコンソールから登録する等他の方法を使用する
    if [ "$management_account" -eq "$account" ]; then
        echo 'Skipping management account.'
        continue
    fi
    ./put-security-contact.sh $master_account_profile $account
    sleep 0.2
done