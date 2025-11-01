<template>
  <div>
    <header class="header">
      <div class="header-content">
        <h1>Demo SNS</h1>
        <nav class="nav-links" v-if="isAuthenticated">
          <NuxtLink to="/">ホーム</NuxtLink>
          <NuxtLink to="/profile" v-if="user">プロフィール</NuxtLink>
          <button @click="handleLogout" class="btn btn-secondary">ログアウト</button>
        </nav>
        <nav class="nav-links" v-else>
          <NuxtLink to="/auth/login">ログイン</NuxtLink>
          <NuxtLink to="/auth/register">登録</NuxtLink>
        </nav>
      </div>
    </header>
    <main>
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const { user, logout, isAuthenticated } = useAuth()

const handleLogout = async () => {
  await logout()
}
</script>
