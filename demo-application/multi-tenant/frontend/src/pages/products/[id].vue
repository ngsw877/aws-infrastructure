<template>
  <div class="product-detail-page">
    <div v-if="pending" class="loading-container">
      <div class="loading">
        <div class="loading__spinner"></div>
        <p class="loading__text">商品情報を読み込み中...</p>
      </div>
    </div>
    
    <div v-else-if="error" class="error-container">
      <div class="error">
        <h2 class="error__title">商品が見つかりません</h2>
        <p class="error__message">{{ error }}</p>
        <NuxtLink to="/" class="error__link">トップページに戻る</NuxtLink>
      </div>
    </div>
    
    <div v-else class="container">
      <NuxtLink to="/" class="back-link">
        ← 商品一覧に戻る
      </NuxtLink>
      
      <div class="product-detail">
        <div class="product-detail__image-section">
          <img 
            :src="productData?.product?.image_url" 
            :alt="productData?.product?.name"
            class="product-detail__image"
          />
          <div v-if="!productData?.product?.in_stock" class="product-detail__out-of-stock">
            在庫切れ
          </div>
        </div>
        
        <div class="product-detail__info-section">
          <h1 class="product-detail__name">{{ productData?.product?.name }}</h1>
          <p class="product-detail__description">{{ productData?.product?.description }}</p>
          
          <div class="product-detail__price-section">
            <span class="product-detail__price">¥{{ productData?.product?.price?.toLocaleString() }}</span>
            <span v-if="productData?.product?.in_stock" class="product-detail__stock">
              在庫: {{ productData?.product?.stock }}点
            </span>
          </div>
          
          <div v-if="productData?.product?.in_stock" class="product-detail__actions">
            <button class="btn btn--primary" disabled>
              カートに追加（機能未実装）
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { getApiUrl } from '~/utils/api'

const route = useRoute()
const productId = route.params.id

// 商品詳細の取得
const { data: productData, pending, error } = await useFetch(getApiUrl(`/products/${productId}`))
</script>

<style lang="scss" scoped>
.product-detail-page {
  min-height: 100vh;
  background-color: #f7fafc;
  padding: 40px 0;
}

.loading-container,
.error-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 80px);
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
    margin-bottom: 24px;
  }
  
  &__link {
    color: #3490dc;
    text-decoration: none;
    font-weight: 500;
    
    &:hover {
      text-decoration: underline;
    }
  }
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;
}

.back-link {
  display: inline-block;
  color: #3490dc;
  text-decoration: none;
  margin-bottom: 32px;
  font-weight: 500;
  
  &:hover {
    text-decoration: underline;
  }
}

.product-detail {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 64px;
  background: white;
  border-radius: 12px;
  padding: 48px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 32px;
    padding: 24px;
  }
  
  &__image-section {
    position: relative;
  }
  
  &__image {
    width: 100%;
    height: auto;
    border-radius: 8px;
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
    font-size: 24px;
    font-weight: 600;
    border-radius: 8px;
  }
  
  &__info-section {
    display: flex;
    flex-direction: column;
  }
  
  &__name {
    font-size: 36px;
    font-weight: 700;
    color: #2d3748;
    margin-bottom: 16px;
  }
  
  &__description {
    font-size: 18px;
    color: #718096;
    line-height: 1.6;
    margin-bottom: 32px;
  }
  
  &__price-section {
    display: flex;
    align-items: baseline;
    gap: 24px;
    margin-bottom: 32px;
  }
  
  &__price {
    font-size: 48px;
    font-weight: 700;
    color: #2d3748;
  }
  
  &__stock {
    color: #48bb78;
    font-size: 18px;
    font-weight: 500;
  }
  
  &__actions {
    margin-top: auto;
  }
}

.btn {
  padding: 16px 32px;
  font-size: 18px;
  font-weight: 600;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  
  &--primary {
    background-color: #3490dc;
    color: white;
    
    &:hover:not(:disabled) {
      background-color: #2779bd;
    }
    
    &:disabled {
      background-color: #cbd5e0;
      cursor: not-allowed;
    }
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>