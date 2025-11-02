<template>
  <div class="post">
    <div class="post-header">
      <NuxtLink :to="`/users/${post.user_id}`" class="user-link">
        <div class="post-avatar">{{ post.user?.name?.charAt(0).toUpperCase() }}</div>
      </NuxtLink>
      <div>
        <NuxtLink :to="`/users/${post.user_id}`" class="user-link">
          <div class="post-author">{{ post.user?.name }}</div>
        </NuxtLink>
        <div class="post-date">
          {{ formatDate(post.created_at) }}
        </div>
      </div>
    </div>

    <div class="post-content">{{ post.content }}</div>

    <img
      v-if="post.image_url"
      :src="post.image_url"
      alt="投稿画像"
      class="post-image"
    />

    <div class="post-actions">
      <div
        class="post-action"
        :class="{ liked: isLiked }"
        @click="handleLike"
      >
        <span>{{ isLiked ? '❤️' : '🤍' }}</span>
        <span>{{ likesCount }}</span>
      </div>

      <div
        v-if="canDelete"
        class="post-action delete"
        @click="handleDelete"
      >
        <span>🗑️</span>
        <span>削除</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  post: any
}>()

const emit = defineEmits(['deleted', 'liked'])

const { api } = useApi()
const { user } = useAuth()

const likesCount = ref(props.post.likes_count || 0)
const isLiked = ref(props.post.is_liked || false)

const canDelete = computed(() => {
  return user.value && user.value.id === props.post.user_id
})

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'たった今'
  if (minutes < 60) return `${minutes}分前`
  if (hours < 24) return `${hours}時間前`
  if (days < 7) return `${days}日前`

  return date.toLocaleDateString('ja-JP')
}

const handleLike = async () => {
  try {
    const data: any = await api(`/posts/${props.post.id}/like`, {
      method: 'POST',
    })

    isLiked.value = data.liked
    likesCount.value = data.likes_count
    emit('liked')
  } catch (error) {
    console.error('Failed to like post:', error)
  }
}

const handleDelete = async () => {
  if (!confirm('この投稿を削除しますか？')) return

  try {
    await api(`/posts/${props.post.id}`, {
      method: 'DELETE',
    })

    emit('deleted')
  } catch (error) {
    console.error('Failed to delete post:', error)
  }
}
</script>

<style scoped lang="scss">
// ユーザーリンク
.user-link {
  text-decoration: none;
  color: inherit;
  display: flex;
  align-items: center;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.7;

    .post-author {
      text-decoration: underline;
    }
  }
}

// 投稿日時
.post-date {
  font-size: $font-sm;
  color: $text-secondary;
}

// アクション
.post-action {
  &.delete {
    color: $danger-color;
  }
}
</style>
