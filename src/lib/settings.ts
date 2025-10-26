import { storage } from "#imports";

// Define a new storage item.
// It will be stored in 'local' storage.
// 'fallback: true' means the extension is ON by default.
export const isExtensionEnabled = storage.defineItem<boolean>(
  'local:isExtensionEnabled',
  {
    fallback: true,
  }
);