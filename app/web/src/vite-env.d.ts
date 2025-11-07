/// <reference types="vite/client" />

// Augment ImportMetaEnv with the variables we rely on explicitly so TypeScript stops complaining
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
