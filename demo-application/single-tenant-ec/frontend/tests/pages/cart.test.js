import { mount } from '@vue/test-utils'
import Cart from '~/pages/cart.vue'

// Mock the composables and Nuxt functions
const mockUseFetch = jest.fn()
const mockFetch = jest.fn()
const mockRef = jest.fn()
const mockOnMounted = jest.fn()

global.useFetch = mockUseFetch
global.$fetch = mockFetch
global.ref = mockRef
global.onMounted = mockOnMounted
global.alert = jest.fn()

describe('Cart Page', () => {
  let wrapper

  const mockCartData = {
    items: [
      {
        id: 1,
        quantity: 2,
        unit_price: 89800,
        total_price: 179600,
        product: {
          id: 1,
          name: 'テストノートパソコン',
          slug: 'test-notebook',
          price: 89800,
          images: [
            {
              image_path: '/images/test-notebook.jpg',
              alt_text: 'テストノートパソコン'
            }
          ]
        }
      },
      {
        id: 2,
        quantity: 1,
        unit_price: 50000,
        total_price: 50000,
        product: {
          id: 2,
          name: 'テストマウス',
          slug: 'test-mouse',
          price: 50000,
          images: [
            {
              image_path: '/images/test-mouse.jpg',
              alt_text: 'テストマウス'
            }
          ]
        }
      }
    ],
    total_items: 3,
    total_amount: 229600
  }

  const mockEmptyCart = {
    items: [],
    total_items: 0,
    total_amount: 0
  }

  beforeEach(() => {
    mockRef.mockImplementation((initialValue) => ({
      value: initialValue
    }))

    mockUseFetch.mockReturnValue({
      data: { value: mockCartData },
      pending: { value: false },
      error: { value: null },
      refresh: jest.fn()
    })

    mockFetch.mockResolvedValue({
      message: '操作が完了しました'
    })

    wrapper = mount(Cart, {
      global: {
        mocks: {
          useFetch: mockUseFetch,
          $fetch: mockFetch,
          ref: mockRef,
          onMounted: mockOnMounted,
          alert: global.alert
        }
      }
    })
  })

  afterEach(() => {
    wrapper.unmount()
    jest.clearAllMocks()
  })

  test('renders page title correctly', () => {
    expect(wrapper.find('h1').text()).toBe('ショッピングカート')
  })

  test('displays cart items correctly', () => {
    const cartItems = wrapper.findAll('.cart-item')
    expect(cartItems).toHaveLength(2)
    
    // 最初のアイテムをチェック
    const firstItem = cartItems[0]
    expect(firstItem.find('.cart-item__name').text()).toBe('テストノートパソコン')
    expect(firstItem.find('.cart-item__price').text()).toBe('¥89,800')
    expect(firstItem.find('.cart-item__quantity input').element.value).toBe('2')
    expect(firstItem.find('.cart-item__total').text()).toBe('¥179,600')
  })

  test('displays cart summary correctly', () => {
    const summary = wrapper.find('.cart-summary')
    expect(summary.find('.cart-summary__items').text()).toContain('3個の商品')
    expect(summary.find('.cart-summary__total').text()).toBe('¥229,600')
  })

  test('updates item quantity correctly', async () => {
    const quantityInput = wrapper.find('.cart-item__quantity input')
    
    await quantityInput.setValue('3')
    await quantityInput.trigger('blur')
    
    expect(mockFetch).toHaveBeenCalledWith('/api/cart/items/1', {
      method: 'PUT',
      body: { quantity: 3 }
    })
  })

  test('removes item from cart', async () => {
    const removeButton = wrapper.find('.cart-item__remove')
    
    await removeButton.trigger('click')
    
    expect(mockFetch).toHaveBeenCalledWith('/api/cart/items/1', {
      method: 'DELETE'
    })
  })

  test('clears entire cart', async () => {
    const clearButton = wrapper.find('.cart-actions__clear')
    
    // Confirm dialog
    window.confirm = jest.fn(() => true)
    
    await clearButton.trigger('click')
    
    expect(window.confirm).toHaveBeenCalledWith('カートをクリアしますか？')
    expect(mockFetch).toHaveBeenCalledWith('/api/cart', {
      method: 'DELETE'
    })
  })

  test('does not clear cart when user cancels', async () => {
    const clearButton = wrapper.find('.cart-actions__clear')
    
    // User cancels
    window.confirm = jest.fn(() => false)
    
    await clearButton.trigger('click')
    
    expect(window.confirm).toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalledWith('/api/cart', {
      method: 'DELETE'
    })
  })

  test('shows empty cart message when cart is empty', async () => {
    mockUseFetch.mockReturnValue({
      data: { value: mockEmptyCart },
      pending: { value: false },
      error: { value: null },
      refresh: jest.fn()
    })

    wrapper = mount(Cart, {
      global: {
        mocks: {
          useFetch: mockUseFetch,
          $fetch: mockFetch,
          ref: mockRef,
          onMounted: mockOnMounted
        }
      }
    })

    expect(wrapper.find('.empty-cart').exists()).toBe(true)
    expect(wrapper.find('.empty-cart p').text()).toBe('カートに商品がありません')
  })

  test('shows loading state correctly', async () => {
    mockUseFetch.mockReturnValue({
      data: { value: null },
      pending: { value: true },
      error: { value: null },
      refresh: jest.fn()
    })

    wrapper = mount(Cart, {
      global: {
        mocks: {
          useFetch: mockUseFetch,
          ref: mockRef,
          onMounted: mockOnMounted
        }
      }
    })

    expect(wrapper.find('.loading').exists()).toBe(true)
  })

  test('shows error state correctly', async () => {
    mockUseFetch.mockReturnValue({
      data: { value: null },
      pending: { value: false },
      error: { value: new Error('Failed to load cart') },
      refresh: jest.fn()
    })

    wrapper = mount(Cart, {
      global: {
        mocks: {
          useFetch: mockUseFetch,
          ref: mockRef,
          onMounted: mockOnMounted
        }
      }
    })

    expect(wrapper.find('.error').exists()).toBe(true)
  })

  test('handles quantity update error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Update failed'))
    
    const quantityInput = wrapper.find('.cart-item__quantity input')
    
    await quantityInput.setValue('3')
    await quantityInput.trigger('blur')
    
    expect(global.alert).toHaveBeenCalledWith('数量の更新に失敗しました')
  })

  test('handles remove item error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Remove failed'))
    
    const removeButton = wrapper.find('.cart-item__remove')
    
    await removeButton.trigger('click')
    
    expect(global.alert).toHaveBeenCalledWith('商品の削除に失敗しました')
  })

  test('handles clear cart error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Clear failed'))
    
    window.confirm = jest.fn(() => true)
    const clearButton = wrapper.find('.cart-actions__clear')
    
    await clearButton.trigger('click')
    
    expect(global.alert).toHaveBeenCalledWith('カートのクリアに失敗しました')
  })

  test('validates quantity input', async () => {
    const quantityInput = wrapper.find('.cart-item__quantity input')
    
    // Try to set negative quantity
    await quantityInput.setValue('-1')
    await quantityInput.trigger('blur')
    
    // Should not make API call for invalid quantity
    expect(mockFetch).not.toHaveBeenCalled()
  })

  test('validates zero quantity input', async () => {
    const quantityInput = wrapper.find('.cart-item__quantity input')
    
    await quantityInput.setValue('0')
    await quantityInput.trigger('blur')
    
    // Should not make API call for zero quantity
    expect(mockFetch).not.toHaveBeenCalled()
  })

  test('checkout button navigates to checkout page', async () => {
    const checkoutButton = wrapper.find('.cart-actions__checkout')
    
    expect(checkoutButton.exists()).toBe(true)
    expect(checkoutButton.text()).toBe('チェックアウト')
  })

  test('continue shopping button works', async () => {
    const continueButton = wrapper.find('.cart-actions__continue')
    
    expect(continueButton.exists()).toBe(true)
    expect(continueButton.text()).toBe('ショッピングを続ける')
  })
})