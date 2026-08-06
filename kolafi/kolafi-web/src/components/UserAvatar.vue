<template>
  <div class="user-avatar-wrapper" @dblclick="switchToNextUser">
    <div class="user-avatar">{{ currentUser?.name?.charAt(0) || 'U' }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getCurrentUser, getAllUsers, switchUser } from '../services/authService'

const currentUser = ref(null)
const users = ref([])

const switchToNextUser = async () => {
  try {
    // 確保 users 已加載
    if (users.value.length === 0) {
      console.warn('使用者清單為空，嘗試重新載入')
      users.value = await getAllUsers()
    }
    
    if (users.value.length === 0) {
      console.error('無可用使用者')
      return
    }

    // 找出當前使用者的索引
    const currentIndex = users.value.findIndex(user => user.id === currentUser.value?.id)
    console.log('當前使用者索引:', currentIndex, '使用者總數:', users.value.length)
    
    // 計算下一個使用者的索引
    const nextIndex = (currentIndex + 1) % users.value.length
    const nextUser = users.value[nextIndex]
    
    console.log('切換到使用者:', nextUser.id)
    
    // switchUser 內部會調用 window.location.reload()
    await switchUser(nextUser.id)
  } catch (error) {
    console.error('切換使用者失敗:', error)
  }
}

onMounted(async () => {
  currentUser.value = getCurrentUser()
  try {
    users.value = await getAllUsers()
    console.log('已載入使用者清單:', users.value)
  } catch (error) {
    console.error('無法載入使用者清單:', error)
  }
})
</script>

<style scoped>
.user-avatar-wrapper {
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--shopee-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  flex-shrink: 0;
  transition: all 0.2s;
}

.user-avatar-wrapper:hover .user-avatar {
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
</style>
