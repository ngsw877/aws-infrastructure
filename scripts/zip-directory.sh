#!/bin/bash

# 引数が指定されていない場合はエラーメッセージを表示
if [ -z "$1" ]; then
  echo "使用法: $0 <ディレクトリ名>"
  exit 1
fi

# 引数からディレクトリ名を取得
DIR_PATH="$1"

# ディレクトリに移動
cd "$DIR_PATH" || exit 1  # 移動に失敗したらスクリプトを終了

# 絶対パスの場合、最後のディレクトリ名を取得
DIR_NAME=$(basename "$DIR_PATH")

# ZIPファイルの保存先を指定（デスクトップに保存）
ZIP_FILE_NAME="$HOME/Desktop/${DIR_NAME}.zip"

# ZIP化
zip -r "$ZIP_FILE_NAME" * -x "node_modules/*"

# 完了メッセージ
echo "ディレクトリ '$DIR_PATH' を '$ZIP_FILE_NAME' に圧縮しました。"