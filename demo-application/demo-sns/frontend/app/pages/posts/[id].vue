<template>
  <div class="container">
    <!-- 投稿詳細 -->
    <div class="card" v-if="post">
      <PostItem
        :post="post"
        @deleted="handlePostDeleted"
        @liked="loadPost"
      />
    </div>

    <!-- コメントセクション -->
    <div class="card comments-section">
      <h2>コメント</h2>

      <!-- コメント投稿フォーム -->
      <CommentForm
        :post-id="postId"
        :reply-to="replyTo"
        @submitted="handleCommentSubmitted"
        @cancelReply="replyTo = null"
      />

      <!-- コメント一覧 -->
      <div v-if="commentsLoading" class="loading">コメント読み込み中...</div>

      <div v-else-if="comments.length === 0" class="empty-message">
        まだコメントがありません
      </div>

      <div v-else class="comments-list">
        <CommentItem
          v-for="comment in comments"
          :key="comment.id"
          :comment="comment"
          @deleted="loadComments"
          @liked="loadComments"
          @reply="handleReply"
        />
      </div>
    </div>

    <div v-if="loading" class="loading">読み込み中...</div>

    <div v-if="!post && !loading" class="card">
      <p class="empty-message">投稿が見つかりません</p>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { api } = useApi()

const postId = computed(() => route.params.id)
const post = ref<any>(null)
const comments = ref<any[]>([])
const replyTo = ref<any>(null)
const loading = ref(true)
const commentsLoading = ref(true)

// 投稿詳細を取得
const loadPost = async () => {
  loading.value = true
  try {
    const data: any = await api(`/posts/${postId.value}`)
    post.value = data
  } catch (error) {
    console.error('Failed to load post:', error)
    post.value = null
  } finally {
    loading.value = false
  }
}

// コメント一覧を取得
const loadComments = async () => {
  commentsLoading.value = true
  try {
    const data: any = await api(`/posts/${postId.value}/comments`)
    comments.value = Array.isArray(data) ? data : []
  } catch (error) {
    console.error('Failed to load comments:', error)
    comments.value = []
  } finally {
    commentsLoading.value = false
  }
}

// コメント投稿後
const handleCommentSubmitted = async () => {
  replyTo.value = null
  await loadComments()
}

// リプライボタンクリック
const handleReply = (comment: any) => {
  replyTo.value = comment
  // フォームまでスクロール
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// 投稿削除後
const handlePostDeleted = () => {
  router.push('/')
}

onMounted(async () => {
  await Promise.all([loadPost(), loadComments()])
})
</script>

<style scoped lang="scss">
.comments-section {
  margin-top: $spacing-lg;

  h2 {
    margin-bottom: $spacing-lg;
    font-size: $font-lg;
  }
}

.comments-list {
  margin-top: $spacing-lg;
}

.empty-message {
  text-align: center;
  color: $text-secondary;
  padding: $spacing-xl 0;
}
</style>
