<template>
  <div class="main-page">
    <div class="container">
      <!-- Header -->
      <div class="header">
        <h1 class="header__title">Multi-Tenant Demo Application</h1>
        <p class="header__subtitle">Domain-based tenant identification system</p>
      </div>

      <!-- Domain Info Card -->
      <div class="domain-card">
        <div class="domain-card__icon">
          <svg viewBox="0 0 24 24">
            <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9"></path>
          </svg>
        </div>
        
        <div v-if="pending" class="loading">
          <div class="loading__spinner"></div>
          <p class="loading__text">Loading domain information...</p>
        </div>
        
        <div v-else-if="error" class="error">
          <div class="error__content">
            <svg class="error__icon" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
            </svg>
            <div>
              <h3 class="error__title">Error loading domain</h3>
              <p class="error__message">{{ error }}</p>
            </div>
          </div>
        </div>
        
        <div v-else class="domain-card__content">
          <h2 class="domain-card__title">Current Domain</h2>
          <div class="domain-card__domain">
            <p class="domain-card__domain-text">{{ data?.domain }}</p>
            <p class="domain-card__domain-label">Detected from request headers</p>
          </div>
        </div>
      </div>

      <!-- Navigation Cards -->
      <div class="nav-grid">
        <NuxtLink to="/sample" class="nav-card">
          <div class="nav-card__icon nav-card__icon--success">
            <svg viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <h3 class="nav-card__title">Sample Page</h3>
          <p class="nav-card__description">Test page for development</p>
        </NuxtLink>

        <NuxtLink to="/product" class="nav-card">
          <div class="nav-card__icon nav-card__icon--purple">
            <svg viewBox="0 0 24 24">
              <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
            </svg>
          </div>
          <h3 class="nav-card__title">Products</h3>
          <p class="nav-card__description">Product catalog</p>
        </NuxtLink>

        <NuxtLink to="/user" class="nav-card">
          <div class="nav-card__icon nav-card__icon--warning">
            <svg viewBox="0 0 24 24">
              <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
            </svg>
          </div>
          <h3 class="nav-card__title">Users</h3>
          <p class="nav-card__description">User management</p>
        </NuxtLink>

        <NuxtLink to="/order" class="nav-card">
          <div class="nav-card__icon nav-card__icon--error">
            <svg viewBox="0 0 24 24">
              <path d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
            </svg>
          </div>
          <h3 class="nav-card__title">Orders</h3>
          <p class="nav-card__description">Order management</p>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { getApiUrl } from '~/utils/api'

const { data, pending, error } = await useFetch(getApiUrl('/domain'))
</script>

<style lang="scss" scoped>
@import '~/assets/scss/main.scss';
</style>
