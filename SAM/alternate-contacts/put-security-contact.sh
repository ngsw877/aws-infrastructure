#! /bin/bash

profile=$1
account_id=$2

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

echo 'Put security contact for account '$account_id'...'

aws account put-alternate-contact \
    --profile "$profile" \
    --account-id "$account_id" \
    --alternate-contact-type=SECURITY \
    --name="$name" \
    --title="$title" \
    --email-address="$email_address" \
    --phone-number="$phone_number"

echo 'Done putting security contact for account '$account_id'.'
