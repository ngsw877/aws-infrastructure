#!/bin/zsh

# git stash pop等を実行してコンフリクトした場合に、なかったことにする
git checkout --ours .
git reset
git checkout .