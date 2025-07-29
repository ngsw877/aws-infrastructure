<template>
  <div class="products-page">
    <div class="container">
      <h1 class="page-title">商品一覧</h1>
      
      <div class="products-layout">
        <!-- Filters Sidebar -->
        <aside class="filters">
          <h2 class="filters__title">絞り込み</h2>
          
          <!-- Categories -->
          <div class="filter-section">
            <h3 class="filter-section__title">カテゴリー</h3>
            <div v-if="categoriesPending" class="loading-small">読み込み中...</div>
            <div v-else class="filter-options">
              <label 
                v-for="category in categories" 
                :key="category.id"
                class="filter-option"
              >
                <input 
                  type="radio" 
                  name="category"
                  :value="category.id"
                  v-model="selectedCategory"
                  @change="fetchProducts"
                >
                <span>{{ category.name }}</span>
              </label>
              <label class="filter-option">
                <input 
                  type="radio" 
                  name="category"
                  value=""
                  v-model="selectedCategory"
                  @change="fetchProducts"
                >
                <span>すべて</span>
              </label>
            </div>
          </div>
          
          <!-- Price Range -->
          <div class="filter-section">
            <h3 class="filter-section__title">価格帯</h3>
            <div class="price-inputs">
              <input 
                type="number" 
                placeholder="最小"
                v-model.number="minPrice"
                @change="fetchProducts"
                class="price-input"
              >
              <span>〜</span>
              <input 
                type="number" 
                placeholder="最大"
                v-model.number="maxPrice"
                @change="fetchProducts"
                class="price-input"
              >
            </div>
          </div>
          
          <!-- In Stock -->
          <div class="filter-section">
            <label class="filter-option">
              <input 
                type="checkbox" 
                v-model="inStockOnly"
                @change="fetchProducts"
              >
              <span>在庫ありのみ表示</span>
            </label>
          </div>
        </aside>
        
        <!-- Products Grid -->
        <main class="products-main">
          <!-- Sort Options -->
          <div class="sort-bar">
            <div class="results-count">
              <span v-if="products">{{ products.total }}件の商品</span>
            </div>
            <select v-model="sortBy" @change="fetchProducts" class="sort-select">
              <option value="newest">新着順</option>
              <option value="price_low">価格が安い順</option>
              <option value="price_high">価格が高い順</option>
              <option value="name">名前順</option>
            </select>
          </div>
          
          <!-- Products -->
          <div v-if="productsPending" class="loading">
            <div class="loading__spinner"></div>
          </div>
          <div v-else-if="productsError" class="error">
            <p>商品の読み込みに失敗しました</p>
          </div>
          <div v-else-if="products && products.data.length === 0" class="no-products">
            <p>該当する商品が見つかりませんでした</p>
          </div>
          <div v-else class="products__grid">
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
              @click="currentPage--; fetchProducts()"
              :disabled="currentPage === 1"
              class="pagination__button"
            >
              前へ
            </button>
            <span class="pagination__info">
              {{ currentPage }} / {{ products.last_page }}
            </span>
            <button 
              @click="currentPage++; fetchProducts()"
              :disabled="currentPage === products.last_page"
              class="pagination__button"
            >
              次へ
            </button>
          </div>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getApiUrl } from '~/utils/api'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

// Categories
const { data: categoriesData, pending: categoriesPending } = await useFetch(getApiUrl('/categories'))
const categories = computed(() => categoriesData.value || [])

// Filters
const selectedCategory = ref(route.query.category || '')
const minPrice = ref('')
const maxPrice = ref('')
const inStockOnly = ref(false)
const sortBy = ref('newest')
const currentPage = ref(1)

// Products
const products = ref(null)
const productsPending = ref(false)
const productsError = ref(null)

const fetchProducts = async () => {
  productsPending.value = true
  productsError.value = null
  
  try {
    const params = {
      page: currentPage.value,
      per_page: 20,
      sort: sortBy.value
    }
    
    if (selectedCategory.value) params.category = selectedCategory.value
    if (minPrice.value) params.min_price = minPrice.value
    if (maxPrice.value) params.max_price = maxPrice.value
    if (inStockOnly.value) params.in_stock = true
    
    const data = await $fetch(getApiUrl('/products'), { params })
    products.value = data
  } catch (error) {
    productsError.value = error
  } finally {
    productsPending.value = false
  }
}

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

onMounted(() => {
  fetchProducts()
})
</script>

<style lang="scss" scoped>
.products-page {
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

.products-layout {
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 2rem;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.filters {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  height: fit-content;
  
  &__title {
    font-size: 1.2rem;
    margin-bottom: 1.5rem;
  }
}

.filter-section {
  margin-bottom: 2rem;
  
  &__title {
    font-size: 1rem;
    margin-bottom: 1rem;
  }
}

.filter-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  
  input[type="radio"],
  input[type="checkbox"] {
    cursor: pointer;
  }
}

.price-inputs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.price-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.sort-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.sort-select {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
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

.error, .no-products {
  text-align: center;
  padding: 4rem;
  color: #6c757d;
}

.products__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
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
    height: 200px;
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