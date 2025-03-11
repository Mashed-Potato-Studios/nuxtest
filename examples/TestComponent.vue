<template>
  <div class="test-component">
    <h1>{{ title }}</h1>
    <p>{{ message }}</p>
    <button @click="incrementCounter">Clicked {{ counter }} times</button>
  </div>
</template>

<script>
export default {
  name: "TestComponent",
  data() {
    return {
      title: "Test Component",
      message: "This is a test component for the preview feature",
      counter: 0,
    };
  },
  methods: {
    incrementCounter() {
      this.counter++;
    },
  },
};
</script>

<style>
.test-component {
  padding: 20px;
  border: 2px solid #42b883;
  border-radius: 8px;
  font-family: Arial, sans-serif;
}

h1 {
  color: #42b883;
}

button {
  background-color: #42b883;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 10px;
}

button:hover {
  background-color: #33a06f;
}
</style>
