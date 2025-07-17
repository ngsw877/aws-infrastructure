<template>
  <div class="shop-page">
    <div v-if="shopPending || productsPending" class="loading-container">
      <div class="loading">
        <div class="loading__spinner"></div>
        <p class="loading__text">読み込み中...</p>
      </div>
    </div>
    
    <div v-else-if="shopError || productsError" class="error-container">
      <div class="error">
        <h2 class="error__title">エラーが発生しました</h2>
        <p class="error__message">{{ shopError || productsError }}</p>
      </div>
    </div>
    
    <div v-else class="container">
      <!-- Shop Header -->
      <header class="shop-header" :style="headerStyle">
        <div class="shop-header__content">
          <h1 class="shop-header__title">{{ shopData?.shop?.name }}</h1>
          <p class="shop-header__description">{{ shopData?.shop?.description }}</p>
        </div>
      </header>

      <!-- Products Section -->
      <section class="products-section">
        <h2 class="products-section__title">商品一覧</h2>
        
        <div v-if="!productsData?.products?.length" class="no-products">
          <p>現在、商品がありません。</p>
        </div>
        
        <div v-else class="products-grid">
          <NuxtLink
            v-for="product in productsData.products"
            :key="product.id"
            :to="`/products/${product.id}`"
            class="product-card"
          >
            <div class="product-card__image">
              <img :src="product.image_url.startsWith('/') ? product.image_url : product.image_url" :alt="product.name" />
              <div v-if="!product.in_stock" class="product-card__out-of-stock">
                在庫切れ
              </div>
            </div>
            <div class="product-card__content">
              <h3 class="product-card__name">{{ product.name }}</h3>
              <p class="product-card__description">{{ product.description }}</p>
              <div class="product-card__footer">
                <span class="product-card__price">¥{{ product.price.toLocaleString() }}</span>
                <span v-if="product.in_stock" class="product-card__stock">在庫: {{ product.stock }}</span>
              </div>
            </div>
          </NuxtLink>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { getApiUrl } from '~/utils/api'
import { computed } from 'vue'

// ショップ情報の取得
const { data: shopData, pending: shopPending, error: shopError } = await useFetch(getApiUrl('/shop'))

// 商品一覧の取得
const { data: productsData, pending: productsPending, error: productsError } = await useFetch(getApiUrl('/products'))

// テーマ設定に基づくヘッダースタイル
const headerStyle = computed(() => {
  const theme = shopData.value?.shop?.theme_settings || {}
  return {
    backgroundColor: theme.primary_color || '#3490dc',
    color: '#ffffff'
  }
})
</script>

<style lang="scss" scoped>
.shop-page {
  min-height: 100vh;
  background-color: #f7fafc;
}

.loading-container,
.error-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}

.loading {
  text-align: center;
  
  &__spinner {
    width: 48px;
    height: 48px;
    border: 4px solid #e2e8f0;
    border-top-color: #3490dc;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 16px;
  }
  
  &__text {
    color: #718096;
    font-size: 16px;
  }
}

.error {
  text-align: center;
  padding: 40px;
  
  &__title {
    font-size: 24px;
    color: #e53e3e;
    margin-bottom: 8px;
  }
  
  &__message {
    color: #718096;
  }
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;
}

.shop-header {
  padding: 80px 0;
  margin-bottom: 48px;
  text-align: center;
  position: relative;
  
  &__content {
    position: relative;
    z-index: 1;
  }
  
  &__title {
    font-size: 48px;
    font-weight: 700;
    margin-bottom: 16px;
  }
  
  &__description {
    font-size: 20px;
    opacity: 0.9;
  }
}

.products-section {
  padding-bottom: 80px;
  
  &__title {
    font-size: 32px;
    font-weight: 600;
    color: #2d3748;
    margin-bottom: 32px;
    text-align: center;
  }
}

.no-products {
  text-align: center;
  padding: 80px 0;
  color: #718096;
  font-size: 18px;
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 32px;
}

.product-card {
  display: block;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s, box-shadow 0.2s;
  text-decoration: none;
  color: inherit;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
  }
  
  &__image {
    position: relative;
    width: 100%;
    height: 250px;
    overflow: hidden;
    
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }
  
  &__out-of-stock {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 600;
  }
  
  &__content {
    padding: 24px;
  }
  
  &__name {
    font-size: 20px;
    font-weight: 600;
    color: #2d3748;
    margin-bottom: 8px;
  }
  
  &__description {
    color: #718096;
    font-size: 14px;
    line-height: 1.5;
    margin-bottom: 16px;
  }
  
  &__footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  &__price {
    font-size: 24px;
    font-weight: 700;
    color: #2d3748;
  }
  
  &__stock {
    color: #48bb78;
    font-size: 14px;
    font-weight: 500;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
