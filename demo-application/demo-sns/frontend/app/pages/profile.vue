<template>
  <div class="container">
    <div class="card" v-if="user">
      <div style="display: flex; align-items: center; margin-bottom: 20px;">
        <div class="post-avatar" style="width: 80px; height: 80px; font-size: 32px;">
          {{ user.name.charAt(0).toUpperCase() }}
        </div>
        <div style="margin-left: 20px;">
          <h2>{{ user.name }}</h2>
          <p style="color: #657786;">{{ user.email }}</p>
        </div>
      </div>

      <div v-if="user.bio" style="margin-bottom: 20px;">
        <p>{{ user.bio }}</p>
      </div>

      <div style="display: flex; gap: 20px; color: #657786; font-size: 14px;">
        <div>
          <strong>{{ user.posts_count || 0 }}</strong> 投稿
        </div>
        <div>
          <strong>{{ user.followers_count || 0 }}</strong> フォロワー
        </div>
        <div>
          <strong>{{ user.following_count || 0 }}</strong> フォロー中
        </div>
      </div>

      <button
        @click="showEditForm = !showEditForm"
        class="btn btn-secondary"
        style="margin-top: 20px;"
      >
        {{ showEditForm ? 'キャンセル' : 'プロフィールを編集' }}
      </button>

      <div v-if="showEditForm" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e1e8ed;">
        <form @submit.prevent="handleUpdateProfile">
          <div class="form-group">
            <label>名前</label>
            <input
              v-model="formData.name"
              type="text"
              required
            />
          </div>

          <div class="form-group">
            <label>自己紹介</label>
            <textarea
              v-model="formData.bio"
              rows="3"
              maxlength="500"
            ></textarea>
          </div>

          <div class="form-group">
            <label>アバター画像（オプション）</label>
            <input
              type="file"
              accept="image/*"
              @change="handleFileChange"
            />
          </div>

          <div class="error" v-if="error">{{ error }}</div>

          <button
            type="submit"
            class="btn btn-primary"
            :disabled="loading"
          >
            {{ loading ? '更新中...' : '更新する' }}
          </button>
        </form>
      </div>
    </div>

    <div v-else class="loading">読み込み中...</div>
  </div>
</template>

<script setup lang="ts">
const { user, fetchUser } = useAuth()
const { api } = useApi()

const showEditForm = ref(false)
const loading = ref(false)
const error = ref('')

const formData = ref({
  name: '',
  bio: '',
})

const avatar = ref<File | null>(null)

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    avatar.value = target.files[0]
  }
}

const handleUpdateProfile = async () => {
  error.value = ''
  loading.value = true

  try {
    const data = new FormData()
    data.append('name', formData.value.name)
    if (formData.value.bio) {
      data.append('bio', formData.value.bio)
    }
    if (avatar.value) {
      data.append('avatar', avatar.value)
    }

    await api('/profile', {
      method: 'POST',
      body: data,
    })

    await fetchUser()
    showEditForm.value = false
    avatar.value = null
  } catch (e: any) {
    error.value = e.data?.message || '更新に失敗しました'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await fetchUser()
  if (user.value) {
    formData.value.name = user.value.name
    formData.value.bio = user.value.bio || ''
  }
})

watch(user, (newUser) => {
  if (newUser) {
    formData.value.name = newUser.name
    formData.value.bio = newUser.bio || ''
  }
})
</script>
