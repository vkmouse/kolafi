<template>
  <div v-if="totalPages > 1" class="pagination-container">
    <button 
      class="pagination-btn"
      :disabled="currentPage === 1"
      @click="changePage(currentPage - 1)"
    >
      上一頁
    </button>
    
    <div class="pagination-info">
      <span class="page-number">{{ currentPage }}</span>
      <span class="page-separator">/</span>
      <span class="total-pages">{{ totalPages }}</span>
    </div>
    
    <button 
      class="pagination-btn"
      :disabled="currentPage === totalPages"
      @click="changePage(currentPage + 1)"
    >
      下一頁
    </button>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'

const props = defineProps({
  currentPage: {
    type: Number,
    required: true,
    default: 1
  },
  totalPages: {
    type: Number,
    required: true,
    default: 1
  },
  total: {
    type: Number,
    required: true,
    default: 0
  }
})

const emit = defineEmits(['page-change'])

const changePage = (page) => {
  if (page >= 1 && page <= props.totalPages && page !== props.currentPage) {
    emit('page-change', page)
  }
}
</script>

<style scoped>
.pagination-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 20px 0;
  margin-top: 16px;
}

.pagination-btn {
  padding: 8px 16px;
  border: 1px solid var(--border-primary);
  background: var(--bg-card);
  color: var(--text-primary);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 80px;
}

.pagination-btn:hover:not(:disabled) {
  border-color: var(--shopee-primary);
  background: var(--shopee-primary-light);
  color: var(--shopee-primary);
}

.pagination-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: var(--bg-section);
}

.pagination-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  color: var(--text-primary);
  padding: 0 8px;
}

.page-number {
  font-weight: 600;
  color: var(--shopee-primary);
  font-size: 18px;
}

.page-separator {
  color: var(--text-secondary);
  font-weight: 300;
}

.total-pages {
  font-weight: 500;
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .pagination-container {
    gap: 12px;
    padding: 16px 0;
  }
  
  .pagination-btn {
    min-width: 70px;
    padding: 6px 12px;
    font-size: 13px;
  }
  
  .pagination-info {
    font-size: 14px;
    gap: 6px;
  }
  
  .page-number {
    font-size: 16px;
  }
}
</style>
