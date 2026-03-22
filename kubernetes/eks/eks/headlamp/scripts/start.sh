#!/bin/bash

# トークンを生成し、クリップボードにコピー
kubectl -n headlamp create token headlamp-sa | pbcopy

# ダッシュボードのURLを出力
echo "please access to http://localhost:8080"

# ポートフォワードでダッシュボードを起動
kubectl -n headlamp port-forward svc/headlamp 8080:80
