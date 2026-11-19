// Campfire — real-time community rooms powered by the Nexconn Chat SDK.
// Entry for the Nexconn Build Challenge 2026, Social & Community track.

import './styles.css';
import { PERSONAS, ROOMS, personaById, roomById } from './data';
import type { Persona } from './data';
import { DemoTransport } from './demo-transport';
import { NexconnTransport } from './nexconn-transport';
import { loadConfig } from './types';
import type {
  ChannelRef,
  ChannelSummary,
  ChatMessage,
  ChatTransport,
  ConnectionStatus,
} from './types';

const REACTIONS = ['👍', '❤️', '😂', '🎉'];
const config = loadConfig();
const liveMode = Boolean(config.appKey && config.tokenServerUrl);

const app = document.getElementById('app')!;

let transport: ChatTransport;
let me: Persona | null = null;
let channels: ChannelSummary[] = [];
let active: ChannelRef | null = null;
let messages: ChatMessage[] = []; // ascending display order, includes poll-vote messages
let votes = new Map<string, Map<string, number>>(); // pollId -> userId -> optionIndex
let typingByChannel = new Map<string, Map<string, number>>(); // channelKey -> userId -> expiry
let status: ConnectionStatus = 'disconnected';
let statusDetail = '';
let hasMoreHistory = false;
let pollComposerOpen = false;

const key = (ref: ChannelRef) => `${ref.kind}:${ref.id}`;
const sameChannel = (a: ChannelRef, b: ChannelRef) => a.kind === b.kind && a.id === b.id;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return sameDay ? time : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}

function fmtListTime(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  if (d.toDateString() === new Date().toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function avatar(p: Persona, size = 36): string {
  return `<span class="avatar" style="--sz:${size}px;background:${p.color}">${esc(initials(p.name))}</span>`;
}

/* ---------------- gate (persona picker) ---------------- */

function renderGate(): void {
  app.innerHTML = `
  <div class="gate">
    <div class="gate-card">
      <div class="brand-big">🔥 Campfire</div>
      <p class="tagline">Real-time community rooms where the chat runs the show —
      live polls, reactions and typing presence, powered by the <strong>Nexconn Chat SDK</strong>.</p>
      <div class="mode-banner ${liveMode ? 'live' : 'demo'}">
        ${liveMode
          ? '🟢 <strong>Live mode</strong> — connected to Nexconn cloud chat via your App Key.'
          : '🟡 <strong>Demo mode</strong> — no Nexconn keys configured, so Campfire runs on a local demo transport (open two tabs as different people to chat live). Add your App Key + token server in <code>config.js</code> to go live on the real SDK.'}
      </div>
      <h2>Pick your seat by the fire</h2>
      <div class="persona-grid">
        ${PERSONAS.map((p) => `
          <button class="persona-card" data-persona="${p.id}">
            ${avatar(p, 44)}
            <span class="persona-name">${esc(p.name)}</span>
            <span class="persona-role">${esc(p.role)}</span>
          </button>`).join('')}
      </div>
      <p class="gate-foot">Nexconn Build Challenge 2026 · Social &amp; Community track · Built by @dunoil</p>
    </div>
  </div>`;
  app.querySelectorAll('[data-persona]').forEach((el) => {
    el.addEventListener('click', () => {
      const p = personaById((el as HTMLElement).dataset.persona!);
      void enterAs(p);
    });
  });
}

async function enterAs(p: Persona): Promise<void> {
  me = p;
  transport = liveMode ? new NexconnTransport(config) : new DemoTransport();
  renderShell();
  try {
    await transport.connect(p, {
      onConnection: (s, detail) => {
        status = s;
        statusDetail = detail ?? '';
        renderStatus();
      },
      onMessage: (m) => handleIncoming(m),
      onChannelsChanged: () => void refreshChannels(),
      onTyping: (ref, userIds) => handleTyping(ref, userIds),
      onMessageUpdated: (m) => handleUpdated(m),
    });
    await refreshChannels();
    const first = channels.find((c) => c.kind === 'group') ?? channels[0];
    if (first) await selectChannel(first);
  } catch (err) {
    status = 'error';
    statusDetail = (err as Error).message;
    renderStatus();
  }
}

/* ---------------- shell ---------------- */

function renderShell(): void {
  app.innerHTML = `
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">🔥 Campfire</div>
      <div class="me-card">
        ${avatar(me!, 40)}
        <div class="me-meta">
          <div class="me-name">${esc(me!.name)}</div>
          <div class="me-role">${esc(me!.role)}</div>
        </div>
        <button id="switch-btn" class="ghost-btn" title="Switch persona">Switch</button>
      </div>
      <nav id="channel-list" class="channel-list"></nav>
      <div class="side-foot">
        <div id="status-pill" class="status-pill"></div>
        <div class="powered">Powered by <strong>Nexconn Chat SDK</strong></div>
      </div>
    </aside>
    <main class="main">
      <header id="chat-header" class="chat-header"></header>
      <div id="stream" class="stream"></div>
      <div id="typing-line" class="typing-line"></div>
      <div id="composer-zone"></div>
    </main>
    <aside id="details" class="details"></aside>
  </div>`;
  document.getElementById('switch-btn')!.addEventListener('click', async () => {
    await transport.disconnect();
    me = null;
    active = null;
    messages = [];
    votes = new Map();
    renderGate();
  });
  renderStatus();
  renderComposer();
}

function renderStatus(): void {
  const pill = document.getElementById('status-pill');
  if (!pill) return;
  const label: Record<ConnectionStatus, string> = {
    connecting: 'Connecting…',
    connected: liveMode ? 'Live on Nexconn' : 'Demo mode (local)',
    disconnected: 'Disconnected',
    error: 'Connection issue',
  };
  pill.innerHTML = `<span class="dot ${status}"></span> ${label[status]}${
    statusDetail ? `<div class="status-detail">${esc(statusDetail)}</div>` : ''
  }`;
}

async function refreshChannels(): Promise<void> {
  if (!transport) return;
  channels = await transport.listChannels();
  renderChannelList();
}

function renderChannelList(): void {
  const nav = document.getElementById('channel-list');
  if (!nav) return;
  const groups = channels.filter((c) => c.kind === 'group');
  const dms = channels.filter((c) => c.kind === 'direct');
  const item = (c: ChannelSummary) => {
    const isActive = active && sameChannel(active, c);
    const p = c.kind === 'direct' ? personaById(c.id) : null;
    const room = c.kind === 'group' ? roomById(c.id) : null;
    return `
    <button class="chan ${isActive ? 'active' : ''}" data-kind="${c.kind}" data-id="${esc(c.id)}">
      ${p ? avatar(p, 34) : `<span class="avatar room-avatar" style="--sz:34px">${room?.emoji ?? '#'}</span>`}
      <span class="chan-meta">
        <span class="chan-top"><span class="chan-name">${esc(c.title)}</span><span class="chan-time">${fmtListTime(c.lastTime)}</span></span>
        <span class="chan-last">${esc(c.lastText || c.subtitle)}</span>
      </span>
      ${c.unread ? `<span class="badge">${c.unread}</span>` : ''}
    </button>`;
  };
  nav.innerHTML = `
    <div class="nav-section">Rooms</div>
    ${groups.map(item).join('')}
    <div class="nav-section">Direct messages</div>
    ${dms.map(item).join('')}`;
  nav.querySelectorAll('[data-kind]').forEach((el) => {
    el.addEventListener('click', () => {
      const e = el as HTMLElement;
      void selectChannel({ kind: e.dataset.kind as ChannelRef['kind'], id: e.dataset.id! });
    });
  });
}

/* ---------------- channel view ---------------- */

async function selectChannel(ref: ChannelRef): Promise<void> {
  active = ref;
  votes = new Map();
  renderChannelList();
  renderHeader();
  renderDetails();
  await transport.markRead(ref);
  const page = await transport.getHistory(ref, Date.now() + 1);
  messages = [...page].reverse(); // to ascending
  hasMoreHistory = page.length >= 40;
  rebuildVotes();
  renderStream(true);
  void refreshChannels();
}

function rebuildVotes(): void {
  votes = new Map();
  for (const m of messages) {
    if (m.type === 'poll-vote' && m.vote) applyVote(m.vote.pollId, m.senderId, m.vote.optionIndex);
  }
}

function applyVote(pollId: string, userId: string, optionIndex: number): void {
  let tally = votes.get(pollId);
  if (!tally) votes.set(pollId, (tally = new Map()));
  tally.set(userId, optionIndex);
}

function renderHeader(): void {
  const header = document.getElementById('chat-header');
  if (!header || !active) return;
  if (active.kind === 'group') {
    const room = roomById(active.id);
    header.innerHTML = `
      <div class="header-title"><span class="header-emoji">${room?.emoji ?? '#'}</span>
        <div><div class="header-name">${esc(room?.name ?? active.id)}</div>
        <div class="header-sub">${esc(room?.topic ?? '')}</div></div>
      </div>
      <div class="header-members">${PERSONAS.length} members</div>`;
  } else {
    const p = personaById(active.id);
    header.innerHTML = `
      <div class="header-title">${avatar(p, 38)}
        <div><div class="header-name">${esc(p.name)}</div>
        <div class="header-sub">${esc(p.role)}</div></div>
      </div>`;
  }
}

function renderDetails(): void {
  const el = document.getElementById('details');
  if (!el || !active) return;
  if (active.kind === 'group') {
    const room = roomById(active.id);
    el.innerHTML = `
      <h3>About this room</h3>
      <p>${esc(room?.topic ?? '')}</p>
      <h3>Members</h3>
      <ul class="member-list">
        ${PERSONAS.map((p) => `<li>${avatar(p, 28)}<span>${esc(p.name)}</span><em>${esc(p.role)}</em></li>`).join('')}
      </ul>
      <div class="sdk-note">This room is a <strong>Nexconn group channel</strong>. Polls are Nexconn
      <strong>custom messages</strong>; votes travel as their own custom message type so every
      client tallies the same result in real time.</div>`;
  } else {
    const p = personaById(active.id);
    el.innerHTML = `
      <h3>Direct message</h3>
      <p>You and ${esc(p.name)} — a <strong>Nexconn direct channel</strong>. Messages, reactions
      and typing presence work here exactly as in the group rooms.</p>
      <div class="sdk-note">Direct channels need no setup in Nexconn: a channel exists as soon
      as the first message is sent to a user ID.</div>`;
  }
}

/* ---------------- messages ---------------- */

function pollHtml(m: ChatMessage): string {
  const tally = votes.get(m.id) ?? new Map<string, number>();
  const counts = m.poll!.options.map((_, i) => [...tally.values()].filter((v) => v === i).length);
  const total = counts.reduce((a, b) => a + b, 0);
  const myVote = tally.get(me!.id);
  return `
  <div class="poll-card">
    <div class="poll-q">📊 ${esc(m.poll!.question)}</div>
    ${m.poll!.options.map((opt, i) => {
      const pct = total ? Math.round((counts[i] / total) * 100) : 0;
      return `
      <button class="poll-opt ${myVote === i ? 'mine' : ''}" data-vote="${m.id}:${i}">
        <span class="poll-bar" style="width:${pct}%"></span>
        <span class="poll-opt-label">${esc(opt)}</span>
        <span class="poll-opt-count">${counts[i]} · ${pct}%</span>
      </button>`;
    }).join('')}
    <div class="poll-foot">${total} vote${total === 1 ? '' : 's'} · tap to vote, tap again to change</div>
  </div>`;
}

function messageHtml(m: ChatMessage): string {
  const p = personaById(m.senderId);
  const reactions = m.reactions
    .filter((r) => r.userIds.length)
    .map((r) => `<button class="chip ${r.mine ? 'mine' : ''}" data-react="${m.id}:${r.reactionId}">${r.reactionId} ${r.userIds.length}</button>`)
    .join('');
  return `
  <div class="msg ${m.mine ? 'mine' : ''}" data-msg="${m.id}">
    ${avatar(p, 34)}
    <div class="msg-body">
      <div class="msg-head"><span class="msg-name">${esc(p.name)}</span><span class="msg-time">${fmtTime(m.sentTime)}</span></div>
      ${m.type === 'poll' ? pollHtml(m) : `<div class="bubble">${esc(m.text ?? '')}</div>`}
      ${reactions ? `<div class="chips">${reactions}</div>` : ''}
      <div class="msg-actions">
        ${REACTIONS.map((r) => `<button data-react="${m.id}:${r}" title="React ${r}">${r}</button>`).join('')}
      </div>
    </div>
  </div>`;
}

function renderStream(scrollToBottom = false): void {
  const stream = document.getElementById('stream');
  if (!stream) return;
  const visible = messages.filter((m) => m.type !== 'poll-vote');
  stream.innerHTML =
    (hasMoreHistory ? `<button id="load-older" class="load-older">Load older messages</button>` : '') +
    (visible.length
      ? visible.map(messageHtml).join('')
      : `<div class="empty">No messages yet — start the conversation 👋</div>`);
  stream.querySelectorAll('[data-vote]').forEach((el) => {
    el.addEventListener('click', () => {
      const [pollId, idx] = (el as HTMLElement).dataset.vote!.split(':');
      void castVote(pollId, Number(idx));
    });
  });
  stream.querySelectorAll('[data-react]').forEach((el) => {
    el.addEventListener('click', () => {
      const [msgId, reactionId] = (el as HTMLElement).dataset.react!.split(':');
      const msg = messages.find((m) => m.id === msgId);
      if (msg) void transport.toggleReaction(msg, reactionId);
    });
  });
  const older = document.getElementById('load-older');
  older?.addEventListener('click', () => void loadOlder());
  if (scrollToBottom) stream.scrollTop = stream.scrollHeight;
}

async function loadOlder(): Promise<void> {
  if (!active || !messages.length) return;
  const oldest = messages[0].sentTime;
  const page = await transport.getHistory(active, oldest);
  hasMoreHistory = page.length >= 40;
  const fresh = [...page].reverse();
  messages = [...fresh, ...messages];
  rebuildVotes();
  const stream = document.getElementById('stream');
  const prevHeight = stream?.scrollHeight ?? 0;
  renderStream(false);
  if (stream) stream.scrollTop = stream.scrollHeight - prevHeight;
}

async function castVote(pollId: string, optionIndex: number): Promise<void> {
  if (!active || !me) return;
  applyVote(pollId, me.id, optionIndex);
  renderStream(false);
  await transport.vote(active, pollId, optionIndex);
}

/* ---------------- incoming events ---------------- */

function normalizeIncoming(m: ChatMessage): ChatMessage {
  // In demo mode a DM message's channel id is written from the sender's
  // point of view; re-point it at the partner from *my* point of view.
  if (m.channel.kind === 'direct' && me) {
    const partner = m.senderId === me.id ? m.channel.id : m.senderId;
    return { ...m, channel: { kind: 'direct', id: partner } };
  }
  return m;
}

function handleIncoming(raw: ChatMessage): void {
  const m = normalizeIncoming(raw);
  if (active && sameChannel(active, m.channel)) {
    if (messages.some((x) => x.id === m.id)) return;
    messages.push(m);
    if (m.type === 'poll-vote' && m.vote) {
      applyVote(m.vote.pollId, m.senderId, m.vote.optionIndex);
      renderStream(false);
    } else {
      renderStream(true);
    }
    if (!m.mine) void transport.markRead(m.channel);
  }
  void refreshChannels();
}

function handleUpdated(m: ChatMessage): void {
  const idx = messages.findIndex((x) => x.id === m.id);
  if (idx >= 0) {
    messages[idx] = { ...messages[idx], reactions: m.reactions };
    const stream = document.getElementById('stream');
    const top = stream?.scrollTop ?? 0;
    renderStream(false);
    if (stream) stream.scrollTop = top;
  }
  void refreshChannels();
}

function handleTyping(ref: ChannelRef, userIds: string[]): void {
  const k = key(ref);
  const now = Date.now();
  if (userIds.length === 0) {
    typingByChannel.delete(k);
  } else {
    const set = typingByChannel.get(k) ?? new Map<string, number>();
    for (const id of userIds) set.set(id, now + 4500);
    typingByChannel.set(k, set);
  }
  renderTyping();
}

function renderTyping(): void {
  const line = document.getElementById('typing-line');
  if (!line || !active) return;
  const set = typingByChannel.get(key(active));
  const now = Date.now();
  const names = set
    ? [...set.entries()].filter(([, exp]) => exp > now).map(([id]) => personaById(id).name.split(' ')[0])
    : [];
  line.textContent = names.length ? `${names.join(', ')} ${names.length > 1 ? 'are' : 'is'} typing…` : '';
  if (names.length) {
    window.setTimeout(renderTyping, 4600);
  }
}

/* ---------------- composer ---------------- */

function renderComposer(): void {
  const zone = document.getElementById('composer-zone');
  if (!zone) return;
  zone.innerHTML = `
  <div class="composer">
    <button id="poll-btn" class="tool-btn" title="Create a poll">📊</button>
    <textarea id="composer-input" rows="1" placeholder="Message… (Enter to send)"></textarea>
    <button id="send-btn" class="send-btn">Send</button>
  </div>
  <div id="poll-composer" class="poll-composer" hidden>
    <input id="poll-q" type="text" placeholder="Poll question — e.g. Where should we meet on Saturday?" />
    <div class="poll-opts">
      <input class="poll-opt-input" type="text" placeholder="Option 1" />
      <input class="poll-opt-input" type="text" placeholder="Option 2" />
      <input class="poll-opt-input" type="text" placeholder="Option 3 (optional)" />
      <input class="poll-opt-input" type="text" placeholder="Option 4 (optional)" />
    </div>
    <div class="poll-actions">
      <button id="poll-cancel" class="ghost-btn">Cancel</button>
      <button id="poll-create" class="send-btn">Post poll</button>
    </div>
  </div>`;
  const input = document.getElementById('composer-input') as HTMLTextAreaElement;
  let lastTyping = 0;
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
    const now = Date.now();
    if (active && now - lastTyping > 3000) {
      lastTyping = now;
      transport.sendTyping(active);
    }
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendCurrent();
    }
  });
  document.getElementById('send-btn')!.addEventListener('click', () => void sendCurrent());
  document.getElementById('poll-btn')!.addEventListener('click', () => {
    pollComposerOpen = !pollComposerOpen;
    (document.getElementById('poll-composer') as HTMLElement).hidden = !pollComposerOpen;
  });
  document.getElementById('poll-cancel')!.addEventListener('click', () => {
    pollComposerOpen = false;
    (document.getElementById('poll-composer') as HTMLElement).hidden = true;
  });
  document.getElementById('poll-create')!.addEventListener('click', () => void createPollFromComposer());
}

async function sendCurrent(): Promise<void> {
  const input = document.getElementById('composer-input') as HTMLTextAreaElement;
  const text = input.value.trim();
  if (!text || !active) return;
  input.value = '';
  input.style.height = 'auto';
  try {
    const sent = await transport.sendText(active, text);
    if (!messages.some((m) => m.id === sent.id)) {
      messages.push(sent);
      renderStream(true);
    }
    void refreshChannels();
  } catch (err) {
    status = 'error';
    statusDetail = (err as Error).message;
    renderStatus();
  }
}

async function createPollFromComposer(): Promise<void> {
  if (!active) return;
  const q = (document.getElementById('poll-q') as HTMLInputElement).value.trim();
  const options = [...document.querySelectorAll<HTMLInputElement>('.poll-opt-input')]
    .map((i) => i.value.trim())
    .filter(Boolean);
  if (!q || options.length < 2) return;
  const sent = await transport.createPoll(active, q, options);
  if (!messages.some((m) => m.id === sent.id)) {
    messages.push(sent);
    renderStream(true);
  }
  pollComposerOpen = false;
  (document.getElementById('poll-composer') as HTMLElement).hidden = true;
  void refreshChannels();
}

/* ---------------- boot ---------------- */
void ROOMS; // rooms are surfaced through the transports' channel lists
renderGate();
