#!/bin/bash

# 環境変数 ENVをチェック
if [ -z "$ENV" ]; then
  echo "環境変数 ENVを指定してください (stg or prd)"
  exit 1
fi

# Helmリポジトリを追加
helm repo add eks https://aws.github.io/eks-charts
helm repo update eks

helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
  --namespace kube-system \
  --values overlays/${ENV}/values.yaml
