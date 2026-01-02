<template>
  <div class="app-layout">
    <!-- Mobile Header -->
    <header class="mobile-header">
      <button
        class="menu-toggle"
        @click="toggleSidebar"
        aria-label="Toggle menu"
        data-testid="mobile-menu-toggle"
      >
        <i class="mdi mdi-menu"></i>
      </button>
      <div class="logo">
        <i class="mdi mdi-home-city"></i>
        <span class="logo-text">Locapilot</span>
      </div>
      <span v-if="!appStore.isOnline" class="offline-badge">
        <i class="mdi mdi-wifi-off"></i>
      </span>
    </header>

    <!-- Overlay for mobile -->
    <div
      v-if="isSidebarOpen"
      class="sidebar-overlay"
      @click="closeSidebar"
      data-testid="sidebar-overlay"
    ></div>

    <!-- Sidebar -->
    <aside class="sidebar" :class="{ open: isSidebarOpen }">
      <div class="sidebar-header">
        <div class="logo">
          <i class="mdi mdi-home-city"></i>
          <span class="logo-text">Locapilot</span>
        </div>
        <button class="close-sidebar" @click="closeSidebar" aria-label="Close menu">
          <i class="mdi mdi-close"></i>
        </button>
      </div>

      <nav class="sidebar-nav">
        <RouterLink to="/" class="nav-item" @click="closeSidebar">
          <i class="mdi mdi-view-dashboard"></i>
          <span>Tableau de bord</span>
        </RouterLink>
        <RouterLink to="/properties" class="nav-item" @click="closeSidebar">
          <i class="mdi mdi-home-variant"></i>
          <span>Propriétés</span>
        </RouterLink>
        <RouterLink to="/tenants" class="nav-item" @click="closeSidebar">
          <i class="mdi mdi-account-group"></i>
          <span>Locataires</span>
        </RouterLink>
        <RouterLink to="/leases" class="nav-item" @click="closeSidebar">
          <i class="mdi mdi-file-document"></i>
          <span>Baux</span>
        </RouterLink>
        <RouterLink to="/rents" class="nav-item" @click="closeSidebar">
          <i class="mdi mdi-cash-multiple"></i>
          <span>Loyers</span>
        </RouterLink>
        <RouterLink to="/documents" class="nav-item" @click="closeSidebar">
          <i class="mdi mdi-folder-multiple"></i>
          <span>Documents</span>
        </RouterLink>
        <RouterLink to="/inventories" class="nav-item" @click="closeSidebar">
          <i class="mdi mdi-clipboard-check"></i>
          <span>États des lieux</span>
        </RouterLink>
      </nav>

      <div class="sidebar-footer">
        <RouterLink to="/settings" class="nav-item" @click="closeSidebar">
          <i class="mdi mdi-cog"></i>
          <span>Paramètres</span>
        </RouterLink>
        <div class="version">v{{ appStore.appVersion }}</div>
      </div>
    </aside>

    <!-- Main Content -->
    <div class="main-wrapper">
      <main class="app-main">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink, RouterView } from 'vue-router';
import { useAppStore } from '@core/store/appStore';

const appStore = useAppStore();
const isSidebarOpen = ref(false);

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};

const closeSidebar = () => {
  isSidebarOpen.value = false;
};
</script>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
  background: var(--bg-primary, #f8fafc);
}

/* Mobile Header */
.mobile-header {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: white;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  padding: 0 var(--space-4, 1rem);
  align-items: center;
  justify-content: space-between;
  z-index: 999;
}

.menu-toggle {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--text-primary, #0f172a);
  cursor: pointer;
  padding: var(--space-2, 0.5rem);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md, 0.5rem);
  transition: background var(--transition-base, 0.2s ease);
}

.menu-toggle:hover {
  background: var(--bg-secondary, #f1f5f9);
}

.menu-toggle:active {
  background: var(--bg-tertiary, #e2e8f0);
}

/* Sidebar Overlay */
.sidebar-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 900; /* Keep overlay beneath the sidebar to avoid intercepting clicks */
  cursor: pointer;
}

.close-sidebar {
  display: none;
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  padding: var(--space-2, 0.5rem);
  border-radius: var(--radius-md, 0.5rem);
  transition: all var(--transition-base, 0.2s ease);
}

.close-sidebar:hover {
  background: var(--bg-secondary, #f1f5f9);
  color: var(--text-primary, #0f172a);
}

/* Sidebar */
.sidebar {
  width: 280px;
  background: white;
  border-right: 1px solid var(--border-color, #e2e8f0);
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}

.sidebar-header {
  padding: var(--space-6, 1.5rem);
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  display: flex;
  align-items: center;
  gap: var(--space-3, 0.75rem);
  font-size: var(--text-xl, 1.25rem);
  font-weight: var(--font-weight-bold, 700);
  background: linear-gradient(135deg, var(--primary-600, #4f46e5), var(--primary-700, #4338ca));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.logo i {
  font-size: 2rem;
  background: linear-gradient(135deg, var(--primary-600, #4f46e5), var(--primary-700, #4338ca));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.logo-text {
  font-weight: var(--font-weight-bold, 700);
}

.offline-badge {
  background: var(--error-100, #fee2e2);
  color: var(--error-600, #dc2626);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
}

.sidebar-nav {
  flex: 1;
  padding: var(--space-4, 1rem);
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 0.25rem);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-3, 0.75rem);
  padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
  border-radius: var(--radius-lg, 0.75rem);
  color: var(--text-secondary, #64748b);
  text-decoration: none;
  font-weight: var(--font-weight-medium, 500);
  transition: all var(--transition-base, 0.2s ease);
  position: relative;
}

.nav-item i {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.nav-item:hover {
  background: var(--bg-secondary, #f1f5f9);
  color: var(--text-primary, #0f172a);
}

.nav-item.router-link-active {
  background: linear-gradient(135deg, var(--primary-50, #eef2ff), var(--primary-100, #e0e7ff));
  color: var(--primary-600, #4f46e5);
  font-weight: var(--font-weight-semibold, 600);
}

.nav-item.router-link-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 70%;
  background: linear-gradient(180deg, var(--primary-600, #4f46e5), var(--primary-700, #4338ca));
  border-radius: 0 4px 4px 0;
}

.sidebar-footer {
  padding: var(--space-4, 1rem);
  border-top: 1px solid var(--border-color, #e2e8f0);
}

.version {
  text-align: center;
  font-size: var(--text-xs, 0.75rem);
  color: var(--text-tertiary, #94a3b8);
  padding: var(--space-2, 0.5rem);
  margin-top: var(--space-2, 0.5rem);
}

/* Main Content */
.main-wrapper {
  flex: 1;
  min-width: 0;
  overflow-x: hidden;
}

.app-main {
  min-height: 100vh;
  background: var(--bg-primary, #f8fafc);
}

/* Responsive */
@media (max-width: 768px) {
  .mobile-header {
    display: flex;
  }

  .sidebar-overlay {
    display: block;
  }

  .sidebar {
    position: fixed;
    left: -280px;
    top: 0;
    bottom: 0;
    z-index: 1000; /* Sidebar above overlay when open */
    transition: left var(--transition-base, 0.2s ease);
    box-shadow: none;
    pointer-events: none; /* Disabled when closed to avoid intercepting clicks */
  }

  .sidebar.open {
    left: 0;
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.15);
    pointer-events: auto; /* Enable when open */
  }

  .sidebar-header {
    padding-top: calc(60px + var(--space-4, 1rem));
  }

  .close-sidebar {
    display: flex;
  }

  .sidebar-header .offline-badge {
    display: none; /* Shown in mobile header instead */
  }

  .main-wrapper {
    margin-left: 0;
    padding-top: 60px;
  }
}
</style>
