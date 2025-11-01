<template>
  <form @submit.prevent="handleSubmit">
    <div class="form-group">
      <textarea
        v-model="content"
        placeholder="今何してる？"
        rows="3"
        maxlength="280"
        required
      ></textarea>
      <div style="text-align: right; font-size: 12px; color: #657786; margin-top: 5px;">
        {{ content.length }} / 280
      </div>
    </div>

    <div class="form-group">
      <label>画像（オプション）</label>
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
      :disabled="loading || !content.trim()"
    >
      {{ loading ? '投稿中...' : '投稿する' }}
    </button>
  </form>
</template>

<script setup lang="ts">
const emit = defineEmits(['posted'])
const { api } = useApi()

const content = ref('')
const image = ref<File | null>(null)
const error = ref('')
const loading = ref(false)

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    image.value = target.files[0]
  }
}

const handleSubmit = async () => {
  error.value = ''
  loading.value = true

  try {
    const formData = new FormData()
    formData.append('content', content.value)

    if (image.value) {
      formData.append('image', image.value)
    }

    await api('/posts', {
      method: 'POST',
      body: formData,
    })

    content.value = ''
    image.value = null
    emit('posted')
  } catch (e: any) {
    error.value = e.data?.message || '投稿に失敗しました'
  } finally {
    loading.value = false
  }
}
</script>
