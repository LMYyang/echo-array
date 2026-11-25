import { createServer } from 'node:http'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import { RoomManager } from './rooms.js'
import { readPort } from './port.js'

const HEARTBEAT_MS = 15_000

export function createServerApp(port = readPort(), { heartbeatMs = HEARTBEAT_MS } = {}) {
  const mgr = new RoomManager()
  const staticDir = process.env.STATIC_DIR
    ? path.resolve(process.env.STATIC_DIR)
    : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/build/h5')
  let staticReady = null

  const httpServer = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost')
      let pathname = decodeURIComponent(url.pathname)
      if (pathname.includes('..')) { res.writeHead(403).end(); return }
      if (pathname === '/') pathname = '/index.html'
      const file = path.join(staticDir, pathname)
      if (!file.startsWith(staticDir)) { res.writeHead(403).end(); return }
      staticReady ||= fs.readdir(staticDir).then(() => true, () => false)
      if (!(await staticReady)) { res.writeHead(426).end('WebSocket only'); return }
      const data = await fs.readFile(file).catch(() => null)
      if (data === null) {
        const index = await fs.readFile(path.join(staticDir, 'index.html')).catch(() => null)
        if (index === null) { res.writeHead(404).end('Not Found'); return }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(index)
        return
      }
      const ext = path.extname(file).toLowerCase()
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' }
      res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' }).end(data)
    } catch (e) {
      console.error('[server] static error:', e.message)
      res.writeHead(500).end()
    }
  })

  const wss = new WebSocketServer({ server: httpServer, maxPayload: 64 * 1024 })

  wss.on('connection', (socket) => {
    const conn = {
      raw: socket,
      token: null,
      alive: true,
      send(obj) { if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(obj)) },
      close() { try { socket.close() } catch { /* noop */ } },
    }
    socket.on('error', (err) => console.error('[server] socket error:', err.message))
    socket.on('pong', () => { conn.alive = true })
    socket.on('message', () => { conn.alive = true })
    const beat = setInterval(() => {
      if (socket.readyState !== socket.OPEN) { clearInterval(beat); return }
      if (!conn.alive) { clearInterval(beat); socket.terminate(); return }
      conn.alive = false
      try { socket.ping() } catch { /* readyState 竞态 */ }
    }, heartbeatMs)
    beat.unref?.()
    socket.on('close', () => { clearInterval(beat); mgr.onConnClose(conn) })
    socket.on('message', (raw) => {
      let msg
      try { msg = JSON.parse(raw.toString()) } catch {
        conn.send({ type: 'error', payload: { code: 'BAD_JSON', message: '消息格式错误' } })
        return
      }
      try {
        handle(mgr, conn, msg)
      } catch (e) {
        conn.send({ type: 'error', payload: { code: 'INTERNAL', message: '服务器内部错误' } })
        console.error('[server] handle error:', e)
      }
    })
  })

  const sweepTimer = setInterval(() => mgr.sweep(), 30_000)
  sweepTimer.unref?.()

  return { httpServer, wss, port, mgr }
}

function handle(mgr, conn, msg) {
  const { type, requestId } = msg || {}
  const payload = (msg && msg.payload) || {}
  const reply = (t, p) => conn.send({ type: t, payload: p, ...(requestId ? { requestId } : {}) })
  const replyError = (code, message) => reply('error', { code, message })

  switch (type) {
    case 'room.list':
      return reply('room.list.ok', { rooms: mgr.listRooms() })
    case 'room.create': {
      const { room, token, seat, error } = mgr.createRoom(conn, sanitizeName(payload.name), String(payload.token || ''))
      if (error) return replyError(error.code, error.message)
      conn.token = token
      return reply('room.created', { room: mgr.roomState(room), token, yourSeat: seat })
    }
    case 'room.join': {
      const roomId = Number(payload.roomId)
      if (!Number.isInteger(roomId)) return replyError('BAD_REQUEST', '房间号非法')
      const { room, token, seat, error } = mgr.joinRoom(conn, sanitizeName(payload.name), roomId, String(payload.token || ''))
      if (error) return replyError(error.code, error.message)
      conn.token = token
      return reply('room.joined', { room: mgr.roomState(room), token, yourSeat: seat })
    }
    case 'room.quickMatch': {
      const { room, token, seat, error } = mgr.quickMatch(conn, sanitizeName(payload.name), String(payload.token || ''))
      if (error) return replyError(error.code, error.message)
      conn.token = token
      return reply('room.joined', { room: mgr.roomState(room), token, yourSeat: seat })
    }
    case 'room.seat': {
      const room = mgr.roomOf(conn.token)
      if (!room) return replyError('NOT_IN_ROOM', '不在此房间')
      const res = mgr.moveSeat(conn.token, room.roomId, Number(payload.seat))
      if (res.error) return replyError(res.error.code, res.error.message)
      return reply('room.seat.ok', {})
    }
    case 'room.ready': {
      const room = mgr.roomOf(conn.token)
      if (!room) return replyError('NOT_IN_ROOM', '不在此房间')
      const res = mgr.setReady(conn.token, room.roomId, !!payload.ready)
      if (res.error) return replyError(res.error.code, res.error.message)
      return reply('room.ready.ok', {})
    }
    case 'room.kick': {
      const room = mgr.roomOf(conn.token)
      if (!room) return replyError('NOT_IN_ROOM', '不在此房间')
      const res = mgr.kickMember(conn.token, room.roomId, String(payload.token || ''))
      if (res.error) return replyError(res.error.code, res.error.message)
      return reply('room.kick.ok', {})
    }
    case 'room.poke': {
      const room = mgr.roomOf(conn.token)
      if (!room) return replyError('NOT_IN_ROOM', '不在此房间')
      const res = mgr.pokeMember(conn.token, room.roomId, String(payload.token || ''))
      if (res.error) return replyError(res.error.code, res.error.message)
      return reply('room.poke.ok', {})
    }
    case 'room.leave': {
      reply('room.left', {})
      mgr.leave(conn.token)
      conn.token = null
      return
    }
    case 'room.setSettings': {
      const room = mgr.roomOf(conn.token)
      if (!room) return replyError('NOT_IN_ROOM', '不在此房间')
      const res = mgr.setRoomSettings(conn.token, room.roomId, payload.settings)
      if (res.error) return replyError(res.error.code, res.error.message)
      return reply('room.setSettings.ok', {})
    }
    case 'game.start': {
      const room = mgr.roomOf(conn.token)
      const res = mgr.startGame(conn.token, room ? room.roomId : NaN)
      if (res.error) return replyError(res.error.code, res.error.message)
      return reply('game.started', {})
    }
    case 'game.flip':
    case 'game.replace':
    case 'game.peek':
    case 'game.swap':
    case 'game.skip':
    case 'game.settleContinue': {
      const res = mgr.gameAction(conn.token, type, payload)
      if (res.error) return replyError(res.error.code, res.error.message)
      return reply('action.ok', {})
    }
    case 'session.check': {
      const found = mgr.checkSession(String(payload.token || ''))
      return reply('session.check.ok', { session: found })
    }
    case 'reconnect': {
      const reqToken = String(payload.token || '')
      if (conn.token && conn.token !== reqToken) mgr.leave(conn.token)
      const res = mgr.reconnect(conn, reqToken)
      if (res.error) return replyError(res.error.code, res.error.message)
      conn.token = reqToken
      return reply('reconnected', { room: mgr.roomState(res.room), yourSeat: res.seat })
    }
    default:
      return replyError('UNKNOWN_TYPE', '未知消息类型')
  }
}

function sanitizeName(name) {
  const s = String(name ?? '').replace(/[\u0000-\u001f\u202a-\u202e]/g, '').trim().slice(0, 12)
  return s || '玩家'
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : ''
if (entry && entry === import.meta.url) {
  const app = createServerApp(Number(process.env.PORT || readPort()))
  app.httpServer.listen(app.port, () => console.log(`[echo-array] server listening on :${app.port}（static: ${process.env.STATIC_DIR || '../dist/build/h5'}）`))
}
