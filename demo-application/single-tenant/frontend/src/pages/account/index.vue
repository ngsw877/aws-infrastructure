<template>
  <div class="account-page">
    <div class="container">
      <h1 class="page-title">マイアカウント</h1>
      
      <div class="account-notice">
        <div class="notice-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="notice-content">
          <h2>ログイン機能は準備中です</h2>
          <p>現在、アカウント機能を開発中です。まもなくご利用いただけるようになります。</p>
          <p>アカウント機能が利用可能になると、以下の機能をご利用いただけます：</p>
          <ul>
            <li>注文履歴の確認</li>
            <li>お気に入り商品の管理</li>
            <li>配送先住所の登録・管理</li>
            <li>パスワードの変更</li>
          </ul>
        </div>
      </div>
      
      <div class="account-sections">
        <div class="account-section">
          <div class="section-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3>注文履歴</h3>
          <p>過去の注文内容を確認できます</p>
        </div>
        
        <div class="account-section">
          <div class="section-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h3>お気に入り</h3>
          <p>お気に入りの商品を保存・管理</p>
        </div>
        
        <div class="account-section">
          <div class="section-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3>配送先住所</h3>
          <p>配送先の住所を登録・編集</p>
        </div>
        
        <div class="account-section">
          <div class="section-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3>アカウント設定</h3>
          <p>パスワードやメール設定を変更</p>
        </div>
      </div>
      
      <div class="back-to-shopping">
        <NuxtLink to="/products" class="back-link">
          買い物を続ける
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
// 将来的にはここに認証ロジックを実装
</script>

<style lang="scss" scoped>
.account-page {
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

.account-notice {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 2rem;
  display: flex;
  gap: 1.5rem;
  margin-bottom: 3rem;
  
  .notice-icon {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    
    svg {
      width: 100%;
      height: 100%;
      color: #6c757d;
    }
  }
  
  .notice-content {
    h2 {
      font-size: 1.3rem;
      margin-bottom: 1rem;
    }
    
    p {
      color: #6c757d;
      margin-bottom: 1rem;
      line-height: 1.6;
    }
    
    ul {
      list-style: disc;
      padding-left: 1.5rem;
      color: #6c757d;
      
      li {
        margin-bottom: 0.5rem;
      }
    }
  }
}

.account-sections {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
}

.account-section {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  transition: all 0.3s;
  cursor: not-allowed;
  opacity: 0.6;
  
  .section-icon {
    width: 60px;
    height: 60px;
    margin: 0 auto 1rem;
    background: #f8f9fa;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    
    svg {
      width: 30px;
      height: 30px;
      color: #6c757d;
    }
  }
  
  h3 {
    font-size: 1.1rem;
    margin-bottom: 0.5rem;
  }
  
  p {
    color: #6c757d;
    font-size: 0.9rem;
  }
}

.back-to-shopping {
  text-align: center;
  
  .back-link {
    display: inline-block;
    padding: 0.75rem 2rem;
    background-color: #667eea;
    color: white;
    text-decoration: none;
    border-radius: 4px;
    transition: background-color 0.2s;
    
    &:hover {
      background-color: #5a67d8;
    }
  }
}
</style>