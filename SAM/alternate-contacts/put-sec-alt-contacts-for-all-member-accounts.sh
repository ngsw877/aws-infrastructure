#! /bin/bash

# 環境変数の読み込み
source ./security_contact_config.sh

management_account=$(
    aws organizations describe-organization \
    --profile "${MASTER_ACCOUNT_PROFILE}" \
    --query Organization.MasterAccountId \
    --output text
)

for account in $(
    aws organizations list-accounts \
        --profile "${MASTER_ACCOUNT_PROFILE}" \
        --query 'Accounts[].Id' \
        --output text
); do
    # 管理アカウントはスキップ 
    # NOTE: 管理アカウントの代替連絡先の登録に、aws account put-alternate-contactコマンドを使用するとエラーが発生するため、管理アカウントでログインしマネジメントコンソールから登録する等他の方法を使用する
    if [ "${management_account}" -eq "${account}" ]; then
        echo "管理アカウント：${account}をスキップします。"
        continue
    fi

    echo "アカウント：${account}の代替連絡先を設定します..."

    aws account put-alternate-contact \
        --profile "${MASTER_ACCOUNT_PROFILE}" \
        --account-id "${account}" \
        --alternate-contact-type=SECURITY \
        --name="${SECURITY_CONTACT_NAME}" \
        --title="${SECURITY_CONTACT_TITLE}" \
        --email-address="${SECURITY_CONTACT_EMAIL}" \
        --phone-number="${SECURITY_CONTACT_PHONE}"

    echo "アカウント：${account}の代替連絡先の設定が完了しました。"
    
    sleep 0.2
done 