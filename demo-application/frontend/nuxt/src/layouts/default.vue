<template>
  <div class="container">
    <slot />
    <footer>
      <p>Copyright &copy; 2024 ngsw877. All rights reserved.</p>
    </footer>
  </div>
</template>
<style scoped>
.container {
  color: red;
}

footer {
  background-color: orange;
  color: white;
  text-align: center;
}
</style>
