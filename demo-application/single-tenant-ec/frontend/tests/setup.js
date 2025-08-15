import { config } from '@vue/test-utils'

// Global test configuration
config.global.mocks = {
  $fetch: jest.fn(),
  $router: {
    push: jest.fn(),
    replace: jest.fn(),
    go: jest.fn(),
    back: jest.fn(),
    forward: jest.fn()
  },
  $route: {
    path: '/',
    params: {},
    query: {},
    hash: ''
  }
}

// Mock Nuxt composables
global.useFetch = jest.fn()
global.useRoute = jest.fn(() => ({
  path: '/',
  params: {},
  query: {},
  hash: ''
}))
global.useRouter = jest.fn(() => ({
  push: jest.fn(),
  replace: jest.fn(),
  go: jest.fn(),
  back: jest.fn(),
  forward: jest.fn()
}))
global.navigateTo = jest.fn()
global.computed = jest.fn()
global.ref = jest.fn()
global.reactive = jest.fn()
global.onMounted = jest.fn()

// Mock process environment
global.process = {
  env: {
    NUXT_PUBLIC_API_BASE_URL: 'http://localhost:8080'
  }
}