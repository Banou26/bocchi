import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
// import { builtinModules } from 'module'

// import pkg from './package.json'
import polyfills from './vite-plugin-node-stdlib-browser.cjs'

export default defineConfig({
  build: {
    target: 'esnext',
    lib: {
      formats: ['es'],
      entry: './src/index.ts',
      name: 'index'
    },
    // rollupOptions: {
    //   external: [
    //     ...builtinModules,
    //     ...Object
    //       .keys(pkg.dependencies)
    //   ]
    // }
  },
  plugins: [
    react(),
    polyfills()
  ]
})
