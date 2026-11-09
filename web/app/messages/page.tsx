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
 *   clock   sending, or waiting for the network (sends by itself); a
 *           message shows the moment Send is tapped (request 143)
 *   one     sent
 *   two     read (for a group: read by everyone in it)
 * Opening a conversation marks its messages read.
 *
 * Added 2026-11-04 (requests 142 and 144):
 *   - General, at the top, is read by everybody in the hospital.
 *   - Every message carries the name of the person who sent it, and a
 *     room sees what its own people send.
 *   - Tap a message (or hold it) for Reply and, on your own message for 15
 *     minutes, Edit. A reply tags the person replied to; typing @ tags
 *     somebody in the conversation by name. A tag reads "For you" to them.
 *   - A changed message shows "edited".
 *
 * Never: show a message to anybody the database does not let read it.
 */
'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import styles from './messages.module.css'
import AppShell from '@/components/shell/AppShell'
import { OUTBOX_CHANGED, readOutbox } from '@/lib/offline/outbox'
import { recall, remember } from '@/lib/cache/memory'
import {
  GROUP_WORDS,
  loadMessages,
  loadReads,
  loadRoomStaff,
  loadRooms,
  markRead,
  canStillEdit,
  editMessage,
  sendMessage,
  type Message,
  type Read,
  type Room,
  type RoomKind,
  type RoomPerson,
  type Target,
} from '@/lib/messages/messages'
import { useRightPage } from '@/lib/auth/routes'
import { onChange } from '@/lib/live/changes'
import { playMessageSound } from '@/lib/live/sound'
import { useAuth } from '@/lib/auth/session'

// ===== 1. Which conversation a message belongs to, for this room =====
// "room:12" is the conversation with room 12; "kind:nursing" is a group.
function conversationOf(message: Message, myRoom: number): string {
  if (message.to_everyone) return 'general'
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

  // The last copy shown, at once, while a fresh one loads (request 145).
  const me = staff?.id
  const [rooms, setRooms] = useState<Room[]>(() => recall(me, 'rooms') ?? [])
  const [roomStaff, setRoomStaff] = useState<RoomPerson[]>(() => recall(me, 'room-staff') ?? [])
  // The message tapped (its Reply and Edit show), the one being answered,
  // the person tagged, and the message being changed.
  const [picked, setPicked] = useState<number | null>(null)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [tagged, setTagged] = useState<RoomPerson | null>(null)
  const [editing, setEditing] = useState<{ id: number; body: string } | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [messages, setMessages] = useState<Message[] | null>(() => recall(me, 'messages'))
  const [reads, setReads] = useState<Read[]>(() => recall(me, 'message-reads') ?? [])
  const [waiting, setWaiting] = useState<{ key: string; body: string; target: string }[]>([])
  const [typed, setTyped] = useState('')
  // Messages shown at once while they go out (request 143), by conversation.
  const [sending, setSending] = useState<{ key: string; body: string; target: string }[]>([])
  const [problem, setProblem] = useState<string | null>(null)
  const bottom = useRef<HTMLDivElement>(null)

  // ===== 2. Load, then every 15 seconds =====
  const load = useCallback(async () => {
    if (!client || !me) return
    const found = await loadMessages(client)
    setMessages(remember(me, 'messages', found))
    setReads(
      remember(
        me,
        'message-reads',
        await loadReads(
          client,
          found.map((message) => message.id),
        ),
      ),
    )
  }, [client, me])

  useEffect(() => {
    if (!client || auth.status !== 'ready') return
    let current = true
    Promise.all([loadRooms(client), loadRoomStaff(client)]).then(([foundRooms, people]) => {
      if (!current) return
      if (me) {
        remember(me, 'rooms', foundRooms)
        remember(me, 'room-staff', people)
      }
      setRooms(foundRooms)
      setRoomStaff(people)
    })
    const first = window.setTimeout(() => void load(), 0)
    const timer = window.setInterval(() => void load(), 15_000)
    // A message sent or read anywhere: fetch at once (request 157).
    const stopListening = onChange(client, 'messages', () => void load())
    return () => {
      stopListening()
      current = false
      window.clearTimeout(first)
      window.clearInterval(timer)
    }
  }, [client, auth.status, load, me])

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
                  target: task.toEveryone
                    ? 'general'
                    : task.toRoom
                      ? `room:${task.toRoom}`
                      : `kind:${task.toKind}`,
                },
              ]
            : [],
        ),
      )
    show()
    window.addEventListener(OUTBOX_CHANGED, show)
    return () => window.removeEventListener(OUTBOX_CHANGED, show)
  }, [staff, messages])

  // ===== 2b. A soft "pom pom" when a message from somebody else arrives =====
  // Anthony, 2026-11-08: "when a message drops and the person is on the
  // chatting screen, you should just say a pop sound." Not for the first
  // load, not for your own room's messages.
  const seen = useRef<Set<number> | null>(null)
  useEffect(() => {
    if (!messages) return
    const ids = new Set(messages.map((message) => message.id))
    if (seen.current) {
      const arrived = messages.some(
        (message) => !seen.current?.has(message.id) && message.from_room_id !== myRoom,
      )
      if (arrived) playMessageSound()
    }
    seen.current = ids
  }, [messages, myRoom])

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
    // General, for everybody in the hospital (request 142).
    list.push({
      key: 'general',
      name: 'General',
      target: { kind: null, room: null, everyone: true },
    })
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
          // General always first, then the newest conversation.
          Number(b.key === 'general') - Number(a.key === 'general') ||
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

  // A message just sent shows at the bottom straight away.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [sending.length])

  if (auth.status !== 'ready' || !client || !staff) return null

  // ===== 5. Ticks for my own messages =====
  function ticks(message: Message): 1 | 2 {
    const readers = reads.filter(
      (read) => read.message_id === message.id && read.staff_id !== message.sent_by,
    )
    if (message.to_room_id) return readers.length > 0 ? 2 : 1
    // A group (or General): everybody now in a room of that kind has read it.
    const groupRooms = rooms
      .filter((room) => message.to_everyone || room.kind === message.to_kind)
      .filter((room) => room.id !== message.from_room_id)
      .map((room) => room.id)
    const people = roomStaff.filter((person) => groupRooms.includes(person.room_id))
    return people.length > 0 &&
      people.every((person) => readers.some((read) => read.staff_id === person.id))
      ? 2
      : 1
  }

  // Shown in the conversation at once, then sent behind. Anthony,
  // 2026-11-04: "when I click send, the message goes and then continues
  // trying to send there, even if there's no network."
  async function send() {
    if (!client || !staff || !open || !typed.trim()) return
    const body = typed
    const shown = { key: crypto.randomUUID(), body: body.trim(), target: open.key }
    // A tag stays only while its @name is still in the message.
    const mention = tagged && body.includes(`@${tagged.full_name}`) ? tagged.id : null
    const answering = replyTo?.id ?? null
    setTyped('')
    setReplyTo(null)
    setTagged(null)
    setProblem(null)
    setSending((now) => [...now, shown])
    const answer = await sendMessage(client, staff.id, open.target, body, {
      replyTo: answering,
      mention,
    })
    if (answer === null) await load()
    // Sent, or kept on the device for the network (it shows with the clock).
    setSending((now) => now.filter((item) => item.key !== shown.key))
    if (answer && answer !== 'waiting') {
      setProblem(answer)
      setTyped((now) => now || body)
    }
  }

  // ===== 5b. Save a changed message =====
  async function saveEdit() {
    if (!client || !editing || !editing.body.trim()) return
    setSavingEdit(true)
    const failed = await editMessage(client, editing.id, editing.body)
    setSavingEdit(false)
    if (failed) {
      setProblem(failed)
      return
    }
    setEditing(null)
    setPicked(null)
    await load()
  }

  // ===== 5c. Who can be tagged here: the people who can read it =====
  function peopleHere(target: Target): RoomPerson[] {
    const rightRooms = rooms
      .filter((room) =>
        target.everyone ? true : target.room ? room.id === target.room : room.kind === target.kind,
      )
      .map((room) => room.id)
    return roomStaff.filter((person) => rightRooms.includes(person.room_id) && person.id !== me)
  }

  if (!myRoom) {
    return (
      <AppShell>
        <div className={styles.page}>
          <h2>Messages</h2>
          <p className={styles.muted}>
            Messages go from room to room, and you have no room yet. Ask your admin to give you one
            in Admin, Staff.
          </p>
        </div>
      </AppShell>
    )
  }

  const shownWaiting = open ? waiting.filter((item) => item.target === open.key) : []
  const shownSending = open ? sending.filter((item) => item.target === open.key) : []
  // While a name is being typed after @: the people it could be. A name can
  // have spaces ("Dr. Ada Obi"), so everything after the last @ counts, and
  // the list goes away once nobody's name starts that way.
  const atWord = /@([^@\n]{0,40})$/.exec(typed)
  const matching =
    open && atWord
      ? peopleHere(open.target)
          .filter((person) => person.full_name.toLowerCase().startsWith(atWord[1].toLowerCase()))
          .slice(0, 6)
      : []
  const typing =
    matching.length && !(tagged && atWord?.[1] === `${tagged.full_name} `)
      ? { people: matching }
      : null

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
                {thread.length === 0 && shownWaiting.length === 0 && shownSending.length === 0 ? (
                  <p className={styles.muted}>No messages yet. Write the first one below.</p>
                ) : null}
                {thread.map((message) => {
                  const mine = message.from_room_id === myRoom
                  const answered = message.reply_to
                    ? (messages ?? []).find((one) => one.id === message.reply_to)
                    : null
                  const forMe = message.mention_staff === staff.id
                  const isPicked = picked === message.id
                  if (editing?.id === message.id) {
                    return (
                      <div key={message.id} className={`${styles.bubble} ${styles.mine}`}>
                        <textarea
                          className={styles.editBox}
                          aria-label="Change your message"
                          maxLength={2000}
                          rows={3}
                          value={editing.body}
                          onChange={(event) =>
                            setEditing({ id: message.id, body: event.target.value })
                          }
                        />
                        <div className={styles.bubbleActions}>
                          <button
                            className={styles.action}
                            disabled={savingEdit || !editing.body.trim()}
                            onClick={saveEdit}
                          >
                            {savingEdit ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            className={styles.action}
                            disabled={savingEdit}
                            onClick={() => setEditing(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div
                      key={message.id}
                      className={`${styles.bubble} ${mine ? styles.mine : ''} ${forMe ? styles.forMe : ''}`}
                    >
                      {/* Tap or hold the message for Reply and Edit. */}
                      <button
                        type="button"
                        className={styles.bubbleTap}
                        aria-expanded={isPicked}
                        aria-label={`Message from ${message.sender?.full_name ?? 'Staff'}`}
                        onClick={() => setPicked(isPicked ? null : message.id)}
                        onContextMenu={(event) => {
                          event.preventDefault()
                          setPicked(message.id)
                        }}
                      >
                        {answered ? (
                          <span className={styles.quote}>
                            {answered.sender?.full_name ?? 'Staff'}: {answered.body}
                          </span>
                        ) : null}
                        {message.mention ? (
                          <span className={styles.tag}>
                            {forMe ? 'For you' : `@${message.mention.full_name}`}
                          </span>
                        ) : null}
                        <p>{message.body}</p>
                        <small>
                          {message.sender?.full_name ?? 'Staff'}
                          {!mine && !message.to_room_id && message.to_kind
                            ? ` · to ${GROUP_WORDS[message.to_kind]}`
                            : ''}{' '}
                          · {time(message.created_at)}
                          {message.edited_at ? ' · edited' : ''}
                          {mine ? (
                            <span
                              className={ticks(message) === 2 ? styles.read : styles.sent}
                              aria-label={ticks(message) === 2 ? 'Read' : 'Sent'}
                            >
                              <TickMark double={ticks(message) === 2} />
                            </span>
                          ) : null}
                        </small>
                      </button>
                      {isPicked ? (
                        <div className={styles.bubbleActions}>
                          <button
                            className={styles.action}
                            onClick={() => {
                              setReplyTo(message)
                              setPicked(null)
                            }}
                          >
                            Reply
                          </button>
                          {canStillEdit(message, staff.id) ? (
                            <button
                              className={styles.action}
                              onClick={() => setEditing({ id: message.id, body: message.body })}
                            >
                              Edit
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
                {shownSending.map((item) => (
                  <div
                    key={item.key}
                    className={`${styles.bubble} ${styles.mine} ${styles.pending}`}
                  >
                    <p>{item.body}</p>
                    <small>
                      Sending <span aria-label="Sending">🕓</span>
                    </small>
                  </div>
                ))}
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
              {/* ----- Replying to a message ----- */}
              {replyTo ? (
                <div className={styles.replyBar}>
                  <span>
                    Replying to <b>{replyTo.sender?.full_name ?? 'Staff'}</b>: {replyTo.body}
                  </span>
                  <button
                    type="button"
                    className={styles.close}
                    aria-label="Do not reply to this message"
                    onClick={() => setReplyTo(null)}
                  >
                    ×
                  </button>
                </div>
              ) : null}
              {/* ----- Typing @ shows the people who can read this conversation ----- */}
              {typing ? (
                <div className={styles.people} role="listbox" aria-label="Tag somebody">
                  {typing.people.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      role="option"
                      aria-selected={false}
                      className={styles.person}
                      onClick={() => {
                        setTyped(typed.replace(/@([^@\n]{0,40})$/, `@${person.full_name} `))
                        setTagged(person)
                      }}
                    >
                      {person.full_name}
                      <small>{rooms.find((room) => room.id === person.room_id)?.name}</small>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className={styles.compose}>
                <textarea
                  aria-label={`Message to ${open.name}`}
                  placeholder="Type a message. Type @ to tag somebody."
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
                <button className={styles.send} onClick={send} disabled={!typed.trim()}>
                  Send
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

// ===== Ticks, drawn like WhatsApp's =====
// Anthony, 2026-11-09: the second tick sits over the first, "stacked...
// just like on WhatsApp", not two ticks side by side. The second tick
// starts inside the first, so its short arm hides behind it.
function TickMark({ double }: { double: boolean }) {
  return (
    <svg
      className={styles.tickMark}
      width={double ? 17 : 12}
      height="11"
      viewBox={double ? '0 0 17 11' : '0 0 12 11'}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1.2 6.2 4.4 9.4 10.8 1.6" />
      {double ? <path d="M7.4 8.3 8.6 9.4 15 1.6" /> : null}
    </svg>
  )
}
