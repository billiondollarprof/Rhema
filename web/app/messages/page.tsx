/*
 * app/messages/page.tsx: Messages, from room to room (request 123).
 *
 * Why: Anthony, 2026-11-02: "send from a room to a room... from front desk
 * to lab, from lab to pharmacy... just the way you also call attention";
 * groups too; "a normal message that they can just type... and send."
 *
 * The screen: on the left (on a phone, first) the rooms and groups, each
 * with its last message and how many are unread; then the conversation,
 * with a box to type in. Your own messages show their ticks:
 *   clock   waiting for the network (sends by itself)
 *   one     sent
 *   two     read (for a group: read by everyone in it)
 * Opening a conversation marks its messages read.
 *
 * Never: show a message to anybody the database does not let read it.
 */
'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import styles from './messages.module.css'
import AppShell from '@/components/shell/AppShell'
import { OUTBOX_CHANGED, readOutbox } from '@/lib/offline/outbox'
import {
  GROUP_WORDS,
  loadMessages,
  loadReads,
  loadRoomStaff,
  loadRooms,
  markRead,
  sendMessage,
  type Message,
  type Read,
  type Room,
  type RoomKind,
  type Target,
} from '@/lib/messages/messages'
import { useRightPage } from '@/lib/auth/routes'
import { useAuth } from '@/lib/auth/session'

// ===== 1. Which conversation a message belongs to, for this room =====
// "room:12" is the conversation with room 12; "kind:nursing" is a group.
function conversationOf(message: Message, myRoom: number): string {
  if (message.from_room_id === myRoom) {
    return message.to_room_id ? `room:${message.to_room_id}` : `kind:${message.to_kind}`
  }
  return `room:${message.from_room_id}`
}

const time = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

function Messages() {
  const auth = useAuth()
  useRightPage(auth.status, '/messages/')
  const router = useRouter()
  const chosen = useSearchParams().get('c')
  const { client, staff } = auth
  const myRoom = staff?.room_id ?? null

  const [rooms, setRooms] = useState<Room[]>([])
  const [roomStaff, setRoomStaff] = useState<{ id: string; room_id: number }[]>([])
  const [messages, setMessages] = useState<Message[] | null>(null)
  const [reads, setReads] = useState<Read[]>([])
  const [waiting, setWaiting] = useState<{ key: string; body: string; target: string }[]>([])
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const bottom = useRef<HTMLDivElement>(null)

  // ===== 2. Load, then every 15 seconds =====
  const load = useCallback(async () => {
    if (!client) return
    const found = await loadMessages(client)
    setMessages(found)
    setReads(
      await loadReads(
        client,
        found.map((message) => message.id),
      ),
    )
  }, [client])

  useEffect(() => {
    if (!client || auth.status !== 'ready') return
    let current = true
    Promise.all([loadRooms(client), loadRoomStaff(client)]).then(([foundRooms, people]) => {
      if (!current) return
      setRooms(foundRooms)
      setRoomStaff(people)
    })
    const first = window.setTimeout(() => void load(), 0)
    const timer = window.setInterval(() => void load(), 15_000)
    return () => {
      current = false
      window.clearTimeout(first)
      window.clearInterval(timer)
    }
  }, [client, auth.status, load])

  // Messages waiting on this device for the network (the clock).
  useEffect(() => {
    if (!staff) return
    const show = () =>
      setWaiting(
        readOutbox(staff.id).flatMap((task) =>
          task.kind === 'message'
            ? [
                {
                  key: task.clientKey,
                  body: task.body,
                  target: task.toRoom ? `room:${task.toRoom}` : `kind:${task.toKind}`,
                },
              ]
            : [],
        ),
      )
    show()
    window.addEventListener(OUTBOX_CHANGED, show)
    return () => window.removeEventListener(OUTBOX_CHANGED, show)
  }, [staff, messages])

  // ===== 3. The conversations, newest first =====
  const conversations = useMemo(() => {
    if (!myRoom) return []
    const mine = rooms.find((room) => room.id === myRoom)
    const list = rooms
      .filter((room) => room.id !== myRoom)
      .map((room) => ({
        key: `room:${room.id}`,
        name: room.name,
        target: { kind: room.kind, room: room.id } as Target,
      }))
    // A group for every kind with more than one room (not your own group).
    const kinds = [...new Set(rooms.map((room) => room.kind))].filter(
      (kind) => rooms.filter((room) => room.kind === kind).length > 1 && kind !== mine?.kind,
    )
    for (const kind of kinds) {
      list.push({
        key: `kind:${kind}`,
        name: GROUP_WORDS[kind as RoomKind],
        target: { kind, room: null },
      })
    }
    return list
      .map((conversation) => {
        const here = (messages ?? []).filter(
          (message) => conversationOf(message, myRoom) === conversation.key,
        )
        const unread = here.filter(
          (message) =>
            message.from_room_id !== myRoom &&
            !reads.some((read) => read.message_id === message.id && read.staff_id === staff?.id),
        ).length
        return { ...conversation, last: here[here.length - 1] ?? null, unread }
      })
      .sort(
        (a, b) =>
          (b.last?.created_at ?? '').localeCompare(a.last?.created_at ?? '') ||
          a.name.localeCompare(b.name),
      )
  }, [rooms, messages, reads, myRoom, staff])

  const open = conversations.find((conversation) => conversation.key === chosen) ?? null
  const thread = useMemo(
    () =>
      open && myRoom
        ? (messages ?? []).filter((message) => conversationOf(message, myRoom) === open.key)
        : [],
    [open, messages, myRoom],
  )

  // ===== 4. Opening a conversation marks it read =====
  useEffect(() => {
    if (!client || !staff || !myRoom || thread.length === 0) return
    const unread = thread
      .filter(
        (message) =>
          message.from_room_id !== myRoom &&
          !reads.some((read) => read.message_id === message.id && read.staff_id === staff.id),
      )
      .map((message) => message.id)
    if (unread.length) void markRead(client, unread).then(load)
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [client, staff, myRoom, thread, reads, load])

  if (auth.status !== 'ready' || !client || !staff) return null

  // ===== 5. Ticks for my own messages =====
  function ticks(message: Message): 1 | 2 {
    const readers = reads.filter(
      (read) => read.message_id === message.id && read.staff_id !== message.sent_by,
    )
    if (message.to_room_id) return readers.length > 0 ? 2 : 1
    // A group: everybody now in a room of that kind has read it.
    const groupRooms = rooms.filter((room) => room.kind === message.to_kind).map((room) => room.id)
    const people = roomStaff.filter((person) => groupRooms.includes(person.room_id))
    return people.length > 0 &&
      people.every((person) => readers.some((read) => read.staff_id === person.id))
      ? 2
      : 1
  }

  async function send() {
    if (!client || !staff || !open || !typed.trim()) return
    setBusy(true)
    setProblem(null)
    const answer = await sendMessage(client, staff.id, open.target, typed)
    setBusy(false)
    if (answer && answer !== 'waiting') {
      setProblem(answer)
      return
    }
    setTyped('')
    await load()
  }

  if (!myRoom) {
    return (
      <AppShell>
        <div className={styles.page}>
          <h2>Messages</h2>
          <p className={styles.muted}>
            Messages go from room to room. Ask your administrator to give you a room, then come
            back.
          </p>
        </div>
      </AppShell>
    )
  }

  const shownWaiting = open ? waiting.filter((item) => item.target === open.key) : []

  return (
    <AppShell>
      <div className={`${styles.page} ${open ? styles.reading : ''}`}>
        {/* ===== 6. The rooms and groups ===== */}
        <section className={styles.list} aria-label="Rooms">
          <h2>Messages</h2>
          <p className={styles.muted}>From {staff.room?.name ?? 'your room'}</p>
          {conversations.map((conversation) => (
            <button
              key={conversation.key}
              className={styles.row}
              aria-current={conversation.key === chosen ? 'true' : undefined}
              onClick={() => router.replace(`/messages/?c=${conversation.key}`, { scroll: false })}
            >
              <span>
                <b>{conversation.name}</b>
                <small>{conversation.last ? conversation.last.body : 'No messages yet'}</small>
              </span>
              {conversation.unread ? (
                <em className={styles.unread}>{conversation.unread}</em>
              ) : null}
            </button>
          ))}
        </section>

        {/* ===== 7. The conversation ===== */}
        <section className={styles.thread} aria-label="Conversation">
          {open ? (
            <>
              <div className={styles.threadTop}>
                <button
                  className={styles.back}
                  onClick={() => router.replace('/messages/')}
                  aria-label="Back to rooms"
                >
                  ‹
                </button>
                <b>{open.name}</b>
              </div>
              <div className={styles.bubbles}>
                {thread.length === 0 && shownWaiting.length === 0 ? (
                  <p className={styles.muted}>No messages yet. Write the first one below.</p>
                ) : null}
                {thread.map((message) => {
                  const mine = message.from_room_id === myRoom
                  return (
                    <div key={message.id} className={`${styles.bubble} ${mine ? styles.mine : ''}`}>
                      <p>{message.body}</p>
                      <small>
                        {message.sender?.full_name ?? 'Staff'}
                        {!mine && !message.to_room_id
                          ? ` · to ${GROUP_WORDS[message.to_kind]}`
                          : ''}{' '}
                        · {time(message.created_at)}
                        {mine ? (
                          <span
                            className={ticks(message) === 2 ? styles.read : styles.sent}
                            aria-label={ticks(message) === 2 ? 'Read' : 'Sent'}
                          >
                            {ticks(message) === 2 ? ' ✓✓' : ' ✓'}
                          </span>
                        ) : null}
                      </small>
                    </div>
                  )
                })}
                {shownWaiting.map((item) => (
                  <div
                    key={item.key}
                    className={`${styles.bubble} ${styles.mine} ${styles.pending}`}
                  >
                    <p>{item.body}</p>
                    <small>
                      Waiting for the network <span aria-label="Waiting">🕓</span>
                    </small>
                  </div>
                ))}
                <div ref={bottom} />
              </div>
              {problem ? <p className={styles.error}>{problem}</p> : null}
              <div className={styles.compose}>
                <textarea
                  aria-label={`Message to ${open.name}`}
                  placeholder="Type a message"
                  maxLength={2000}
                  rows={2}
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      void send()
                    }
                  }}
                />
                <button className={styles.send} onClick={send} disabled={busy || !typed.trim()}>
                  {busy ? 'Sending…' : 'Send'}
                </button>
              </div>
            </>
          ) : (
            <p className={styles.muted}>Choose a room to see its messages.</p>
          )}
        </section>
      </div>
    </AppShell>
  )
}

export default function MessagesPage() {
  return (
    <Suspense fallback={null}>
      <Messages />
    </Suspense>
  )
}
