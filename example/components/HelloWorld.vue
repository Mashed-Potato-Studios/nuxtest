<template>
  <div class="hello-world">
    <h1>{{ message }}</h1>
    <button @click="incrementCounter">Count: {{ counter }}</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

interface Props {
  message?: string;
}

const props = withDefaults(defineProps<Props>(), {
  message: "Hello World",
});

const counter = ref(0);

function incrementCounter() {
  counter.value++;
}
</script>

<style scoped>
.hello-world {
  padding: 20px;
  background-color: #f5f5f5;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

button {
  padding: 8px 16px;
  background-color: #00dc82;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background-color: #00b86b;
}
</style>
