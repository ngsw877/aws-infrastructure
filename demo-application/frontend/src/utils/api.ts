/**
 * 現在のホスト名からAPI Base URLを動的に生成
 * @returns API Base URL (例: https://api.demo1.s3-ecs-web-service.hoge-app.click)
 */
export const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    return `https://api.${hostname}`
  }
  // SSR時のフォールバック
  return 'https://api.localhost'
}

/**
 * APIエンドポイントの完全URLを生成
 * @param endpoint - APIエンドポイント (例: '/domain', '/health_check')
 * @returns 完全なAPI URL
 */
export const getApiUrl = (endpoint: string): string => {
  const baseUrl = getApiBaseUrl()
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return `${baseUrl}/api${cleanEndpoint}`
}