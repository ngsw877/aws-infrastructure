# トークンを生成し、クリップボードにコピー
kubectl -n kubernetes-dashboard create token kubernetes-dashboard-sa | pbcopy

# ダッシュボードのURLを出力
echo "please access to https://localhost:8443"

# ポートフォワードでダッシュボードを起動
kubectl -n kubernetes-dashboard port-forward svc/kubernetes-dashboard-kong-proxy 8443:443
