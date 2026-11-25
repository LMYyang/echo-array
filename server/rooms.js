/**
 * 回声阵房间与成员管理（服务器权威）。
 * Room: { roomId, members, g, settleAck, timers, createdAt, lastActiveAt, settings }
 * 成员: { seat, token, name, connected, gone, ready, isHost, isAI, conn, graceTimer, aiTimer }
 */

import { randomUUID } from 'node:crypto'
import {
  createGame, startGame, flipCard, resolvePair, coverMismatch, coverJoker,
  replaceCard, peekCard, swapJoker, skipTurn, endTurn, viewOf,
} from '../src/core/game.js'
import { aiChooseAction, aiThinkDelay } from '../src/core/ai.js'
import { DEFAULT_SETTINGS, normalizeSettings } from '../src/core/settings.js'

const GRACE_MS = 60_000
const ROOM_IDLE_MS = 5 * 60_000
const MAX_SEATS = 4

function makeToken() { return randomUUID() }

export class RoomManager {
  constructor() {
    this.rooms = new Map()
    this.tokens = new Map()
    this.now = () => Date.now()
  }

  roomStateOf(room) { return room.g ? room.g.state : 'WAITING' }
  isSettling(room) { return !!room.g && room.g.state === 'SETTLE' }

  roomState(room) {
    return {
      roomId: room.roomId,
      state: this.roomStateOf(room),
      settling: this.isSettling(room),
      settings: { ...room.settings },
      members: room.members.map((m) => ({
        seat: m.seat, name: m.name, connected: m.connected, gone: m.gone,
        ready: m.ready, isHost: m.isHost, isAI: m.isAI, token: m.token,
        settled: room.settleAck.has(m.seat),
      })),
    }
  }

  listRooms() {
    return [...this.rooms.values()]
      .filter((r) => {
        if (this.roomStateOf(r) !== 'WAITING') return false
        const humans = r.members.filter((m) => !m.isAI && m.connected && !m.gone)
        return humans.length > 0 && r.members.length < r.settings.playerCount
      })
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((r) => ({
        roomId: r.roomId,
        settings: { ...r.settings },
        members: r.members.filter((m) => !m.isAI).map((m) => ({ name: m.name, connected: m.connected, isHost: m.isHost })),
      }))
  }

  broadcast(room, type, payload, exceptToken = null) {
    for (const m of room.members) {
      if (m.token === exceptToken || !m.conn) continue
      m.conn.send({ type, payload })
    }
  }

  pushRoomState(room, exceptToken = null) {
    this.broadcast(room, 'room.state', { room: this.roomState(room) }, exceptToken)
  }

  firstVacantSeat(room) {
    const used = new Set(room.members.map((m) => m.seat))
    for (let s = 0; s < room.settings.playerCount; s++) if (!used.has(s)) return s
    return -1
  }

  findMemberByConn(conn) {
    for (const room of this.rooms.values()) {
      const m = room.members.find((mm) => mm.conn === conn)
      if (m) return { room, member: m }
    }
    return null
  }

  removeMember(room, member) {
    room.members = room.members.filter((m) => m !== member)
    this.tokens.delete(member.token)
    room.lastActiveAt = this.now()
    if (room.members.length === 0) { this.destroyRoom(room.roomId); return }
    if (member.isHost) this.promoteHost(room)
    this.pushRoomState(room)
  }

  promoteHost(room) {
    const next = room.members[0]
    if (next) { next.isHost = true; next.ready = true }
  }

  hasLiveHost(room) {
    return room.members.some((m) => m.isHost && !m.isAI && m.connected && !m.gone)
  }

  destroyRoom(roomId) {
    const room = this.rooms.get(roomId)
    if (!room) return
    for (const m of room.members) {
      this.tokens.delete(m.token)
      if (m.graceTimer) clearTimeout(m.graceTimer)
      m.conn = null
    }
    for (const t of room.timers || []) clearTimeout(t)
    this.rooms.delete(roomId)
  }

  tryRejoin(conn, name, oldToken) {
    if (!oldToken) return null
    const room = this.roomOf(oldToken)
    if (!room || this.roomStateOf(room) !== 'WAITING') return null
    const existing = this.memberByToken(room, oldToken)
    if (!existing || existing.isAI || existing.gone) return null
    return this.rejoinRoom(conn, name, room.roomId, oldToken)
  }

  newRoomId() {
    for (;;) {
      const id = 100000 + Math.floor(Math.random() * 900000)
      if (!this.rooms.has(id)) return id
    }
  }

  rejoinRoom(conn, name, roomId, oldToken) {
    const room = this.rooms.get(roomId)
    if (!room || this.roomStateOf(room) !== 'WAITING') return null
    const existing = oldToken ? this.memberByToken(room, oldToken) : null
    if (!existing || existing.isAI) return null
    if (room.members.some((m) => m !== existing && m.seat === existing.seat)) return null
    if (existing.graceTimer) { clearTimeout(existing.graceTimer); existing.graceTimer = null }
    existing.name = name
    existing.connected = true
    if (existing.conn && existing.conn !== conn) { try { existing.conn.close() } catch { /* 旧连接已死 */ } }
    existing.conn = conn
    room.lastActiveAt = this.now()
    this.pushRoomState(room)
    return { room, token: existing.token, seat: existing.seat, rejoined: true }
  }

  createRoom(conn, name, oldToken = '') {
    const existing = this.findMemberByConn(conn)
    if (existing && this.roomStateOf(existing.room) !== 'WAITING') {
      return { error: { code: 'ROOM_STARTED', message: '对局进行中，不能更换房间' } }
    }
    if (existing) {
      existing.member.name = name
      this.pushRoomState(existing.room)
      return { room: existing.room, token: existing.member.token, seat: existing.member.seat, rejoined: true }
    }
    const rejoined = this.tryRejoin(conn, name, oldToken)
    if (rejoined) return rejoined
    const roomId = this.newRoomId()
    const room = {
      roomId, members: [], g: null, settleAck: new Set(),
      createdAt: this.now(), lastActiveAt: this.now(), timers: new Set(),
      settings: { ...DEFAULT_SETTINGS },
    }
    this.rooms.set(roomId, room)
    return this.joinRoom(conn, name, roomId)
  }

  joinRoom(conn, name, roomId, oldToken = '') {
    const room = this.rooms.get(roomId)
    if (!room) return { error: { code: 'ROOM_GONE', message: '房间不存在或已解散' } }
    if (this.roomStateOf(room) !== 'WAITING') return { error: { code: 'ROOM_STARTED', message: '对局已开始，无法加入' } }
    const rejoined = this.tryRejoin(conn, name, oldToken)
    if (rejoined && rejoined.room === room) return rejoined
    const seat = this.firstVacantSeat(room)
    if (seat === -1) return { error: { code: 'ROOM_FULL', message: '房间已满' } }
    const existing = this.findMemberByConn(conn)
    if (existing && existing.room !== room) {
      if (this.roomStateOf(existing.room) !== 'WAITING') {
        return { error: { code: 'ROOM_STARTED', message: '对局进行中，不能更换房间' } }
      }
      this.removeMember(existing.room, existing.member)
    }
    const token = makeToken()
    const member = {
      seat, token, name, connected: true, gone: false,
      ready: room.members.length === 0, isHost: room.members.length === 0,
      isAI: false, conn, graceTimer: null, aiTimer: null,
    }
    room.members.push(member)
    this.tokens.set(token, room)
    room.lastActiveAt = this.now()
    this.pushRoomState(room)
    return { room, token, seat }
  }

  quickMatch(conn, name, oldToken = '') {
    const rejoined = this.tryRejoin(conn, name, oldToken)
    if (rejoined) return rejoined
    const candidates = [...this.rooms.values()]
      .filter((r) => this.roomStateOf(r) === 'WAITING' && this.firstVacantSeat(r) !== -1)
      .sort((a, b) => a.createdAt - b.createdAt)
    if (candidates.length > 0) return this.joinRoom(conn, name, candidates[0].roomId)
    return this.createRoom(conn, name)
  }

  roomOf(token) { return this.tokens.get(token) || null }
  memberByToken(room, token) { return room.members.find((m) => m.token === token) || null }

  moveSeat(token, roomId, seat) {
    const room = this.rooms.get(roomId)
    if (!room) return { error: { code: 'ROOM_GONE', message: '房间不存在' } }
    if (this.roomStateOf(room) !== 'WAITING') return { error: { code: 'ROOM_STARTED', message: '对局中不能换座位' } }
    const me = this.memberByToken(room, token)
    if (!me) return { error: { code: 'NOT_IN_ROOM', message: '不在此房间' } }
    if (!Number.isInteger(seat) || seat < 0 || seat >= room.settings.playerCount) return { error: { code: 'SEAT_INVALID', message: '座位号非法' } }
    if (seat === me.seat) return { ok: true }
    const target = room.members.find((m) => m.seat === seat)
    if (target) return { error: { code: 'SEAT_TAKEN', message: '该座位已有人' } }
    me.seat = seat
    room.lastActiveAt = this.now()
    this.pushRoomState(room)
    return { ok: true }
  }

  setReady(token, roomId, ready) {
    const room = this.rooms.get(roomId)
    if (!room) return { error: { code: 'ROOM_GONE', message: '房间不存在' } }
    if (this.roomStateOf(room) !== 'WAITING') return { error: { code: 'ROOM_STARTED', message: '对局中不能修改准备状态' } }
    const me = this.memberByToken(room, token)
    if (!me) return { error: { code: 'NOT_IN_ROOM', message: '不在此房间' } }
    me.ready = !!ready
    room.lastActiveAt = this.now()
    this.pushRoomState(room)
    return { ok: true }
  }

  setRoomSettings(token, roomId, raw) {
    const room = this.rooms.get(roomId)
    if (!room) return { error: { code: 'ROOM_GONE', message: '房间不存在' } }
    if (this.roomStateOf(room) !== 'WAITING') return { error: { code: 'ROOM_STARTED', message: '对局中不能修改设置' } }
    const me = this.memberByToken(room, token)
    if (!me) return { error: { code: 'NOT_IN_ROOM', message: '不在此房间' } }
    if (!me.isHost) return { error: { code: 'NOT_HOST', message: '只有房主能修改设置' } }
    room.settings = normalizeSettings(raw)
    room.lastActiveAt = this.now()
    this.pushRoomState(room)
    return { ok: true }
  }

  // ---------- 对局 ----------

  canStart(room) {
    if (room.members.length === 0) return { ok: false, message: '需要至少 1 名玩家' }
    if (!room.members.every((m) => m.ready || m.isAI)) return { ok: false, message: '所有玩家须先准备' }
    return { ok: true }
  }

  fillWithAI(room) {
    const used = new Set(room.members.map((m) => m.seat))
    for (let seat = 0; seat < room.settings.playerCount; seat++) {
      if (used.has(seat)) continue
      room.members.push({
        seat, token: null, name: `AI·回声${seat}`, connected: true, gone: false,
        ready: true, isHost: false, isAI: true, conn: null, graceTimer: null, aiTimer: null,
      })
    }
  }

  startGame(token, roomId) {
    const room = this.rooms.get(roomId)
    if (!room) return { error: { code: 'ROOM_GONE', message: '房间不存在' } }
    if (this.roomStateOf(room) !== 'WAITING') return { error: { code: 'ROOM_STARTED', message: '对局已开始' } }
    const me = this.memberByToken(room, token)
    if (!me || !me.isHost) return { error: { code: 'NOT_HOST', message: '只有房主能开始' } }
    this.fillWithAI(room)
    const check = this.canStart(room)
    if (!check.ok) return { error: { code: 'CANNOT_START', message: check.message } }
    this.pushRoomState(room)
    const g = createGame(Math.random, room.settings)
    startGame(g, room.settings.playerCount)
    room.g = g
    room.settleAck = new Set()
    room.timers = new Set()
    this.pushGameState(room)
    this.scheduleAiTurn(room)
    return { ok: true }
  }

  pushGameState(room, onlySeat = null) {
    for (const m of room.members) {
      if (!m.conn) continue
      if (onlySeat !== null && m.seat !== onlySeat) continue
      m.conn.send({ type: 'game.state', payload: this.gameView(room, m.seat) })
    }
  }

  gameView(room, seat) {
    const names = {}
    for (const m of room.members) names[m.seat] = m.name
    return { view: viewOf(room.g, seat), fx: { mode: 'flip' }, roomId: room.roomId, yourSeat: seat, names }
  }

  /** 校验身份与轮次后执行动作；失败只经返回值回传，不改状态 */
  gameAction(token, type, payload) {
    payload = payload || {}
    const room = this.roomOf(token)
    if (!room) return { error: { code: 'NOT_IN_ROOM', message: '不在此房间' } }
    const me = this.memberByToken(room, token)
    if (!me) return { error: { code: 'NOT_IN_ROOM', message: '不在此房间' } }
    const g = room.g
    if (!g) return { error: { code: 'NO_GAME', message: '对局未开始' } }
    if (g.state !== 'PLAYING') return { error: { code: 'BAD_STATE', message: '非对局阶段' } }
    if (g.currentSeat !== me.seat) return { error: { code: 'NOT_YOUR_TURN', message: '没轮到你' } }
    if (me.aiTimer) return { error: { code: 'NOT_YOUR_TURN', message: '托管中' } }

    let res
    switch (type) {
      case 'game.flip': {
        const slot = Number(payload.slot)
        res = flipCard(g, me.seat, slot)
        if (!res.ok) return { error: { code: 'ILLEGAL', message: res.reason } }
        if (res.joker) {
          coverJoker(g)
          this.afterAction(room)
          return { ok: true }
        }
        if (g.pending.stage === 'revealed') {
          const pair = resolvePair(g)
          if (pair.ok && !pair.matched) coverMismatch(g)
          this.afterAction(room)
        } else {
          // 第一张已翻，等待第二张：只推视图，不结束回合
          this.pushGameState(room)
        }
        return { ok: true }
      }
      case 'game.replace': {
        res = replaceCard(g, me.seat, payload.handCardId, Number(payload.targetSlot), Number(payload.emptySlot))
        if (!res.ok) return { error: { code: 'ILLEGAL', message: res.reason } }
        this.afterAction(room)
        return { ok: true }
      }
      case 'game.peek': {
        res = peekCard(g, me.seat, payload.handCardId, Number(payload.slot))
        if (!res.ok) return { error: { code: 'ILLEGAL', message: res.reason } }
        this.afterAction(room)
        return { ok: true }
      }
      case 'game.swap': {
        const empty = payload.emptySlot == null ? null : Number(payload.emptySlot)
        res = swapJoker(g, me.seat, payload.handCardId, Number(payload.targetSlot), empty)
        if (!res.ok) return { error: { code: 'ILLEGAL', message: res.reason } }
        this.afterAction(room)
        return { ok: true }
      }
      case 'game.skip': {
        res = skipTurn(g, me.seat)
        if (!res.ok) return { error: { code: 'ILLEGAL', message: res.reason } }
        this.afterAction(room)
        return { ok: true }
      }
      case 'game.settleContinue':
        return this.settleContinue(room, me)
      default:
        return { error: { code: 'UNKNOWN_ACTION', message: '未知动作' } }
    }
  }

  /** 动作收尾：结束回合 → 终局下发结算 / 推视图并调度 AI */
  afterAction(room) {
    const g = room.g
    endTurn(g)
    if (g.state === 'SETTLE') {
      for (const m of room.members) {
        if (!m.conn) continue
        m.conn.send({ type: 'game.over', payload: { result: g.result, view: viewOf(g, m.seat) } })
      }
      this.pushRoomState(room)
      return
    }
    this.pushGameState(room)
    this.scheduleAiTurn(room)
  }

  /** 轮到 AI/掉线托管座位：按难度延时后代打 */
  scheduleAiTurn(room) {
    const g = room.g
    if (!g || g.state !== 'PLAYING') return
    const seat = g.currentSeat
    const member = room.members.find((m) => m.seat === seat)
    if (!member || (!member.isAI && !member.aiTimer)) return
    const delay = aiThinkDelay(g)
    const t = setTimeout(() => {
      room.timers.delete(t)
      if (room.g !== g || g.state !== 'PLAYING' || g.currentSeat !== seat) return
      const m2 = room.members.find((x) => x.seat === seat)
      if (!m2 || (!m2.isAI && !m2.aiTimer)) return
      const choice = aiChooseAction(g, seat)
      let ok = true
      switch (choice.action) {
        case 'flip': {
          const [a, b] = choice.slots
          const r1 = flipCard(g, seat, a)
          if (r1.ok && r1.joker) { coverJoker(g); break }
          flipCard(g, seat, b)
          const pair = resolvePair(g)
          if (pair.ok && !pair.matched) coverMismatch(g)
          break
        }
        case 'replace':
          ok = replaceCard(g, seat, choice.handCardId, choice.targetSlot, choice.emptySlot).ok
          break
        case 'peek':
          ok = peekCard(g, seat, choice.handCardId, choice.slot).ok
          break
        case 'swap':
          ok = swapJoker(g, seat, choice.handCardId, choice.targetSlot, choice.emptySlot ?? null).ok
          break
        default:
          ok = skipTurn(g, seat).ok
      }
      if (ok) this.afterAction(room)
    }, delay)
    room.timers.add(t)
  }

  // ---------- 断线/重连/离开/销毁 ----------

  onConnClose(conn) {
    if (!conn.token) return
    this.onDisconnect(conn.token, conn)
  }

  onDisconnect(token, conn = null) {
    const room = this.roomOf(token)
    if (!room) return
    const me = this.memberByToken(room, token)
    if (!me) return
    if (conn && me.conn && me.conn !== conn) return
    if (this.roomStateOf(room) === 'WAITING') {
      if (me.graceTimer) { clearTimeout(me.graceTimer); me.graceTimer = null }
      this.removeMember(room, me)
      return
    }
    me.connected = false
    me.conn = null
    if (me.graceTimer) clearTimeout(me.graceTimer)
    me.graceTimer = setTimeout(() => {
      if (me.connected || me.gone) return
      me.gone = true
      this.tokens.delete(token)
      this.pushRoomState(room)
    }, GRACE_MS)
    this.enableAiControl(room, me)
    this.pushRoomState(room)
  }

  enableAiControl(room, member) {
    if (member.isAI || member.aiTimer) return
    member.aiTimer = true
    if (room.g && room.g.state === 'PLAYING' && room.g.currentSeat === member.seat) this.scheduleAiTurn(room)
  }

  disableAiControl(member) { member.aiTimer = null }

  checkSession(token) {
    const room = this.roomOf(token)
    if (!room) return null
    const me = this.memberByToken(room, token)
    if (!me || me.gone) return null
    return { roomId: room.roomId, state: this.roomStateOf(room) }
  }

  reconnect(conn, token) {
    const room = this.roomOf(token)
    if (!room) return { error: { code: 'ROOM_GONE', message: '房间已解散' } }
    const me = this.memberByToken(room, token)
    if (!me || me.gone) return { error: { code: 'ROOM_GONE', message: '房间已解散' } }
    if (me.conn && me.conn !== conn) { try { me.conn.close() } catch { /* 旧连接已死 */ } }
    me.conn = conn
    me.connected = true
    if (me.graceTimer) { clearTimeout(me.graceTimer); me.graceTimer = null }
    this.disableAiControl(me)
    conn.send({ type: 'room.state', payload: { room: this.roomState(room) } })
    if (room.g) conn.send({ type: 'game.state', payload: this.gameView(room, me.seat) })
    this.pushRoomState(room, token)
    return { room, seat: me.seat }
  }

  leave(token) {
    const room = this.roomOf(token)
    if (!room) return { ok: true }
    const me = this.memberByToken(room, token)
    if (!me) return { ok: true }
    if (me.graceTimer) { clearTimeout(me.graceTimer); me.graceTimer = null }
    if (this.roomStateOf(room) === 'WAITING') {
      this.removeMember(room, me)
      return { ok: true }
    }
    if (me.conn) { try { me.conn.close() } catch { /* noop */ } }
    this.onDisconnect(token)
    return { ok: true }
  }

  kickMember(hostToken, roomId, targetToken) {
    const room = this.rooms.get(roomId)
    if (!room) return { error: { code: 'ROOM_GONE', message: '房间不存在' } }
    if (this.roomStateOf(room) !== 'WAITING') return { error: { code: 'ROOM_STARTED', message: '对局中不能移出玩家' } }
    const host = this.memberByToken(room, hostToken)
    if (!host || !host.isHost) return { error: { code: 'NOT_HOST', message: '只有房主能移出玩家' } }
    const target = this.memberByToken(room, targetToken)
    if (!target) return { error: { code: 'NOT_IN_ROOM', message: '对方不在此房间' } }
    if (target === host) return { error: { code: 'BAD_REQUEST', message: '不能移出自己' } }
    if (target.conn) target.conn.send({ type: 'kicked', payload: { message: '你已被房主移出房间' } })
    this.removeMember(room, target)
    return { ok: true }
  }

  pokeMember(hostToken, roomId, targetToken) {
    const room = this.rooms.get(roomId)
    if (!room) return { error: { code: 'ROOM_GONE', message: '房间不存在' } }
    if (this.roomStateOf(room) !== 'WAITING') return { error: { code: 'ROOM_STARTED', message: '对局中无需提醒' } }
    const host = this.memberByToken(room, hostToken)
    if (!host || !host.isHost) return { error: { code: 'NOT_HOST', message: '只有房主能提醒准备' } }
    const target = this.memberByToken(room, targetToken)
    if (!target) return { error: { code: 'NOT_IN_ROOM', message: '对方不在此房间' } }
    if (target === host) return { error: { code: 'BAD_REQUEST', message: '不能提醒自己' } }
    if (target.isAI) return { error: { code: 'BAD_REQUEST', message: 'AI 无需提醒' } }
    if (target.ready) return { error: { code: 'ALREADY_READY', message: '对方已准备' } }
    if (target.conn) target.conn.send({ type: 'poke', payload: { message: '房主提醒你准备' } })
    return { ok: true }
  }

  sweep() {
    for (const room of [...this.rooms.values()]) {
      const state = this.roomStateOf(room)
      const alive = room.members.some((m) => (m.connected || m.isAI) && !m.gone)
      if (state !== 'WAITING') {
        const allGone = room.members.length > 0 && room.members.every((m) => m.gone)
        if (allGone) this.destroyRoom(room.roomId)
        continue
      }
      if (!alive) { this.destroyRoom(room.roomId); continue }
      if (!this.hasLiveHost(room)) {
        const humans = room.members.filter((m) => !m.isAI)
        if (humans.length === 0) { this.destroyRoom(room.roomId); continue }
        this.promoteHost(room)
        this.pushRoomState(room)
      }
      if (this.now() - (room.lastActiveAt ?? room.createdAt) >= ROOM_IDLE_MS) {
        this.destroyRoom(room.roomId)
      }
    }
  }

  settleContinue(room, me) {
    if (!room.g || room.g.state !== 'SETTLE') return { error: { code: 'BAD_STATE', message: '非结算阶段' } }
    room.settleAck.add(me.seat)
    me.ready = true
    const active = room.members.filter((m) => !m.gone && !m.isAI).length
    if (active === 0 || room.settleAck.size >= active) {
      this.finishSettle(room)
    } else {
      if (!room.settleTimer) {
        room.settleTimer = setTimeout(() => this.finishSettle(room), 5000)
        room.timers.add(room.settleTimer)
      }
      this.pushRoomState(room)
    }
    return { ok: true }
  }

  finishSettle(room) {
    if (room.settleTimer) {
      clearTimeout(room.settleTimer)
      room.timers.delete(room.settleTimer)
      room.settleTimer = null
    }
    if (!room.g || room.g.state !== 'SETTLE') return
    room.g = null
    room.settleAck = new Set()
    room.lastActiveAt = this.now()
    for (const m of [...room.members]) {
      if (m.isAI || !m.connected || m.gone) {
        if (m.graceTimer) { clearTimeout(m.graceTimer); m.graceTimer = null }
        this.tokens.delete(m.token)
        room.members = room.members.filter((x) => x !== m)
      }
    }
    if (room.members.length === 0) { this.destroyRoom(room.roomId); return }
    if (!room.members.some((m) => m.isHost)) this.promoteHost(room)
    for (const m of room.members) m.ready = true
    this.pushRoomState(room)
  }
}
