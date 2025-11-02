<template>
  <div class="container">
    <div class="card" v-if="profileUser">
      <!-- プロフィールヘッダー -->
      <div class="profile-header">
        <div class="profile-avatar">
          {{ profileUser.name.charAt(0).toUpperCase() }}
        </div>
        <div class="profile-info">
          <h2>{{ profileUser.name }}</h2>
          <p>{{ profileUser.email }}</p>
        </div>
      </div>

      <!-- 自己紹介 -->
      <div v-if="profileUser.bio" class="bio">
        <p>{{ profileUser.bio }}</p>
      </div>

      <!-- 統計情報 -->
      <div class="stats">
        <div>
          <strong>{{ postsCount }}</strong> 投稿
        </div>
        <div>
          <strong>{{ profileUser.followers_count || 0 }}</strong> フォロワー
        </div>
        <div>
          <strong>{{ profileUser.following_count || 0 }}</strong> フォロー中
        </div>
      </div>

      <!-- フォローボタン（自分以外） -->
      <button
        v-if="!isOwnProfile"
        @click="handleFollow"
        class="btn"
        :class="isFollowing ? 'btn-secondary' : 'btn-primary'"
        :disabled="followLoading"
      >
        {{ followLoading ? '処理中...' : (isFollowing ? 'フォロー中' : 'フォローする') }}
      </button>

      <!-- 自分のプロフィールへのリンク -->
      <NuxtLink v-else to="/profile" class="btn btn-secondary">
        プロフィールを編集
      </NuxtLink>
    </div>

    <!-- ユーザーの投稿一覧 -->
    <div class="card posts-section">
      <h2>投稿</h2>

      <div v-if="postsLoading" class="loading">読み込み中...</div>

      <div v-else-if="userPosts.length === 0">
        <p class="empty-message">まだ投稿がありません</p>
      </div>

      <div v-else>
        <PostItem
          v-for="post in userPosts"
          :key="post.id"
          :post="post"
          @deleted="loadUserPosts"
          @liked="loadUserPosts"
        />
      </div>
    </div>

    <div v-if="!profileUser && !loading" class="card">
      <p class="empty-message">ユーザーが見つかりません</p>
    </div>

    <div v-if="loading" class="loading">読み込み中...</div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { api } = useApi()
const { user } = useAuth()

const userId = computed(() => route.params.id)
const profileUser = ref<any>(null)
const userPosts = ref<any[]>([])
const isFollowing = ref(false)
const loading = ref(true)
const postsLoading = ref(true)
const followLoading = ref(false)

const isOwnProfile = computed(() => {
  return user.value && profileUser.value && user.value.id === profileUser.value.id
})

const postsCount = computed(() => {
  return userPosts.value.length
})

// ユーザー情報を取得
const loadUser = async () => {
  loading.value = true
  try {
    const data: any = await api(`/users/${userId.value}`)
    profileUser.value = data
    // フォロー状態をチェック（自分の投稿でフォロー情報があれば使う）
    isFollowing.value = data.is_following || false
  } catch (error) {
    console.error('Failed to load user:', error)
    profileUser.value = null
  } finally {
    loading.value = false
  }
}

// ユーザーの投稿を取得
const loadUserPosts = async () => {
  postsLoading.value = true
  try {
    const data: any = await api('/posts')
    // 配列を直接受け取る、またはdata.dataを受け取る
    const allPosts = Array.isArray(data) ? data : (data.data || [])
    // このユーザーの投稿のみフィルター
    userPosts.value = allPosts.filter((post: any) => post.user_id === Number(userId.value))
  } catch (error) {
    console.error('Failed to load posts:', error)
  } finally {
    postsLoading.value = false
  }
}

// フォロー/アンフォロー
const handleFollow = async () => {
  if (!userId.value) return
  
  followLoading.value = true
  try {
    const data: any = await api(`/users/${userId.value}/follow`, {
      method: 'POST',
    })
    
    // フォロー状態を更新（バックエンドは'following'を返す）
    isFollowing.value = data.following !== undefined ? data.following : data.is_following
    
    // ユーザー情報を再取得してフォロワー数を更新
    await loadUser()
  } catch (error) {
    console.error('Failed to toggle follow:', error)
  } finally {
    followLoading.value = false
  }
}

onMounted(async () => {
  await loadUser()
  await loadUserPosts()
})

// ルートが変更されたら再読み込み
watch(() => route.params.id, async (newId) => {
  if (newId) {
    await loadUser()
    await loadUserPosts()
  }
})
</script>

<style scoped lang="scss">
// プロフィールヘッダー
.profile-header {
  display: flex;
  align-items: center;
  margin-bottom: $spacing-lg;
}

.profile-avatar {
  @include avatar(80px);
  font-size: 32px;
}

.profile-info {
  margin-left: $spacing-lg;
  flex: 1;

  h2 {
    margin: 0;
    font-size: 24px;
  }

  p {
    color: $text-secondary;
    margin: $spacing-xs 0 0 0;
  }
}

// 自己紹介
.bio {
  margin-bottom: $spacing-lg;
  line-height: 1.5;
}

// 統計情報
.stats {
  display: flex;
  gap: $spacing-lg;
  color: $text-secondary;
  font-size: $font-md;
  margin-bottom: $spacing-lg;

  strong {
    color: $text-primary;
  }
}

// セクション
.posts-section {
  margin-top: $spacing-lg;

  h2 {
    margin-bottom: $spacing-lg;
  }
}

.empty-message {
  text-align: center;
  color: $text-secondary;
}
</style>

