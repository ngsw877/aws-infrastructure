import { mount } from '@vue/test-utils'
import Index from '~/pages/index.vue'

// Mock the composables and Nuxt functions
const mockUseFetch = jest.fn()
const mockNavigateTo = jest.fn()

global.useFetch = mockUseFetch
global.navigateTo = mockNavigateTo
global.computed = jest.fn((fn) => ({ value: fn() }))

describe('Index Page', () => {
  let wrapper

  const mockCategories = [
    { id: 1, name: '電子機器', slug: 'electronics' },
    { id: 2, name: 'ファッション', slug: 'fashion' }
  ]

  const mockFeaturedProducts = [
    {
      id: 1,
      name: 'テスト商品1',
      slug: 'test-product-1',
      price: 10000,
      images: [{ image_path: '/test1.jpg', alt_text: 'テスト1' }]
    },
    {
      id: 2,
      name: 'テスト商品2',
      slug: 'test-product-2',
      price: 20000,
      images: [{ image_path: '/test2.jpg', alt_text: 'テスト2' }]
    }
  ]

  beforeEach(() => {
    mockUseFetch.mockImplementation((url) => {
      if (url.includes('/categories')) {
        return {
          data: { value: mockCategories },
          pending: { value: false },
          error: { value: null }
        }
      }
      if (url.includes('/products')) {
        return {
          data: { value: { data: mockFeaturedProducts } },
          pending: { value: false },
          error: { value: null }
        }
      }
      return {
        data: { value: null },
        pending: { value: false },
        error: { value: null }
      }
    })

    wrapper = mount(Index, {
      global: {
        mocks: {
          $fetch: jest.fn(),
          useFetch: mockUseFetch,
          navigateTo: mockNavigateTo,
          computed
        }
      }
    })
  })

  afterEach(() => {
    wrapper.unmount()
    jest.clearAllMocks()
  })

  test('renders page title correctly', () => {
    expect(wrapper.find('h1').text()).toBe('カテゴリー')
  })

  test('displays categories when loaded', async () => {
    await wrapper.vm.$nextTick()
    
    const categoryItems = wrapper.findAll('.category-card')
    expect(categoryItems).toHaveLength(mockCategories.length)
  })

  test('displays featured products when loaded', async () => {
    await wrapper.vm.$nextTick()
    
    const productItems = wrapper.findAll('.product-card')
    expect(productItems).toHaveLength(mockFeaturedProducts.length)
  })

  test('shows loading state when categories are pending', () => {
    mockUseFetch.mockImplementation(() => ({
      data: { value: null },
      pending: { value: true },
      error: { value: null }
    }))

    wrapper = mount(Index, {
      global: {
        mocks: {
          useFetch: mockUseFetch
        }
      }
    })

    expect(wrapper.find('.loading').exists()).toBe(true)
  })

  test('shows error state when there is an error', () => {
    mockUseFetch.mockImplementation(() => ({
      data: { value: null },
      pending: { value: false },
      error: { value: new Error('API Error') }
    }))

    wrapper = mount(Index, {
      global: {
        mocks: {
          useFetch: mockUseFetch
        }
      }
    })

    expect(wrapper.find('.error').exists()).toBe(true)
  })

  test('category card navigation works', async () => {
    await wrapper.vm.$nextTick()
    
    const firstCategoryCard = wrapper.find('.category-card')
    await firstCategoryCard.trigger('click')
    
    expect(mockNavigateTo).toHaveBeenCalledWith('/products?category=1')
  })

  test('product card displays correct information', async () => {
    await wrapper.vm.$nextTick()
    
    const firstProductCard = wrapper.find('.product-card')
    expect(firstProductCard.find('.product-card__name').text()).toBe('テスト商品1')
    expect(firstProductCard.find('.product-card__price').text()).toMatch('¥10,000')
  })

  test('product image displays with correct attributes', async () => {
    await wrapper.vm.$nextTick()
    
    const productImage = wrapper.find('.product-card img')
    expect(productImage.attributes('src')).toBe('/test1.jpg')
    expect(productImage.attributes('alt')).toBe('テスト1')
  })

  test('handles empty categories gracefully', () => {
    mockUseFetch.mockImplementation(() => ({
      data: { value: [] },
      pending: { value: false },
      error: { value: null }
    }))

    wrapper = mount(Index, {
      global: {
        mocks: {
          useFetch: mockUseFetch
        }
      }
    })

    expect(wrapper.findAll('.category-card')).toHaveLength(0)
  })

  test('handles empty featured products gracefully', () => {
    mockUseFetch.mockImplementation((url) => {
      if (url.includes('/categories')) {
        return {
          data: { value: mockCategories },
          pending: { value: false },
          error: { value: null }
        }
      }
      return {
        data: { value: { data: [] } },
        pending: { value: false },
        error: { value: null }
      }
    })

    wrapper = mount(Index, {
      global: {
        mocks: {
          useFetch: mockUseFetch
        }
      }
    })

    expect(wrapper.findAll('.product-card')).toHaveLength(0)
  })
})