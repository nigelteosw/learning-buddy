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
    name: 'Learning Buddy',
    short_name: 'Learning Buddy',
    description: 'Select text on any page to get AI-powered summaries, explanations, key ideas, analogies, and quizzes.',

    // You can also set the version here
    version: '0.1.0',
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