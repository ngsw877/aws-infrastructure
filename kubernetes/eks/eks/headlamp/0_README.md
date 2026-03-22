## Headlamp

EKS 上の Kubernetes リソースを可視化するためのダッシュボードです。

## 前提

以下のコマンドを実行できるように準備してください。

- kubectl
- helm

## インストール方法

以下のコマンドを実行します。

```bash
cd /path/to/cloud-pratica-backend/ops/kubernetes/eks/headlamp
kustomize build overlays/stg --enable-helm | kubectl apply -f -
```

## ダッシュボードの起動方法

シェルを実行して、

- 認証用のトークンをクリップボードにコピー
- ポートフォワード

を行います。

```bash
cd /path/to/cloud-pratica-backend/ops/kubernetes/eks/headlamp
./scripts/start.sh
```

起動後は、ブラウザで以下の URL にアクセスします。

http://localhost:8080

Bearer Token がクリップボードにコピーされているので、ログイン時にそのままペーストすればアクセスできます。
