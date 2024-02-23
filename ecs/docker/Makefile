.PHONY: get-ecr-url \
        login \
        logout \
        build-web \
        tag-web \
        push-web \
        deploy-web \
        build-app \
        tag-app \
        push-app \
        deploy-app

# makeコマンド実行時に、AWS CLIのprofileを指定する
PROFILE ?= default

NGINX_TAG_NAME = "sample-nginx-amd64"
APP_TAG_NAME = "sample-app-amd64"
REPO_NAME = "sample-app"

# profileを元にAWSアカウントIDを取得
ACCOUNT_ID = $(shell aws sts get-caller-identity --profile $(PROFILE) --query "Account" --output text)

# ECRのリポジトリタイプを指定（private or public）
REPO_TYPE ?= private

# REPO_TYPEに応じたECRのURLを指定
ifeq ($(REPO_TYPE), public)
# パブリックリポジトリの場合、"public.ecr.aws/xxxxxx"といった形式でリポジトリURLを取得（xxxxxxの部分はAWSアカウント毎に割り当てられるECSパブリックリポジトリ用の識別子）
	ECR_URL = $(shell aws ecr-public describe-repositories --region us-east-1 --profile $(PROFILE) | jq -r '.repositories[0].repositoryUri' | cut -d'/' -f1,2)
else
	ECR_URL = "$(ACCOUNT_ID).dkr.ecr.ap-northeast-1.amazonaws.com"
endif

get-ecr-url:
	echo $(ECR_URL)

login:
ifeq ($(REPO_TYPE), public)
	aws ecr-public get-login-password --region us-east-1 --profile $(PROFILE) | docker login --username AWS --password-stdin $(ECR_URL)
else
	aws ecr get-login-password --region ap-northeast-1 --profile $(PROFILE) | docker login --username AWS --password-stdin $(ECR_URL)
endif

logout:
	docker logout $(ECR_URL)

build-web:
	docker build -t "$(NGINX_TAG_NAME):latest" \
		--platform linux/amd64 \
		--build-arg BACKEND_APP_DOMAIN=127.0.0.1 \
		--build-arg RESOLVER=169.254.169.253 \
		nginx

tag-web:
	docker tag "$(NGINX_TAG_NAME):latest" "$(ECR_URL)/$(REPO_NAME):web"

push-web:
	docker push "$(ECR_URL)/$(REPO_NAME):web"

deploy-web:
	@make build-web
	@make tag-web
	@make push-web

build-app:
	docker build -t "$(APP_TAG_NAME):latest" \
		--platform linux/amd64 \
 		php

tag-app:
	docker tag "$(APP_TAG_NAME):latest" "$(ECR_URL)/$(REPO_NAME):app"

push-app:
	docker push "$(ECR_URL)/$(REPO_NAME):app"

deploy-app:
	@make build-app
	@make tag-app
	@make push-app
