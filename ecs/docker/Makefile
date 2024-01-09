.PHONY: get-ecr-url login build-push-web build-push-app

PROFILE ?= default
PARAMETER_STORE_KEY ?= "/sample/ecr-name"
NGINX_TAG_NAME ?= "sample-nginx-amd64"
APP_TAG_NAME ?= "sample-app-amd64"
REPO_NAME ?= "sample-app"
ECR_URL ?= $(shell aws ssm --profile $(PROFILE) get-parameter --name $(PARAMETER_STORE_KEY) --query "Parameter.Value" --output text --with-decryption)

get-ecr-url:
	echo $(ECR_URL)

login:
	aws ecr get-login-password --region ap-northeast-1 --profile $(PROFILE) | docker login --username AWS --password-stdin $(ECR_URL)

build-push-web:
	docker build -t "$(NGINX_TAG_NAME):latest" \
		--platform linux/amd64 \
		--build-arg BACKEND_APP_DOMAIN=127.0.0.1 \
		--build-arg RESOLVER=169.254.169.253 \
		nginx
	docker tag "$(NGINX_TAG_NAME):latest" "$(ECR_URL)/$(REPO_NAME):web"
	docker push "$(ECR_URL)/$(REPO_NAME):web"

build-push-app:
	docker build --platform linux/amd64 -t "$(APP_TAG_NAME):latest" php
	docker tag "$(APP_TAG_NAME):latest" "$(ECR_URL)/$(REPO_NAME):app"
	docker push "$(ECR_URL)/$(REPO_NAME):app"
