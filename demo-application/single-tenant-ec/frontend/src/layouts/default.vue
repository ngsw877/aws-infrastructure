<template>
  <div class="app-container">
    <header class="header">
      <div class="header__content">
        <NuxtLink to="/" class="header__logo">
          <h1>Shopping Site</h1>
        </NuxtLink>
        
        <div class="header__search">
          <input 
            type="text" 
            placeholder="商品を検索..."
            v-model="searchQuery"
            @keyup.enter="handleSearch"
            class="header__search-input"
          >
          <button @click="handleSearch" class="header__search-button">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
        
        <nav class="header__nav">
          <NuxtLink to="/account" class="header__nav-item">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
            </svg>
            <span>アカウント</span>
          </NuxtLink>
          
          <NuxtLink to="/cart" class="header__nav-item header__cart">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
            </svg>
            <span>カート</span>
            <span v-if="cartItemCount > 0" class="header__cart-badge">{{ cartItemCount }}</span>
          </NuxtLink>
        </nav>
      </div>
    </header>
    
    <main class="main">
      <slot />
    </main>
    
    <footer class="footer">
      <div class="footer__content">
        <div class="footer__section">
          <h3>ショッピングガイド</h3>
          <ul>
            <li><a href="#">ご利用ガイド</a></li>
            <li><a href="#">配送について</a></li>
            <li><a href="#">返品・交換について</a></li>
          </ul>
        </div>
        <div class="footer__section">
          <h3>カスタマーサポート</h3>
          <ul>
            <li><a href="#">お問い合わせ</a></li>
            <li><a href="#">よくある質問</a></li>
            <li><a href="#">ヘルプ</a></li>
          </ul>
        </div>
        <div class="footer__section">
          <h3>会社情報</h3>
          <ul>
            <li><a href="#">会社概要</a></li>
            <li><a href="#">プライバシーポリシー</a></li>
            <li><a href="#">利用規約</a></li>
          </ul>
        </div>
      </div>
      <div class="footer__bottom">
        <p>&copy; 2024 Shopping Site. All rights reserved.</p>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const searchQuery = ref('')
const cartItemCount = ref(0)

const handleSearch = () => {
  if (searchQuery.value.trim()) {
    router.push(`/search?q=${encodeURIComponent(searchQuery.value)}`)
  }
}

// TODO: カートアイテム数を実際のカートから取得
</script>

<style scoped lang="scss">
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background-color: #131921;
  color: white;
  position: sticky;
  top: 0;
  z-index: 100;
  
  &__content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 2rem;
  }
  
  &__logo {
    flex-shrink: 0;
    
    h1 {
      font-size: 1.5rem;
      margin: 0;
      color: white;
    }
  }
  
  &__search {
    flex: 1;
    display: flex;
    
    &-input {
      flex: 1;
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 4px 0 0 4px;
      font-size: 1rem;
    }
    
    &-button {
      background-color: #febd69;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 0 4px 4px 0;
      cursor: pointer;
      
      svg {
        width: 20px;
        height: 20px;
        color: #131921;
      }
      
      &:hover {
        background-color: #f3a847;
      }
    }
  }
  
  &__nav {
    display: flex;
    gap: 1.5rem;
    
    &-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: white;
      text-decoration: none;
      
      svg {
        width: 24px;
        height: 24px;
      }
      
      &:hover {
        color: #febd69;
      }
    }
  }
  
  &__cart {
    position: relative;
    
    &-badge {
      position: absolute;
      top: -8px;
      right: -8px;
      background-color: #f08804;
      color: white;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: bold;
    }
  }
}

.main {
  flex: 1;
  background-color: #f7f7f7;
}

.footer {
  background-color: #232f3e;
  color: white;
  margin-top: auto;
  
  &__content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem 1rem;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 2rem;
  }
  
  &__section {
    h3 {
      font-size: 1.1rem;
      margin-bottom: 1rem;
    }
    
    ul {
      list-style: none;
      padding: 0;
      
      li {
        margin-bottom: 0.5rem;
        
        a {
          color: #ddd;
          text-decoration: none;
          
          &:hover {
            color: white;
            text-decoration: underline;
          }
        }
      }
    }
  }
  
  &__bottom {
    background-color: #131921;
    text-align: center;
    padding: 1rem;
    
    p {
      margin: 0;
      color: #999;
    }
  }
}
</style>
