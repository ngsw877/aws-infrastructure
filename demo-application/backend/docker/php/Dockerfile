FROM php:8.3-fpm-bullseye AS base

ENV TZ=Asia/Tokyo \
    LANG=ja_JP.UTF-8

COPY --from=composer:2.8.5 /usr/bin/composer /usr/bin/composer

RUN apt update \
    && apt -y install --no-install-recommends \
        locales \
        unzip \
        vim \
        libpq-dev \
    && apt clean \
    && rm -rf /var/lib/apt/lists/* \
    && locale-gen ja_JP.UTF-8 \
    && localedef -f UTF-8 -i ja_JP ja_JP.UTF-8 \
    && docker-php-ext-install \
        pdo_pgsql \
        bcmath

EXPOSE 9001

# ローカル環境用
FROM base AS local

COPY zzz-docker.conf /usr/local/etc/php-fpm.d/
COPY php.ini /usr/local/etc/php/conf.d/

# デプロイ先環境用
FROM base AS deploy

COPY docker/php/zzz-docker.conf /usr/local/etc/php-fpm.d/
COPY docker/php/php.ini /usr/local/etc/php/conf.d/php.ini

COPY --chown=www-data:www-data src /var/www/html/

RUN composer install
