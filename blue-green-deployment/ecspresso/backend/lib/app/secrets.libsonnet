[
  // アプリケーション基本設定
  {
    name: 'APP_KEY',
    valueFrom: '/{{ must_env `STACK_NAME` }}/app/app_key',
  },
]
