// 端口解析：PORT 环境变量 > config.json 的 wsPort > 3006
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function readPort() {
  if (process.env.PORT) return Number(process.env.PORT)
  try {
    const cfg = JSON.parse(readFileSync(path.join(ROOT, 'config.json'), 'utf8'))
    if (Number.isInteger(cfg.wsPort)) return cfg.wsPort
  } catch { /* 配置缺失回退默认 */ }
  return 3006
}
