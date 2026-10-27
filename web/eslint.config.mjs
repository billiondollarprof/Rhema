// eslint.config.mjs: the lint rules (checks that catch common mistakes)
// for the web app. Uses Next.js's own recommended set, unchanged.
import next from 'eslint-config-next'

const config = [...next, { ignores: ['.next/**', 'out/**', 'next-env.d.ts'] }]

export default config
