import { defineConfig } from 'vite';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    cssInjectedByJsPlugin(),
    dts({
      include: ['src'],
      outDir: 'dist',
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'VoiceInput',
      fileName: (format) => `voiceInput.${format === 'es' ? 'mjs' : 'umd.js'}`,
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: ['@editorjs/editorjs', '@editorjs/dom', '@codexteam/icons'],
    },
  },
});
