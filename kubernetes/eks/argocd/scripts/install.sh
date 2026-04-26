#!/bin/bash

# 環境変数 ENVをチェック
if [ -z "$ENV" ]; then
  echo "環境変数 ENVを指定してください (stg or prd)"
  exit 1
fi

# Kubernetesリソースを作成
kubectl apply -f namespace.yaml

# Helm Chartをインストール
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update

# Helmからダッシュボードをインストール
helm upgrade --install argocd argo/argo-cd \
	--namespace argocd \
	--values overlays/${ENV}/values.yaml
