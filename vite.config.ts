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
        rraid: resolve(__dirname, 'rraid.html'),
        bullethell: resolve(__dirname, 'bullethell.html'),
        spacepi: resolve(__dirname, 'spacepi.html'),
        luckyalien: resolve(__dirname, 'luckyalien.html'),
        neonrunner: resolve(__dirname, 'neonrunner.html'),
        neonracer: resolve(__dirname, 'neonracer.html'),
        sunsetdrift: resolve(__dirname, 'sunsetdrift.html'),
        junglestrike: resolve(__dirname, 'junglestrike.html'),
      },
    },
  },
});
