<template>
  <div class="cart-page">
    <div class="container">
      <h1 class="page-title">ショッピングカート</h1>
      
      <div v-if="pending" class="loading">
        <div class="loading__spinner"></div>
      </div>
      
      <div v-else-if="error" class="error">
        <p>カートの読み込みに失敗しました</p>
      </div>
      
      <div v-else-if="!cartData || !cartData.cart || cartData.cart.items.length === 0" class="empty-cart">
        <div class="empty-cart__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h2>カートは空です</h2>
        <p>商品を追加してください</p>
        <NuxtLink to="/products" class="continue-shopping">買い物を続ける</NuxtLink>
      </div>
      
      <div v-else class="cart-content">
        <div class="cart-items">
          <div v-for="item in cartData.cart.items" :key="item.id" class="cart-item">
            <div class="item-image">
              <img 
                v-if="item.product.images && item.product.images[0]"
                :src="item.product.images[0].image_path" 
                :alt="item.product.name"
              >
              <div v-else class="no-image">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            
            <div class="item-details">
              <NuxtLink :to="`/products/${item.product.id}`" class="item-name">
                {{ item.product.name }}
              </NuxtLink>
              <p class="item-price">¥{{ Number(item.price).toLocaleString() }}</p>
              <div class="item-actions">
                <div class="quantity-controls">
                  <button 
                    @click="updateQuantity(item, item.quantity - 1)"
                    :disabled="item.quantity <= 1"
                    class="quantity-btn"
                  >
                    -
                  </button>
                  <input 
                    type="number" 
                    :value="item.quantity"
                    @change="updateQuantity(item, $event.target.value)"
                    min="1"
                    max="99"
                    class="quantity-input"
                  >
                  <button 
                    @click="updateQuantity(item, item.quantity + 1)"
                    :disabled="item.quantity >= 99"
                    class="quantity-btn"
                  >
                    +
                  </button>
                </div>
                <button @click="removeItem(item.id)" class="remove-btn">
                  削除
                </button>
              </div>
            </div>
            
            <div class="item-total">
              ¥{{ Number(item.total).toLocaleString() }}
            </div>
          </div>
        </div>
        
        <div class="cart-summary">
          <h2>注文内容</h2>
          <div class="summary-row">
            <span>小計（{{ cartData.total_items }}点）</span>
            <span>¥{{ Number(cartData.subtotal).toLocaleString() }}</span>
          </div>
          <div class="summary-row">
            <span>配送料</span>
            <span>¥0</span>
          </div>
          <div class="summary-row total">
            <span>合計</span>
            <span>¥{{ Number(cartData.subtotal).toLocaleString() }}</span>
          </div>
          <button class="checkout-btn">レジに進む</button>
          <NuxtLink to="/products" class="continue-shopping-link">買い物を続ける</NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { getApiUrl } from '~/utils/api'

// Cart data
const cartData = ref(null)
const pending = ref(false)
const error = ref(null)

// Fetch cart
const fetchCart = async () => {
  pending.value = true
  error.value = null
  
  try {
    const data = await $fetch(getApiUrl('/cart'))
    cartData.value = data
  } catch (err) {
    error.value = err
  } finally {
    pending.value = false
  }
}

// Update quantity
const updateQuantity = async (item, newQuantity) => {
  const quantity = parseInt(newQuantity)
  if (isNaN(quantity) || quantity < 0) return
  
  try {
    if (quantity === 0) {
      await removeItem(item.id)
    } else {
      const data = await $fetch(getApiUrl(`/cart/items/${item.id}`), {
        method: 'PUT',
        body: { quantity }
      })
      cartData.value = data
    }
  } catch (error) {
    alert('数量の更新に失敗しました')
  }
}

// Remove item
const removeItem = async (itemId) => {
  if (!confirm('この商品をカートから削除しますか？')) return
  
  try {
    const data = await $fetch(getApiUrl(`/cart/items/${itemId}`), {
      method: 'DELETE'
    })
    cartData.value = data
  } catch (error) {
    alert('商品の削除に失敗しました')
  }
}

// Fetch cart on mount
await fetchCart()
</script>

<style lang="scss" scoped>
.cart-page {
  min-height: 100vh;
  padding: 2rem 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.page-title {
  font-size: 2rem;
  margin-bottom: 2rem;
}

.loading {
  display: flex;
  justify-content: center;
  padding: 4rem;
  
  &__spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error {
  text-align: center;
  padding: 4rem;
  color: #dc3545;
}

.empty-cart {
  text-align: center;
  padding: 4rem;
  
  &__icon {
    margin: 0 auto 2rem;
    width: 100px;
    height: 100px;
    
    svg {
      width: 100%;
      height: 100%;
      color: #6c757d;
    }
  }
  
  h2 {
    font-size: 1.5rem;
    margin-bottom: 1rem;
  }
  
  p {
    color: #6c757d;
    margin-bottom: 2rem;
  }
  
  .continue-shopping {
    display: inline-block;
    padding: 0.75rem 2rem;
    background-color: #667eea;
    color: white;
    text-decoration: none;
    border-radius: 4px;
    
    &:hover {
      background-color: #5a67d8;
    }
  }
}

.cart-content {
  display: grid;
  grid-template-columns: 1fr 350px;
  gap: 2rem;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.cart-items {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
}

.cart-item {
  display: grid;
  grid-template-columns: 100px 1fr 150px;
  gap: 1.5rem;
  padding: 1.5rem 0;
  border-bottom: 1px solid #e9ecef;
  
  &:last-child {
    border-bottom: none;
  }
  
  @media (max-width: 640px) {
    grid-template-columns: 80px 1fr;
    
    .item-total {
      grid-column: 2;
      text-align: left;
      margin-top: 0.5rem;
    }
  }
  
  .item-image {
    width: 100px;
    height: 100px;
    border-radius: 4px;
    overflow: hidden;
    
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    @media (max-width: 640px) {
      width: 80px;
      height: 80px;
    }
  }
  
  .no-image {
    width: 100%;
    height: 100%;
    background-color: #f3f4f6;
    display: flex;
    align-items: center;
    justify-content: center;
    
    svg {
      width: 40px;
      height: 40px;
      color: #d1d5db;
    }
  }
  
  .item-details {
    .item-name {
      font-size: 1.1rem;
      color: inherit;
      text-decoration: none;
      display: block;
      margin-bottom: 0.5rem;
      
      &:hover {
        color: #667eea;
      }
    }
    
    .item-price {
      color: #6c757d;
      margin-bottom: 1rem;
    }
    
    .item-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    
    .quantity-controls {
      display: flex;
      align-items: center;
      border: 1px solid #ddd;
      border-radius: 4px;
      
      .quantity-btn {
        width: 32px;
        height: 32px;
        border: none;
        background: none;
        cursor: pointer;
        font-size: 1.2rem;
        
        &:hover:not(:disabled) {
          background: #f8f9fa;
        }
        
        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }
      
      .quantity-input {
        width: 50px;
        height: 32px;
        border: none;
        text-align: center;
        font-size: 1rem;
      }
    }
    
    .remove-btn {
      color: #dc3545;
      background: none;
      border: none;
      cursor: pointer;
      text-decoration: underline;
      
      &:hover {
        color: #c82333;
      }
    }
  }
  
  .item-total {
    text-align: right;
    font-size: 1.2rem;
    font-weight: bold;
  }
}

.cart-summary {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  height: fit-content;
  
  h2 {
    font-size: 1.3rem;
    margin-bottom: 1.5rem;
  }
  
  .summary-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 1rem;
    
    &.total {
      font-size: 1.2rem;
      font-weight: bold;
      padding-top: 1rem;
      border-top: 1px solid #e9ecef;
    }
  }
  
  .checkout-btn {
    width: 100%;
    padding: 1rem;
    background-color: #febd69;
    border: none;
    border-radius: 4px;
    font-size: 1.1rem;
    font-weight: bold;
    cursor: pointer;
    margin-bottom: 1rem;
    transition: background-color 0.2s;
    
    &:hover {
      background-color: #f3a847;
    }
  }
  
  .continue-shopping-link {
    display: block;
    text-align: center;
    color: #667eea;
    text-decoration: none;
    
    &:hover {
      text-decoration: underline;
    }
  }
}
</style>