<template>
  <div class="comment-form">
    <div v-if="replyTo" class="reply-indicator">
      <span>{{ replyTo.user?.name }}さんへ返信中</span>
      <button @click="$emit('cancelReply')" class="cancel-btn">✕</button>
    </div>

    <form @submit.prevent="handleSubmit">
      <textarea
        v-model="content"
        :placeholder="replyTo ? '返信を入力...' : 'コメントを入力...'"
        class="comment-input"
        rows="3"
        maxlength="500"
      ></textarea>

      <div class="form-actions">
        <span class="char-count">{{ content.length }}/500</span>
        <button
          type="submit"
          class="btn btn-primary"
          :disabled="!content.trim() || submitting"
        >
          {{ submitting ? '投稿中...' : (replyTo ? '返信' : 'コメント') }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  postId: string | number
  replyTo?: any
}>()

const emit = defineEmits(['submitted', 'cancelReply'])

const { api } = useApi()

const content = ref('')
const submitting = ref(false)

const handleSubmit = async () => {
  if (!content.value.trim() || submitting.value) return

  submitting.value = true

  try {
    const payload: any = {
      content: content.value.trim(),
    }

    // リプライの場合はparent_idを設定
    if (props.replyTo) {
      payload.parent_id = props.replyTo.id
    }

    await api(`/posts/${props.postId}/comments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    content.value = ''
    emit('submitted')
  } catch (error) {
    console.error('Failed to post comment:', error)
    alert('コメントの投稿に失敗しました')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
.comment-form {
  margin-bottom: $spacing-lg;
}

.reply-indicator {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: $primary-light;
  padding: $spacing-sm $spacing-md;
  border-radius: $radius-sm;
  margin-bottom: $spacing-sm;
  font-size: $font-sm;
  color: $primary-color;
}

.cancel-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  color: $text-secondary;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: $danger-color;
  }
}

.comment-input {
  @include input-base;
  resize: vertical;
  min-height: 60px;
  font-family: inherit;
}

.form-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: $spacing-sm;
}

.char-count {
  font-size: $font-xs;
  color: $text-secondary;
}
</style>
