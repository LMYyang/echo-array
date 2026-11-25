// 打包联网对战服务器为单文件 bundle：部署只需 dist/ + server/ 两个目录（不需要 src/）。
// 产物 server/server.bundle.mjs（ESM，Node 20+）：游戏核心（src/core）与 ws 全部内联，自包含零依赖。
import { build } from 'esbuild'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

await build({
  entryPoints: [path.join(ROOT, 'server', 'index.js')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: path.join(ROOT, 'server', 'server.bundle.mjs'),
  external: ['bufferutil', 'utf-8-validate'],
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module';\nconst require = __createRequire(import.meta.url);",
  },
  legalComments: 'none',
  logLevel: 'info',
})

console.log('[build:server] 产物: server/server.bundle.mjs（自包含，无需 node_modules / src）')
