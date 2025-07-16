/**
 * 現在のホスト名からAPI Base URLを動的に生成
 * @returns API Base URL (例: https://api.demo1.s3-ecs-web-service.hoge-app.click)
 */
export const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    
    // ローカル環境の場合はHTTPを使用
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://api.localhost'
    }
    
    return `https://api.${hostname}`
  }
  // SSR時のフォールバック（ローカル環境）
  return 'http://api.localhost'
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