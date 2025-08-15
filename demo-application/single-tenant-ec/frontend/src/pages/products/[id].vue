<template>
  <div class="product-detail-page">
    <div class="container">
      <div v-if="pending" class="loading">
        <div class="loading__spinner"></div>
      </div>
      <div v-else-if="error" class="error">
        <h2>商品が見つかりませんでした</h2>
        <NuxtLink to="/products" class="back-link">商品一覧に戻る</NuxtLink>
      </div>
      <div v-else-if="data" class="product-detail">
        <!-- Breadcrumb -->
        <nav class="breadcrumb">
          <NuxtLink to="/">ホーム</NuxtLink>
          <span>/</span>
          <NuxtLink to="/products">商品一覧</NuxtLink>
          <span>/</span>
          <span>{{ data.product.name }}</span>
        </nav>
        
        <div class="product-content">
          <!-- Images Section -->
          <div class="product-images">
            <div class="main-image">
              <img 
                v-if="selectedImage"
                :src="selectedImage.image_path" 
                :alt="data.product.name"
              >
              <div v-else class="no-image">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div v-if="data.product.images.length > 1" class="thumbnail-list">
              <button
                v-for="image in data.product.images"
                :key="image.id"
                @click="selectedImage = image"
                :class="['thumbnail', { active: selectedImage?.id === image.id }]"
              >
                <img :src="image.image_path" :alt="image.alt_text">
              </button>
            </div>
          </div>
          
          <!-- Product Info -->
          <div class="product-info">
            <h1 class="product-name">{{ data.product.name }}</h1>
            
            <!-- Price -->
            <div class="price-section">
              <div class="price">
                <span class="current-price">¥{{ Number(data.product.price).toLocaleString() }}</span>
                <span v-if="data.product.compare_price" class="compare-price">
                  ¥{{ Number(data.product.compare_price).toLocaleString() }}
                </span>
                <span v-if="data.product.discount_percentage" class="discount-badge">
                  {{ data.product.discount_percentage }}% OFF
                </span>
              </div>
              <p class="tax-info">税込</p>
            </div>
            
            <!-- Rating -->
            <div v-if="data.review_stats.total_reviews > 0" class="rating-section">
              <div class="stars">
                <span v-for="i in 5" :key="i" class="star" :class="{ filled: i <= Math.round(data.review_stats.average_rating) }">
                  ★
                </span>
              </div>
              <span class="rating-text">
                {{ data.review_stats.average_rating.toFixed(1) }} ({{ data.review_stats.total_reviews }}件のレビュー)
              </span>
            </div>
            
            <!-- Add to Cart -->
            <div class="purchase-section">
              <div class="quantity-selector">
                <label>数量:</label>
                <select v-model.number="quantity">
                  <option v-for="i in 10" :key="i" :value="i">{{ i }}</option>
                </select>
              </div>
              
              <div class="stock-status">
                <span v-if="data.product.in_stock" class="in-stock">
                  ✓ 在庫あり
                </span>
                <span v-else class="out-of-stock">
                  ✗ 在庫切れ
                </span>
              </div>
              
              <button 
                @click="addToCart"
                :disabled="!data.product.in_stock"
                class="add-to-cart-button"
              >
                カートに追加
              </button>
            </div>
            
            <!-- Product Details -->
            <div class="product-details">
              <h2>商品詳細</h2>
              <div class="description">
                <p>{{ data.product.description }}</p>
              </div>
              
              <div v-if="data.product.sku" class="detail-item">
                <span class="label">商品コード:</span>
                <span>{{ data.product.sku }}</span>
              </div>
              
              <div class="detail-item">
                <span class="label">カテゴリー:</span>
                <NuxtLink :to="`/products?category=${data.product.category.id}`">
                  {{ data.product.category.name }}
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Reviews Section -->
        <div v-if="data.review_stats.total_reviews > 0" class="reviews-section">
          <h2>カスタマーレビュー</h2>
          
          <div class="review-summary">
            <div class="rating-breakdown">
              <div class="average-rating">
                <span class="rating-number">{{ data.review_stats.average_rating.toFixed(1) }}</span>
                <div class="stars">
                  <span v-for="i in 5" :key="i" class="star" :class="{ filled: i <= Math.round(data.review_stats.average_rating) }">
                    ★
                  </span>
                </div>
                <p>{{ data.review_stats.total_reviews }}件のレビュー</p>
              </div>
              
              <div class="rating-bars">
                <div v-for="rating in [5,4,3,2,1]" :key="rating" class="rating-bar">
                  <span class="rating-label">{{ rating }}★</span>
                  <div class="bar">
                    <div 
                      class="bar-fill" 
                      :style="`width: ${(data.review_stats.rating_breakdown[rating] / data.review_stats.total_reviews) * 100}%`"
                    ></div>
                  </div>
                  <span class="rating-count">{{ data.review_stats.rating_breakdown[rating] }}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="review-list">
            <div v-for="review in data.product.reviews" :key="review.id" class="review-item">
              <div class="review-header">
                <div class="reviewer-info">
                  <span class="reviewer-name">{{ review.user.name }}</span>
                  <span v-if="review.is_verified_purchase" class="verified-badge">確認済み購入</span>
                </div>
                <div class="review-rating">
                  <span v-for="i in 5" :key="i" class="star" :class="{ filled: i <= review.rating }">
                    ★
                  </span>
                </div>
              </div>
              <h4 class="review-title">{{ review.title }}</h4>
              <p class="review-comment">{{ review.comment }}</p>
              <span class="review-date">{{ new Date(review.created_at).toLocaleDateString() }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { getApiUrl } from '~/utils/api'

const route = useRoute()
const quantity = ref(1)

// Fetch product data
const { data, pending, error } = await useFetch(getApiUrl(`/products/${route.params.id}`))

// Selected image
const selectedImage = ref(data.value?.product?.images?.[0] || null)

// Add to cart
const addToCart = async () => {
  try {
    await $fetch(getApiUrl('/cart/items'), {
      method: 'POST',
      body: {
        product_id: data.value.product.id,
        quantity: quantity.value
      }
    })
    alert(`${quantity.value}個の商品をカートに追加しました`)
  } catch (error) {
    alert('カートへの追加に失敗しました')
  }
}
</script>

<style lang="scss" scoped>
.product-detail-page {
  min-height: 100vh;
  padding: 2rem 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
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
  
  h2 {
    margin-bottom: 1rem;
  }
}

.back-link {
  color: #667eea;
  text-decoration: none;
  
  &:hover {
    text-decoration: underline;
  }
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 2rem;
  font-size: 0.9rem;
  color: #6c757d;
  
  a {
    color: #667eea;
    text-decoration: none;
    
    &:hover {
      text-decoration: underline;
    }
  }
}

.product-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  margin-bottom: 3rem;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
}

.product-images {
  .main-image {
    width: 100%;
    height: 500px;
    background: white;
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 1rem;
    
    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
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
      width: 100px;
      height: 100px;
      color: #d1d5db;
    }
  }
  
  .thumbnail-list {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
  }
  
  .thumbnail {
    width: 80px;
    height: 80px;
    border: 2px solid transparent;
    border-radius: 4px;
    overflow: hidden;
    cursor: pointer;
    background: white;
    
    &.active {
      border-color: #667eea;
    }
    
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }
}

.product-info {
  .product-name {
    font-size: 1.8rem;
    margin-bottom: 1rem;
  }
  
  .price-section {
    margin-bottom: 1rem;
    
    .price {
      display: flex;
      align-items: baseline;
      gap: 1rem;
    }
    
    .current-price {
      font-size: 2rem;
      font-weight: bold;
      color: #dc3545;
    }
    
    .compare-price {
      font-size: 1.2rem;
      color: #6c757d;
      text-decoration: line-through;
    }
    
    .discount-badge {
      background: #dc3545;
      color: white;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.9rem;
    }
    
    .tax-info {
      color: #6c757d;
      font-size: 0.9rem;
      margin-top: 0.5rem;
    }
  }
  
  .rating-section {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
    
    .stars {
      display: flex;
    }
    
    .star {
      color: #ddd;
      font-size: 1.2rem;
      
      &.filled {
        color: #ffc107;
      }
    }
    
    .rating-text {
      color: #6c757d;
    }
  }
  
  .purchase-section {
    background: #f8f9fa;
    padding: 1.5rem;
    border-radius: 8px;
    margin-bottom: 2rem;
    
    .quantity-selector {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;
      
      select {
        padding: 0.5rem;
        border: 1px solid #ddd;
        border-radius: 4px;
      }
    }
    
    .stock-status {
      margin-bottom: 1rem;
      
      .in-stock {
        color: #28a745;
      }
      
      .out-of-stock {
        color: #dc3545;
      }
    }
    
    .add-to-cart-button {
      width: 100%;
      padding: 1rem;
      background-color: #febd69;
      border: none;
      border-radius: 4px;
      font-size: 1.1rem;
      font-weight: bold;
      cursor: pointer;
      transition: background-color 0.2s;
      
      &:hover:not(:disabled) {
        background-color: #f3a847;
      }
      
      &:disabled {
        background-color: #e9ecef;
        color: #6c757d;
        cursor: not-allowed;
      }
    }
  }
  
  .product-details {
    h2 {
      font-size: 1.3rem;
      margin-bottom: 1rem;
    }
    
    .description {
      margin-bottom: 1.5rem;
      line-height: 1.6;
    }
    
    .detail-item {
      display: flex;
      gap: 1rem;
      margin-bottom: 0.5rem;
      
      .label {
        font-weight: bold;
      }
      
      a {
        color: #667eea;
        text-decoration: none;
        
        &:hover {
          text-decoration: underline;
        }
      }
    }
  }
}

.reviews-section {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  
  h2 {
    font-size: 1.5rem;
    margin-bottom: 2rem;
  }
  
  .review-summary {
    margin-bottom: 2rem;
    
    .rating-breakdown {
      display: grid;
      grid-template-columns: 200px 1fr;
      gap: 2rem;
      
      @media (max-width: 768px) {
        grid-template-columns: 1fr;
      }
    }
    
    .average-rating {
      text-align: center;
      
      .rating-number {
        font-size: 3rem;
        font-weight: bold;
      }
      
      .stars {
        display: flex;
        justify-content: center;
        margin: 0.5rem 0;
      }
    }
    
    .rating-bars {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      
      .rating-bar {
        display: grid;
        grid-template-columns: 40px 1fr 40px;
        align-items: center;
        gap: 1rem;
        
        .bar {
          height: 8px;
          background: #e9ecef;
          border-radius: 4px;
          overflow: hidden;
          
          .bar-fill {
            height: 100%;
            background: #ffc107;
          }
        }
        
        .rating-count {
          text-align: right;
          color: #6c757d;
        }
      }
    }
  }
  
  .review-list {
    .review-item {
      border-bottom: 1px solid #e9ecef;
      padding: 1.5rem 0;
      
      &:last-child {
        border-bottom: none;
      }
      
      .review-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
        
        .reviewer-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          
          .reviewer-name {
            font-weight: bold;
          }
          
          .verified-badge {
            background: #28a745;
            color: white;
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            font-size: 0.8rem;
          }
        }
      }
      
      .review-title {
        font-weight: bold;
        margin-bottom: 0.5rem;
      }
      
      .review-comment {
        line-height: 1.6;
        margin-bottom: 0.5rem;
      }
      
      .review-date {
        color: #6c757d;
        font-size: 0.9rem;
      }
    }
  }
}

.star {
  color: #ddd;
  
  &.filled {
    color: #ffc107;
  }
}
</style>