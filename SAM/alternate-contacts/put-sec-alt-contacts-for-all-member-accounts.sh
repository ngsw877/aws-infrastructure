#! /bin/bash

master_account_profile="default"

### 代替連絡先の設定（全AWSアカウント共通） #################
# 氏名
name="Mary Major" 
# 役職
title="Security Contact"
# Eメール 
email_address="security-contact@example.com"
# 電話番号
phone_number="+1(555)555-5555"
#######################################################

management_account=`aws organizations describe-organization --profile $master_account_profile --query Organization.MasterAccountId --output text`

for account in $(aws organizations list-accounts --profile $master_account_profile --query 'Accounts[].Id' --output text); do
    # 管理アカウントはスキップ 
    # NOTE: 管理アカウントの代替連絡先の登録に、aws account put-alternate-contactコマンドを使用するとエラーが発生するため、管理アカウントでログインしマネジメントコンソールから登録する等他の方法を使用する
    if [ "$management_account" -eq "$account" ]; then
        echo '管理アカウントをスキップします。'
        continue
    fi

    echo 'アカウント'$account'の代替連絡先を設定します...'

    aws account put-alternate-contact \
        --profile "$master_account_profile" \
        --account-id "$account" \
        --alternate-contact-type=SECURITY \
        --name="$name" \
        --title="$title" \
        --email-address="$email_address" \
        --phone-number="$phone_number"

    echo 'アカウント'$account'の代替連絡先の設定が完了しました。'
    
    sleep 0.2
done 