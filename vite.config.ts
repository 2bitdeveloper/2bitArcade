import { defineConfig } from 'vite';
import { resolve } from 'path';

// 2bitArcade multi-page build:
//   /            -> arcade landing (game selector)
//   /jumpfighter.html
//   /origami.html
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        jumpfighter: resolve(__dirname, 'jumpfighter.html'),
        origami: resolve(__dirname, 'origami.html'),
        debris: resolve(__dirname, 'debris.html'),
      },
    },
  },
});
