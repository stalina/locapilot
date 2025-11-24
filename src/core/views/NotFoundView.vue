<template>
  <div class="not-found">
    <h1>404 - Page non trouvée</h1>
    <p>La page que vous recherchez n'existe pas.</p>
    <RouterLink to="/">Retour à l'accueil</RouterLink>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>

<style scoped>
.not-found {
  text-align: center;
  padding: 4rem 2rem;
}
</style>
