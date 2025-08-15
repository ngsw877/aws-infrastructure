<template>
  <div class="search-page">
    <div class="container">
      <div class="search-header">
        <h1 class="page-title">検索結果</h1>
        <p v-if="searchQuery" class="search-query">
          「{{ searchQuery }}」の検索結果
        </p>
      </div>
      
      <div v-if="pending" class="loading">
        <div class="loading__spinner"></div>
      </div>
      
      <div v-else-if="error" class="error">
        <p>検索に失敗しました</p>
      </div>
      
      <div v-else-if="!products || products.data.length === 0" class="no-results">
        <div class="no-results__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h2>検索結果が見つかりませんでした</h2>
        <p>別のキーワードでお試しください</p>
        <NuxtLink to="/products" class="browse-all">すべての商品を見る</NuxtLink>
      </div>
      
      <div v-else class="search-results">
        <div class="results-header">
          <span class="results-count">{{ products.total }}件の商品が見つかりました</span>
          <select v-model="sortBy" @change="search" class="sort-select">
            <option value="relevance">関連度順</option>
            <option value="newest">新着順</option>
            <option value="price_low">価格が安い順</option>
            <option value="price_high">価格が高い順</option>
            <option value="name">名前順</option>
          </select>
        </div>
        
        <div class="products__grid">
          <div 
            v-for="product in products.data" 
            :key="product.id"
            class="product-card"
          >
            <NuxtLink :to="`/products/${product.id}`" class="product-card__link">
              <div class="product-card__image">
                <img 
                  v-if="product.images && product.images[0]"
                  :src="product.images[0].image_path" 
                  :alt="product.name"
                >
                <div v-else class="product-card__no-image">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <span v-if="product.discount_percentage" class="product-card__badge">
                  -{{ product.discount_percentage }}%
                </span>
              </div>
              <div class="product-card__info">
                <h3 class="product-card__name">{{ product.name }}</h3>
                <div class="product-card__price">
                  <span class="product-card__price-current">¥{{ Number(product.price).toLocaleString() }}</span>
                  <span v-if="product.compare_price" class="product-card__price-compare">
                    ¥{{ Number(product.compare_price).toLocaleString() }}
                  </span>
                </div>
                <div class="product-card__meta">
                  <span v-if="!product.in_stock" class="out-of-stock">在庫切れ</span>
                </div>
                <button 
                  @click.prevent="addToCart(product)"
                  :disabled="!product.in_stock"
                  class="product-card__add-to-cart"
                >
                  カートに追加
                </button>
              </div>
            </NuxtLink>
          </div>
        </div>
        
        <!-- Pagination -->
        <div v-if="products && products.last_page > 1" class="pagination">
          <button 
            @click="currentPage--; search()"
            :disabled="currentPage === 1"
            class="pagination__button"
          >
            前へ
          </button>
          <span class="pagination__info">
            {{ currentPage }} / {{ products.last_page }}
          </span>
          <button 
            @click="currentPage++; search()"
            :disabled="currentPage === products.last_page"
            class="pagination__button"
          >
            次へ
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getApiUrl } from '~/utils/api'

const route = useRoute()
const router = useRouter()

// Search query from route
const searchQuery = computed(() => route.query.q || '')

// State
const products = ref(null)
const pending = ref(false)
const error = ref(null)
const sortBy = ref('relevance')
const currentPage = ref(1)

// Search function
const search = async () => {
  if (!searchQuery.value) {
    router.push('/products')
    return
  }
  
  pending.value = true
  error.value = null
  
  try {
    const params = {
      q: searchQuery.value,
      page: currentPage.value,
      per_page: 20
    }
    
    // Map sort option to API parameter
    if (sortBy.value !== 'relevance') {
      params.sort = sortBy.value
    }
    
    const data = await $fetch(getApiUrl('/products/search'), { params })
    products.value = data
  } catch (err) {
    error.value = err
  } finally {
    pending.value = false
  }
}

// Add to cart
const addToCart = async (product) => {
  try {
    await $fetch(getApiUrl('/cart/items'), {
      method: 'POST',
      body: {
        product_id: product.id,
        quantity: 1
      }
    })
    alert('カートに追加しました')
  } catch (error) {
    alert('カートへの追加に失敗しました')
  }
}

// Watch for query changes
watch(() => route.query.q, () => {
  currentPage.value = 1
  search()
})

// Initial search
await search()
</script>

<style lang="scss" scoped>
.search-page {
  min-height: 100vh;
  padding: 2rem 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.search-header {
  margin-bottom: 2rem;
  
  .page-title {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }
  
  .search-query {
    color: #6c757d;
    font-size: 1.1rem;
  }
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

.no-results {
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
  
  .browse-all {
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

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  
  .results-count {
    color: #6c757d;
  }
  
  .sort-select {
    padding: 0.5rem 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: white;
    cursor: pointer;
  }
}

.products__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.product-card {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: all 0.3s;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
  
  &__link {
    text-decoration: none;
    color: inherit;
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
  
  &__no-image {
    width: 100%;
    height: 100%;
    background-color: #f3f4f6;
    display: flex;
    align-items: center;
    justify-content: center;
    
    svg {
      width: 60px;
      height: 60px;
      color: #d1d5db;
    }
  }
  
  &__badge {
    position: absolute;
    top: 10px;
    right: 10px;
    background: #dc3545;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: bold;
  }
  
  &__info {
    padding: 1rem;
  }
  
  &__name {
    font-size: 1rem;
    margin-bottom: 0.5rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  &__price {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    
    &-current {
      font-size: 1.2rem;
      font-weight: bold;
      color: #dc3545;
    }
    
    &-compare {
      font-size: 0.9rem;
      color: #6c757d;
      text-decoration: line-through;
    }
  }
  
  &__meta {
    margin-bottom: 0.5rem;
    
    .out-of-stock {
      color: #dc3545;
      font-size: 0.9rem;
    }
  }
  
  &__add-to-cart {
    width: 100%;
    padding: 0.5rem;
    background-color: #febd69;
    border: none;
    border-radius: 4px;
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

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 2rem;
  
  &__button {
    padding: 0.5rem 1rem;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    
    &:hover:not(:disabled) {
      background: #f8f9fa;
    }
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
  
  &__info {
    font-weight: bold;
  }
}
</style>