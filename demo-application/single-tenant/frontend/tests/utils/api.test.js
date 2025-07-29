import { getApiUrl, getApiBaseUrl } from '~/utils/api'

describe('API Utils', () => {
  beforeEach(() => {
    // Reset environment variables
    process.env.NUXT_PUBLIC_API_BASE_URL = undefined
  })

  describe('getApiBaseUrl', () => {
    test('returns environment variable when set', () => {
      process.env.NUXT_PUBLIC_API_BASE_URL = 'https://api.example.com'
      
      expect(getApiBaseUrl()).toBe('https://api.example.com')
    })

    test('returns default localhost URL when environment variable not set', () => {
      expect(getApiBaseUrl()).toBe('http://localhost:8080')
    })

    test('handles empty environment variable', () => {
      process.env.NUXT_PUBLIC_API_BASE_URL = ''
      
      expect(getApiBaseUrl()).toBe('http://localhost:8080')
    })
  })

  describe('getApiUrl', () => {
    test('constructs API URL with path', () => {
      process.env.NUXT_PUBLIC_API_BASE_URL = 'https://api.example.com'
      
      expect(getApiUrl('/products')).toBe('https://api.example.com/api/products')
    })

    test('handles path with leading slash', () => {
      expect(getApiUrl('/products')).toBe('http://localhost:8080/api/products')
    })

    test('handles path without leading slash', () => {
      expect(getApiUrl('products')).toBe('http://localhost:8080/api/products')
    })

    test('handles empty path', () => {
      expect(getApiUrl('')).toBe('http://localhost:8080/api')
    })

    test('handles complex paths', () => {
      expect(getApiUrl('/products/search?q=test')).toBe('http://localhost:8080/api/products/search?q=test')
    })

    test('handles nested paths', () => {
      expect(getApiUrl('/cart/items/123')).toBe('http://localhost:8080/api/cart/items/123')
    })
  })
})