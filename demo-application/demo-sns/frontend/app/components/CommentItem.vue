<template>
  <div class="comment">
    <div class="comment-header">
      <NuxtLink :to="`/users/${comment.user_id}`" class="user-link">
        <div class="comment-avatar">{{ comment.user?.name?.charAt(0).toUpperCase() }}</div>
      </NuxtLink>
      <div class="comment-info">
        <NuxtLink :to="`/users/${comment.user_id}`" class="user-link">
          <div class="comment-author">{{ comment.user?.name }}</div>
        </NuxtLink>
        <div class="comment-date">
          {{ formatDate(comment.created_at) }}
        </div>
      </div>
    </div>

    <div class="comment-content">{{ comment.content }}</div>

    <div class="comment-actions">
      <div
        class="comment-action"
        :class="{ liked: isLiked }"
        @click="handleLike"
      >
        <span>{{ isLiked ? '❤️' : '🤍' }}</span>
        <span>{{ likesCount }}</span>
      </div>

      <div
        class="comment-action"
        @click="$emit('reply', comment)"
      >
        <span>💬</span>
        <span>返信</span>
      </div>

      <div
        v-if="canDelete"
        class="comment-action delete"
        @click="handleDelete"
      >
        <span>🗑️</span>
        <span>削除</span>
      </div>
    </div>

    <!-- 再帰的にリプライを表示 -->
    <div v-if="comment.replies && comment.replies.length > 0" class="replies">
      <CommentItem
        v-for="reply in comment.replies"
        :key="reply.id"
        :comment="reply"
        @deleted="$emit('deleted')"
        @liked="$emit('liked')"
        @reply="$emit('reply', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  comment: any
}>()

const emit = defineEmits(['deleted', 'liked', 'reply'])

const { api } = useApi()
const { user } = useAuth()

const likesCount = ref(props.comment.likes_count || 0)
const isLiked = ref(props.comment.is_liked || false)

const canDelete = computed(() => {
  return user.value && user.value.id === props.comment.user_id
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
    const data: any = await api(`/comments/${props.comment.id}/like`, {
      method: 'POST',
    })

    isLiked.value = data.liked
    likesCount.value = data.likes_count
    emit('liked')
  } catch (error) {
    console.error('Failed to like comment:', error)
  }
}

const handleDelete = async () => {
  if (!confirm('このコメントを削除しますか？')) return

  try {
    await api(`/comments/${props.comment.id}`, {
      method: 'DELETE',
    })

    emit('deleted')
  } catch (error) {
    console.error('Failed to delete comment:', error)
  }
}
</script>

<style scoped lang="scss">
.comment {
  padding: $spacing-md;
  border-bottom: 1px solid $border-color;

  &:last-child {
    border-bottom: none;
  }
}

.comment-header {
  display: flex;
  align-items: center;
  margin-bottom: $spacing-sm;
}

.comment-avatar {
  @include avatar(32px);
  font-size: 14px;
  margin-right: $spacing-sm;
}

.comment-info {
  flex: 1;
}

.user-link {
  text-decoration: none;
  color: inherit;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.7;

    .comment-author {
      text-decoration: underline;
    }
  }
}

.comment-author {
  font-weight: bold;
  font-size: $font-md;
}

.comment-date {
  font-size: $font-xs;
  color: $text-secondary;
  margin-top: 2px;
}

.comment-content {
  margin-bottom: $spacing-sm;
  font-size: $font-md;
  line-height: 1.5;
}

.comment-actions {
  display: flex;
  gap: $spacing-lg;
  color: $text-secondary;
  font-size: $font-sm;
}

.comment-action {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  cursor: pointer;
  transition: color 0.2s;

  &:hover {
    color: $primary-color;
  }

  &.liked {
    color: $danger-color;
  }

  &.delete {
    color: $danger-color;
  }
}

// ネストしたリプライ
.replies {
  margin-left: $spacing-xl;
  margin-top: $spacing-sm;
  border-left: 2px solid $border-color;
  padding-left: $spacing-sm;
}
</style>
