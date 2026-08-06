<template>
  <div v-if="asset" class="modal preview-modal" @click="$emit('close')">
    <div class="preview-content" @click.stop>
      <button class="preview-close" @click="$emit('close')">×</button>
      <div class="preview-body">
        <img v-if="asset.type === 'image'" :src="asset.originalPath" :alt="asset.id" class="preview-image">
        <video v-else controls class="preview-video">
          <source :src="asset.originalPath" type="video/mp4">
          您的瀏覽器不支援視頻預覽
        </video>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  asset: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close'])
</script>

<style scoped>
/* 預覽 Modal */
.preview-modal {
  padding: 20px;
}

.preview-content {
  background: var(--bg-card);
  max-width: 800px;
  border-radius: 16px;
  box-shadow: var(--shadow-xl);
  position: relative;
  padding: 32px;
}

.preview-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 40px;
  height: 40px;
  border: none;
  background: var(--bg-section);
  border-radius: 50%;
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  color: var(--text-secondary);
}

.preview-close:hover {
  background: var(--shopee-error-light);
  color: var(--shopee-error);
}

.preview-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.preview-image,
.preview-video {
  max-width: 100%;
  max-height: 600px;
  border-radius: 8px;
  object-fit: contain;
}

@media (max-width: 768px) {
  .preview-content {
    padding: 20px;
  }
  
  .preview-placeholder-large {
    font-size: 80px;
  }
  
  .preview-info h3 {
    font-size: 16px;
  }
  
  .preview-info p {
    font-size: 13px;
  }
}
</style>
