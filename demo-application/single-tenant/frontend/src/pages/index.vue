<template>
  <div class="home-page">
    <!-- Hero Section -->
    <section class="hero">
      <div class="hero__content">
        <h1 class="hero__title">ショッピングを楽しもう</h1>
        <p class="hero__subtitle">最新の商品から定番アイテムまで幅広く取り揃えています</p>
        <NuxtLink to="/products" class="hero__cta">商品を見る</NuxtLink>
      </div>
    </section>

    <div class="container">
      <!-- Categories Section -->
      <section class="categories">
        <h2 class="section-title">カテゴリーから探す</h2>
        <div v-if="categoriesPending" class="loading">
          <div class="loading__spinner"></div>
        </div>
        <div v-else-if="categoriesError" class="error">
          <p>カテゴリーの読み込みに失敗しました</p>
        </div>
        <div v-else class="categories__grid">
          <NuxtLink 
            v-for="category in categories" 
            :key="category.id"
            :to="`/products?category=${category.id}`"
            class="category-card"
          >
            <div class="category-card__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 class="category-card__name">{{ category.name }}</h3>
            <p class="category-card__count">{{ category.products_count || 0 }} 商品</p>
          </NuxtLink>
        </div>
      </section>

      <!-- Featured Products -->
      <section class="featured">
        <h2 class="section-title">おすすめ商品</h2>
        <div v-if="featuredPending" class="loading">
          <div class="loading__spinner"></div>
        </div>
        <div v-else-if="featuredError" class="error">
          <p>商品の読み込みに失敗しました</p>
        </div>
        <div v-else class="products__grid">
          <div 
            v-for="product in featuredProducts" 
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
              </div>
              <div class="product-card__info">
                <h3 class="product-card__name">{{ product.name }}</h3>
                <div class="product-card__price">
                  <span class="product-card__price-current">¥{{ Number(product.price).toLocaleString() }}</span>
                  <span v-if="product.compare_price" class="product-card__price-compare">
                    ¥{{ Number(product.compare_price).toLocaleString() }}
                  </span>
                </div>
                <button 
                  @click.prevent="addToCart(product)"
                  class="product-card__add-to-cart"
                >
                  カートに追加
                </button>
              </div>
            </NuxtLink>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { getApiUrl } from '~/utils/api'

// カテゴリー取得
const { data: categoriesData, pending: categoriesPending, error: categoriesError } = await useFetch(getApiUrl('/categories'))
const categories = computed(() => categoriesData.value || [])

// おすすめ商品取得
const { data: featuredData, pending: featuredPending, error: featuredError } = await useFetch(getApiUrl('/products'), {
  query: {
    featured: true,
    per_page: 8
  }
})
const featuredProducts = computed(() => featuredData.value?.data || [])

// カートに追加
const addToCart = async (product) => {
  try {
    await $fetch(getApiUrl('/cart/items'), {
      method: 'POST',
      body: {
        product_id: product.id,
        quantity: 1
      }
    })
    // TODO: カート数を更新
    alert('カートに追加しました')
  } catch (error) {
    alert('カートへの追加に失敗しました')
  }
}
</script>

<style lang="scss" scoped>
.home-page {
  min-height: 100vh;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.hero {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 4rem 1rem;
  text-align: center;
  
  &__content {
    max-width: 600px;
    margin: 0 auto;
  }
  
  &__title {
    font-size: 2.5rem;
    margin-bottom: 1rem;
  }
  
  &__subtitle {
    font-size: 1.2rem;
    margin-bottom: 2rem;
    opacity: 0.9;
  }
  
  &__cta {
    display: inline-block;
    background-color: white;
    color: #667eea;
    padding: 0.75rem 2rem;
    border-radius: 8px;
    text-decoration: none;
    font-weight: bold;
    transition: transform 0.2s;
    
    &:hover {
      transform: translateY(-2px);
    }
  }
}

.section-title {
  font-size: 1.8rem;
  margin: 3rem 0 2rem;
  text-align: center;
}

.loading {
  display: flex;
  justify-content: center;
  padding: 2rem;
  
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
  color: #dc3545;
  padding: 2rem;
}

.categories {
  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 3rem;
  }
}

.category-card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  text-align: center;
  text-decoration: none;
  color: inherit;
  transition: all 0.3s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
  
  &__icon {
    width: 60px;
    height: 60px;
    margin: 0 auto 1rem;
    background-color: #f3f4f6;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    
    svg {
      width: 30px;
      height: 30px;
      color: #667eea;
    }
  }
  
  &__name {
    font-size: 1.1rem;
    margin-bottom: 0.5rem;
  }
  
  &__count {
    color: #6c757d;
    font-size: 0.9rem;
  }
}

.products__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
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
    margin-bottom: 1rem;
    
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
  
  &__add-to-cart {
    width: 100%;
    padding: 0.5rem;
    background-color: #febd69;
    border: none;
    border-radius: 4px;
    font-weight: bold;
    cursor: pointer;
    transition: background-color 0.2s;
    
    &:hover {
      background-color: #f3a847;
    }
  }
}
</style>
