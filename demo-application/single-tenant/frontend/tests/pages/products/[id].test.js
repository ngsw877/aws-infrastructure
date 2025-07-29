import { mount } from '@vue/test-utils'
import ProductDetail from '~/pages/products/[id].vue'

// Mock the composables and Nuxt functions
const mockUseFetch = jest.fn()
const mockUseRoute = jest.fn()
const mockFetch = jest.fn()

global.useFetch = mockUseFetch
global.useRoute = mockUseRoute
global.$fetch = mockFetch
global.computed = jest.fn((fn) => ({ value: fn() }))
global.alert = jest.fn()

describe('Product Detail Page', () => {
  let wrapper

  const mockProduct = {
    id: 1,
    name: 'テストノートパソコン',
    slug: 'test-notebook',
    description: 'これはテスト用のノートパソコンです。高性能で軽量、持ち運びに便利です。',
    short_description: 'テスト用ノートPC',
    price: 89800,
    compare_price: 119800,
    sku: 'TEST-NB-001',
    stock_quantity: 10,
    is_featured: true,
    category: {
      id: 1,
      name: '電子機器',
      slug: 'electronics'
    },
    images: [
      {
        id: 1,
        image_path: '/images/test-notebook-1.jpg',
        alt_text: 'テストノートパソコン メイン画像',
        is_primary: true
      },
      {
        id: 2,
        image_path: '/images/test-notebook-2.jpg',
        alt_text: 'テストノートパソコン サブ画像',
        is_primary: false
      }
    ]
  }

  beforeEach(() => {
    mockUseRoute.mockReturnValue({
      params: { id: '1' }
    })

    mockUseFetch.mockReturnValue({
      data: { value: mockProduct },
      pending: { value: false },
      error: { value: null }
    })

    mockFetch.mockResolvedValue({
      message: 'カートに追加しました'
    })

    wrapper = mount(ProductDetail, {
      global: {
        mocks: {
          useFetch: mockUseFetch,
          useRoute: mockUseRoute,
          $fetch: mockFetch,
          alert: global.alert
        }
      }
    })
  })

  afterEach(() => {
    wrapper.unmount()
    jest.clearAllMocks()
  })

  test('renders product information correctly', () => {
    expect(wrapper.find('h1').text()).toBe('テストノートパソコン')
    expect(wrapper.find('.product-detail__description').text()).toContain('これはテスト用のノートパソコンです')
    expect(wrapper.find('.product-detail__price-current').text()).toBe('¥89,800')
    expect(wrapper.find('.product-detail__price-compare').text()).toBe('¥119,800')
    expect(wrapper.find('.product-detail__sku').text()).toContain('TEST-NB-001')
  })

  test('displays product images correctly', () => {
    const images = wrapper.findAll('.product-detail__image img')
    expect(images).toHaveLength(2)
    expect(images[0].attributes('src')).toBe('/images/test-notebook-1.jpg')
    expect(images[0].attributes('alt')).toBe('テストノートパソコン メイン画像')
  })

  test('shows discount badge when compare price exists', () => {
    const discountBadge = wrapper.find('.product-detail__discount')
    expect(discountBadge.exists()).toBe(true)
    expect(discountBadge.text()).toContain('-25%') // (119800 - 89800) / 119800 * 100 ≈ 25%
  })

  test('displays stock status correctly when in stock', () => {
    const stockStatus = wrapper.find('.product-detail__stock')
    expect(stockStatus.text()).toContain('在庫あり')
    expect(stockStatus.classes()).toContain('in-stock')
  })

  test('displays out of stock status correctly', async () => {
    const outOfStockProduct = { ...mockProduct, stock_quantity: 0 }
    mockUseFetch.mockReturnValue({
      data: { value: outOfStockProduct },
      pending: { value: false },
      error: { value: null }
    })

    wrapper = mount(ProductDetail, {
      global: {
        mocks: {
          useFetch: mockUseFetch,
          useRoute: mockUseRoute
        }
      }
    })

    const stockStatus = wrapper.find('.product-detail__stock')
    expect(stockStatus.text()).toContain('在庫切れ')
    expect(stockStatus.classes()).toContain('out-of-stock')
  })

  test('add to cart button is enabled when in stock', () => {
    const addToCartButton = wrapper.find('.product-detail__add-to-cart')
    expect(addToCartButton.attributes('disabled')).toBeUndefined()
    expect(addToCartButton.text()).toBe('カートに追加')
  })

  test('add to cart button is disabled when out of stock', async () => {
    const outOfStockProduct = { ...mockProduct, stock_quantity: 0 }
    mockUseFetch.mockReturnValue({
      data: { value: outOfStockProduct },
      pending: { value: false },
      error: { value: null }
    })

    wrapper = mount(ProductDetail, {
      global: {
        mocks: {
          useFetch: mockUseFetch,
          useRoute: mockUseRoute
        }
      }
    })

    const addToCartButton = wrapper.find('.product-detail__add-to-cart')
    expect(addToCartButton.attributes('disabled')).toBeDefined()
  })

  test('quantity input works correctly', async () => {
    const quantityInput = wrapper.find('.quantity-input')
    await quantityInput.setValue('3')
    
    expect(quantityInput.element.value).toBe('3')
  })

  test('quantity cannot exceed stock quantity', async () => {
    const quantityInput = wrapper.find('.quantity-input')
    await quantityInput.setValue('15') // 在庫は10個
    
    // バリデーションロジックがある場合のテスト
    expect(parseInt(quantityInput.element.value)).toBeLessThanOrEqual(mockProduct.stock_quantity)
  })

  test('add to cart functionality works', async () => {
    const quantityInput = wrapper.find('.quantity-input')
    const addToCartButton = wrapper.find('.product-detail__add-to-cart')
    
    await quantityInput.setValue('2')
    await addToCartButton.trigger('click')
    
    expect(mockFetch).toHaveBeenCalledWith('/api/cart/items', {
      method: 'POST',
      body: {
        product_id: mockProduct.id,
        quantity: 2
      }
    })
    
    expect(global.alert).toHaveBeenCalledWith('カートに追加しました')
  })

  test('handles add to cart error', async () => {
    mockFetch.mockRejectedValue(new Error('API Error'))
    
    const addToCartButton = wrapper.find('.product-detail__add-to-cart')
    await addToCartButton.trigger('click')
    
    expect(global.alert).toHaveBeenCalledWith('カートへの追加に失敗しました')
  })

  test('shows loading state correctly', async () => {
    mockUseFetch.mockReturnValue({
      data: { value: null },
      pending: { value: true },
      error: { value: null }
    })

    wrapper = mount(ProductDetail, {
      global: {
        mocks: {
          useFetch: mockUseFetch,
          useRoute: mockUseRoute
        }
      }
    })

    expect(wrapper.find('.loading').exists()).toBe(true)
  })

  test('shows error state correctly', async () => {
    mockUseFetch.mockReturnValue({
      data: { value: null },
      pending: { value: false },
      error: { value: new Error('Product not found') }
    })

    wrapper = mount(ProductDetail, {
      global: {
        mocks: {
          useFetch: mockUseFetch,
          useRoute: mockUseRoute
        }
      }
    })

    expect(wrapper.find('.error').exists()).toBe(true)
  })

  test('displays category information correctly', () => {
    const categoryInfo = wrapper.find('.product-detail__category')
    expect(categoryInfo.text()).toContain('電子機器')
  })

  test('displays product features when available', () => {
    const featuredBadge = wrapper.find('.product-detail__featured')
    expect(featuredBadge.exists()).toBe(true)
  })

  test('handles product without images', async () => {
    const productWithoutImages = { ...mockProduct, images: [] }
    mockUseFetch.mockReturnValue({
      data: { value: productWithoutImages },
      pending: { value: false },
      error: { value: null }
    })

    wrapper = mount(ProductDetail, {
      global: {
        mocks: {
          useFetch: mockUseFetch,
          useRoute: mockUseRoute
        }
      }
    })

    const noImagePlaceholder = wrapper.find('.product-detail__no-image')
    expect(noImagePlaceholder.exists()).toBe(true)
  })
})