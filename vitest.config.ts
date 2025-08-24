import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      exclude: ['*.config.ts', '*.config.mjs'],
    },
    include: ['tests/*.test.ts'],
  },
})
