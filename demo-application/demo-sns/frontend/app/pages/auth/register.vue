<template>
  <div class="container">
    <div class="card" style="max-width: 400px; margin: 50px auto;">
      <h2 style="margin-bottom: 20px;">ユーザー登録</h2>

      <form @submit.prevent="handleRegister">
        <div class="form-group">
          <label>名前</label>
          <input
            v-model="name"
            type="text"
            required
            placeholder="あなたの名前"
          />
        </div>

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
            minlength="8"
            placeholder="8文字以上"
          />
        </div>

        <div class="form-group">
          <label>パスワード（確認）</label>
          <input
            v-model="passwordConfirmation"
            type="password"
            required
            placeholder="パスワードを再入力"
          />
        </div>

        <div class="error" v-if="error">{{ error }}</div>

        <button
          type="submit"
          class="btn btn-primary"
          style="width: 100%; margin-top: 10px;"
          :disabled="loading"
        >
          {{ loading ? '登録中...' : '登録' }}
        </button>
      </form>

      <p style="text-align: center; margin-top: 20px; color: #657786;">
        すでにアカウントをお持ちの方は
        <NuxtLink to="/auth/login" style="color: #1da1f2;">こちら</NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const { register } = useAuth()

const name = ref('')
const email = ref('')
const password = ref('')
const passwordConfirmation = ref('')
const error = ref('')
const loading = ref(false)

const handleRegister = async () => {
  error.value = ''

  if (password.value !== passwordConfirmation.value) {
    error.value = 'パスワードが一致しません'
    return
  }

  loading.value = true

  try {
    await register(name.value, email.value, password.value, passwordConfirmation.value)
  } catch (e: any) {
    error.value = e.data?.message || '登録に失敗しました'
  } finally {
    loading.value = false
  }
}
</script>
