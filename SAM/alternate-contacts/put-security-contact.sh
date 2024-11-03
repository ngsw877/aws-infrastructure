#! /bin/bash
while getopts a: flag
do
    case "${flag}" in
        a) account_id=${OPTARG};;
    esac
done

echo 'Put security contact for account '$account_id'...'
aws account put-alternate-contact   --account-id $account_id   --alternate-contact-type=SECURITY   --email-address=security-contact@example.com   --phone-number="+1(555)555-5555"   --title="Security Contact"   --name="Mary Major"
echo 'Done putting security contact for account '$account_id'.'