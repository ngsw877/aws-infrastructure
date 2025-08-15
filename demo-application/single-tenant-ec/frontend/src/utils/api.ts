/**
 * API Base URLを取得
 * @returns API Base URL
 */
export const getApiBaseUrl = (): string => {
  return process.env.NUXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'
}

/**
 * APIエンドポイントの完全URLを生成
 * @param endpoint - APIエンドポイント (例: '/products', '/cart')
 * @returns 完全なAPI URL
 */
export const getApiUrl = (endpoint: string): string => {
  const baseUrl = getApiBaseUrl()
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return `${baseUrl}/api${cleanEndpoint}`
}