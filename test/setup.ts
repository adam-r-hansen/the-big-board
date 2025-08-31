import '@testing-library/jest-dom/vitest'

// Minimal polyfills some libs expect
Object.defineProperty(global, 'crypto', { value: require('crypto') })
