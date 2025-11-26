#!/bin/bash

# DynamoDB SourceTable にサンプルデータを挿入するスクリプト
# ユーザー100人 × (PROFILE 1件 + ORDER 3件) = 400件
# 使用方法: ./seed-data.sh

TABLE_NAME="SourceTable"
TOTAL_USERS=100
ORDERS_PER_USER=3
BATCH_SIZE=25

echo "DynamoDB テーブル '${TABLE_NAME}' にデータを挿入します..."
echo "  ユーザー数: ${TOTAL_USERS}"
echo "  各ユーザーの注文数: ${ORDERS_PER_USER}"
echo "  合計: $((TOTAL_USERS * (1 + ORDERS_PER_USER))) 件"
echo ""

items=""
item_count=0
batch_num=1

# 各ユーザーのデータを生成
for ((user=1; user<=TOTAL_USERS; user++)); do
  user_padded=$(printf "%03d" $user)

  # PROFILE データ
  profile_item=$(cat <<EOF
{
  "PutRequest": {
    "Item": {
      "id": {"S": "USER#${user_padded}"},
      "type": {"S": "PROFILE"},
      "name": {"S": "User ${user_padded}"},
      "email": {"S": "user${user_padded}@example.com"},
      "age": {"N": "$((20 + user % 50))"}
    }
  }
}
EOF
)

  if [ -n "$items" ]; then
    items="${items},"
  fi
  items="${items}${profile_item}"
  item_count=$((item_count + 1))

  # バッチサイズに達したら書き込み
  if [ $item_count -eq $BATCH_SIZE ]; then
    echo "バッチ ${batch_num}: ${BATCH_SIZE} 件を挿入中..."
    request_json="{\"${TABLE_NAME}\": [${items}]}"
    echo "$request_json" | aws dynamodb batch-write-item --request-items file:///dev/stdin
    if [ $? -ne 0 ]; then
      echo "エラー: バッチ ${batch_num} で失敗しました"
      exit 1
    fi
    items=""
    item_count=0
    batch_num=$((batch_num + 1))
  fi

  # ORDER データ（各ユーザー3件）
  for ((order=1; order<=ORDERS_PER_USER; order++)); do
    order_padded=$(printf "%03d" $order)
    products=("Product A" "Product B" "Product C" "Product D" "Product E")
    product=${products[$((order % 5))]}
    price=$((1000 + order * 500))

    order_item=$(cat <<EOF
{
  "PutRequest": {
    "Item": {
      "id": {"S": "USER#${user_padded}"},
      "type": {"S": "ORDER#${order_padded}"},
      "product": {"S": "${product}"},
      "price": {"N": "${price}"},
      "quantity": {"N": "$((1 + order % 5))"}
    }
  }
}
EOF
)

    if [ -n "$items" ]; then
      items="${items},"
    fi
    items="${items}${order_item}"
    item_count=$((item_count + 1))

    # バッチサイズに達したら書き込み
    if [ $item_count -eq $BATCH_SIZE ]; then
      echo "バッチ ${batch_num}: ${BATCH_SIZE} 件を挿入中..."
      request_json="{\"${TABLE_NAME}\": [${items}]}"
      echo "$request_json" | aws dynamodb batch-write-item --request-items file:///dev/stdin
      if [ $? -ne 0 ]; then
        echo "エラー: バッチ ${batch_num} で失敗しました"
        exit 1
      fi
      items=""
      item_count=0
      batch_num=$((batch_num + 1))
    fi
  done
done

# 残りのアイテムを書き込み
if [ $item_count -gt 0 ]; then
  echo "バッチ ${batch_num}: ${item_count} 件を挿入中..."
  request_json="{\"${TABLE_NAME}\": [${items}]}"
  echo "$request_json" | aws dynamodb batch-write-item --request-items file:///dev/stdin
  if [ $? -ne 0 ]; then
    echo "エラー: バッチ ${batch_num} で失敗しました"
    exit 1
  fi
fi

echo ""
echo "完了！$((TOTAL_USERS * (1 + ORDERS_PER_USER))) 件のデータを挿入しました。"
echo ""
echo "データ確認コマンド:"
echo "  aws dynamodb scan --table-name ${TABLE_NAME} --select COUNT"
