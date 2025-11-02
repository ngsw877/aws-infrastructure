<template>
  <div class="container">
    <div class="card" v-if="isAuthenticated">
      <h2 style="margin-bottom: 20px;">新しい投稿</h2>
      <PostForm @posted="loadPosts" />
    </div>

    <div class="card" v-if="!isAuthenticated">
      <h2>Demo SNSへようこそ</h2>
      <p style="margin-top: 10px; color: #657786;">
        Twitter風のシンプルなSNSアプリケーションです。
      </p>
      <div style="margin-top: 20px;">
        <NuxtLink to="/auth/register">
          <button class="btn btn-primary">新規登録</button>
        </NuxtLink>
        <NuxtLink to="/auth/login" style="margin-left: 10px;">
          <button class="btn btn-secondary">ログイン</button>
        </NuxtLink>
      </div>
    </div>

    <div class="card" v-if="isAuthenticated">
      <h2 style="margin-bottom: 20px;">タイムライン</h2>

      <div v-if="loading" class="loading">読み込み中...</div>

      <div v-else-if="posts.length === 0">
        <p style="text-align: center; color: #657786;">まだ投稿がありません</p>
      </div>

      <div v-else>
        <PostItem
          v-for="post in posts"
          :key="post.id"
          :post="post"
          @deleted="loadPosts"
          @liked="loadPosts"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { isAuthenticated, fetchUser } = useAuth()
const { api } = useApi()

const posts = ref([])
const loading = ref(false)

const loadPosts = async () => {
  if (!isAuthenticated.value) return

  loading.value = true
  try {
    const data: any = await api('/posts')
    // Go Echoは配列を直接返す
    posts.value = Array.isArray(data) ? data : (data.data || [])
  } catch (error) {
    console.error('Failed to load posts:', error)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  // ログイン済みの場合のみユーザー情報を取得
  if (isAuthenticated.value) {
    await fetchUser()
    await loadPosts()
  }
})

watch(isAuthenticated, (newValue) => {
  if (newValue) {
    loadPosts()
  }
})
</script>
