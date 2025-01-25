#!/bin/zsh

# ログイン
gh auth login

# ログイン状態を確認
gh auth status

# ログアウト
gh auth logout

# GitHub Actionsの実行履歴をまとめて削除する
# https://qiita.com/tippy/items/79ca3f7b7bcac1d92136
owner="Organization名 または User名"
repository_name="リポジトリ名"
workflow_file_name="ワークフローファイル名"

gh api "repos/${owner}/${repository_name}/actions/workflows/${workflow_file_name}/runs?per_page=100" \
| jq -r '.workflow_runs[].id' \
| xargs -P4 -I{} gh api repos/{owner}/{repository_name}/actions/runs/{} -X DELETE

# デフォルトブランチ以外のGitHub Actionsワークフローを手動実行する
workflow_file_name=
repository_name=
branch_name=
deploy_to=

gh workflow run ${workflow_file_name} \
--ref ${branch_name} \
-R ${repository_name} \
-f branch=${branch_name} \
-f deploy_to=${deploy_to}