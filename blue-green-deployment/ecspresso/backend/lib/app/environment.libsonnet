[
  // アプリケーション基本設定
  {
    name: 'APP_ENV',
    value: '{{ must_env `APP_ENV` }}',
  },
  {
    name: 'APP_DEBUG',
    value: '{{ must_env `APP_DEBUG` }}',
  },
  {
    name: 'TZ',
    value: 'Asia/Tokyo',
  },
  {
    name: 'LOG_LEVEL',
    value: '{{ must_env `LOG_LEVEL` }}',
  },
]
