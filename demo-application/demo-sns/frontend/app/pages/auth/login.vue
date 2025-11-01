<template>
  <div class="container">
    <div class="card" style="max-width: 400px; margin: 50px auto;">
      <h2 style="margin-bottom: 20px;">ログイン</h2>

      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label>メールアドレス</label>
          <input
            v-model="email"
            type="email"
            required
            placeholder="your@email.com"
          />
        </div>

        <div class="form-group">
          <label>パスワード</label>
          <input
            v-model="password"
            type="password"
            required
            placeholder="パスワード"
          />
        </div>

        <div class="error" v-if="error">{{ error }}</div>

        <button
          type="submit"
          class="btn btn-primary"
          style="width: 100%; margin-top: 10px;"
          :disabled="loading"
        >
          {{ loading ? 'ログイン中...' : 'ログイン' }}
        </button>
      </form>

      <p style="text-align: center; margin-top: 20px; color: #657786;">
        アカウントをお持ちでない方は
        <NuxtLink to="/auth/register" style="color: #1da1f2;">こちら</NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const { login } = useAuth()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const handleLogin = async () => {
  error.value = ''
  loading.value = true

  try {
    await login(email.value, password.value)
  } catch (e: any) {
    error.value = e.data?.message || 'ログインに失敗しました'
  } finally {
    loading.value = false
  }
}
</script>
