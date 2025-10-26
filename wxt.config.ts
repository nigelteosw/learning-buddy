// wxt.config.ts
import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  srcDir: "src",             // default: "."
  vite: () => ({
    plugins: [react(), tailwind()],
  }),
  manifest: {
    // Add all the permissions you outlined
    permissions: [
      'sidePanel',
      'contextMenus',
      'alarms',
      'storage', // For chrome.storage.sync
      'activeTab', // For the content script to work
    ],
  },
});