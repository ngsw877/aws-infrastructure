#! /bin/bash
managementaccount=`aws organizations describe-organization --query Organization.MasterAccountId --output text`

for account in $(aws organizations list-accounts --query 'Accounts[].Id' --output text); do
    if [ "$managementaccount" -eq "$account" ]; then
        echo 'Skipping management account.'
        continue
    fi
    ./put-security-contact.sh -a $account
    sleep 0.2
done