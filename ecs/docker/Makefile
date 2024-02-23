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

PROFILE ?= default
NGINX_TAG_NAME = "sample-nginx-amd64"
APP_TAG_NAME = "sample-app-amd64"
REPO_NAME = "sample-app"

ACCOUNT_ID = $(shell aws sts get-caller-identity --profile $(PROFILE) --query "Account" --output text)
ECR_URL = "$(ACCOUNT_ID).dkr.ecr.ap-northeast-1.amazonaws.com"

get-ecr-url:
	echo $(ECR_URL)

login:
	aws ecr get-login-password --region ap-northeast-1 --profile $(PROFILE) | docker login --username AWS --password-stdin $(ECR_URL)

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
