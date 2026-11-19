// Local demo transport: the same Campfire experience with zero accounts.
// Messages live in localStorage and sync between open tabs of this browser
// via BroadcastChannel, so two tabs signed in as different personas chat in
// real time. Friendly scripted neighbours keep a single-tab session lively.
//
// This transport exists so the app (and its demo video) is fully runnable
// from static hosting before any Nexconn keys exist. Set an App Key and a
// token server URL in config.js and the app uses the real Nexconn SDK
// instead, the UI code does not change.

import { PERSONAS, ROOMS, personaById, roomById } from './data';
import type { Persona } from './data';
import type {
  ChannelRef,
  ChannelSummary,
  ChatMessage,
  ChatTransport,
  ReactionSummary,
  TransportEvents,
} from './types';

const STORE_KEY = 'campfire.demo.messages.v1';
const BUS_NAME = 'campfire-demo-bus-v1';

type Store = Record<string, ChatMessage[]>;

const BOT_LINES: Record<string, string[]> = {
  'campfire-general': [
    'Welcome to the circle! 🔥 Grab a seat.',
    'Morning all, coffee is on, what is everyone working on today?',
    'That sounds great. Share a photo when you can!',
    'Ha! Classic. This is why I love this group.',
  ],
  'show-and-tell': [
    'Oh that is lovely work 👏',
    'The colours on this are gorgeous.',
    'How long did this one take you?',
    'Instant favourite. Thanks for sharing!',
  ],
  'help-circle': [
    'I can help with that this evening, ping me directly.',
    'Had the same issue last month; happy to walk you through it.',
    'Between us we will figure it out 💪',
  ],
  'weekend-plans': [
    'I am in! 🙋',
    'Saturday works better for me, but I can flex.',
    'Vote cast, the people have spoken.',
  ],
  direct: [
    'Hey! Good to hear from you 😊',
    'Sure thing, let us sort it in the group room too.',
    'Sounds like a plan!',
  ],
};

function channelKey(ref: ChannelRef): string {
  return `${ref.kind}:${ref.id}`;
}

function dmKey(a: string, b: string): string {
  return `direct:${[a, b].sort().join('__')}`;
}

export class DemoTransport implements ChatTransport {
  readonly mode = 'demo' as const;
  private me!: Persona;
  private events!: TransportEvents;
  private bus: BroadcastChannel | null = null;
  private unread = new Map<string, number>();
  private botTimers: number[] = [];

  // ---------- storage ----------
  private load(): Store {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw) as Store;
    } catch { /* corrupted storage, reseed */ }
    const seeded = this.seed();
    localStorage.setItem(STORE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  private save(store: Store): void {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  }

  private seed(): Store {
    const now = Date.now();
    const t = (minsAgo: number) => now - minsAgo * 60_000;
    let n = 0;
    const msg = (
      channel: ChannelRef,
      senderId: string,
      sentTime: number,
      partial: Partial<ChatMessage>,
    ): ChatMessage => ({
      id: `seed-${++n}`,
      channel,
      senderId,
      sentTime,
      type: 'text',
      reactions: [],
      mine: false,
      ...partial,
    });
    const general: ChannelRef = { kind: 'group', id: 'campfire-general' };
    const showTell: ChannelRef = { kind: 'group', id: 'show-and-tell' };
    const help: ChannelRef = { kind: 'group', id: 'help-circle' };
    const weekend: ChannelRef = { kind: 'group', id: 'weekend-plans' };
    const pollId = 'seed-poll-1';
    const store: Store = {
      [channelKey(general)]: [
        msg(general, 'ava', t(180), { text: 'Welcome to Campfire, everyone! This is our main circle, intros, ideas, and the occasional poll.' }),
        msg(general, 'ben', t(172), { text: 'Ben here 📸 I shoot film around the neighbourhood. Say hi if you spot me with the old Leica.' }),
        msg(general, 'chen', t(165), { text: 'Chen, indie game dev. Currently building a tiny co-op fishing game 🎣' }),
        msg(general, 'dina', t(158), { text: 'Dina! I run the plant swap, bring a cutting, take a cutting 🌱' }),
        msg(general, 'ava', t(120), {
          id: pollId,
          type: 'poll',
          poll: { question: 'What should our next community night be?', options: ['Board games', 'Outdoor film screening', 'Cooking swap', 'Live music jam'] },
        }),
        msg(general, 'ben', t(119), { type: 'poll-vote', vote: { pollId, optionIndex: 1 } }),
        msg(general, 'chen', t(118), { type: 'poll-vote', vote: { pollId, optionIndex: 0 } }),
        msg(general, 'dina', t(117), { type: 'poll-vote', vote: { pollId, optionIndex: 1 } }),
        msg(general, 'ben', t(60), { text: 'Film screening under the stars would be magic ✨' }),
      ],
      [channelKey(showTell)]: [
        msg(showTell, 'chen', t(240), { text: 'WIP Wednesday: the fishing game now has weather. Rain makes the fish bolder, apparently.' }),
        msg(showTell, 'ava', t(235), { text: 'The little splash particles are adorable. Ship it!' }),
        msg(showTell, 'ben', t(90), { text: 'Developed last weekend\'s roll, the market at golden hour never misses.' }),
      ],
      [channelKey(help)]: [
        msg(help, 'dina', t(300), { text: 'Does anyone have a ladder I could borrow on Saturday? Picture-hanging mission.' }),
        msg(help, 'ben', t(295), { text: 'I do! Will drop it by yours on Friday evening.' }),
        msg(help, 'dina', t(294), { text: 'You are a star, thank you 🙏' }),
      ],
      [channelKey(weekend)]: [
        msg(weekend, 'ava', t(140), { text: 'Weekend planning thread! I am thinking a riverside walk then the makers market.' }),
        msg(weekend, 'chen', t(132), { text: 'In. I will bring the card game that ruined friendships last time.' }),
      ],
    };
    // A welcome DM thread between Ava and whoever opens the app is created
    // lazily per persona pair; seed one for ava<->ben as an example.
    store[dmKey('ava', 'ben')] = [
      msg({ kind: 'direct', id: 'ben' }, 'ava', t(400), { text: 'Ben, could you take photos at the next community night?' }),
      msg({ kind: 'direct', id: 'ava' }, 'ben', t(398), { text: 'Of course, film or digital?' }),
    ];
    return store;
  }

  // ---------- lifecycle ----------
  async connect(persona: Persona, events: TransportEvents): Promise<void> {
    this.me = persona;
    this.events = events;
    events.onConnection('connecting');
    this.load(); // ensure seeded
    if ('BroadcastChannel' in window) {
      this.bus = new BroadcastChannel(BUS_NAME);
      this.bus.onmessage = (ev) => this.onBusMessage(ev.data as BusEvent);
    }
    window.addEventListener('storage', this.onStorage);
    await new Promise((r) => setTimeout(r, 350));
    events.onConnection('connected');
    events.onChannelsChanged();
  }

  async disconnect(): Promise<void> {
    this.bus?.close();
    this.bus = null;
    window.removeEventListener('storage', this.onStorage);
    this.botTimers.forEach((t) => window.clearTimeout(t));
    this.botTimers = [];
    this.events.onConnection('disconnected');
  }

  // ---------- cross-tab sync ----------
  private onStorage = (e: StorageEvent): void => {
    if (e.key === STORE_KEY) this.events.onChannelsChanged();
  };

  private onBusMessage(data: BusEvent): void {
    if (!data || data.from === this.me.id) {
      if (data?.kind === 'typing' && data.from !== this.me.id) {
        this.events.onTyping(data.channel, [data.from]);
      }
      return;
    }
    if (data.kind === 'message') {
      const m = data.message;
      m.mine = m.senderId === this.me.id;
      this.events.onMessage(m);
      this.bumpUnread(m);
      this.events.onChannelsChanged();
    } else if (data.kind === 'typing') {
      this.events.onTyping(data.channel, [data.from]);
    } else if (data.kind === 'reaction') {
      this.events.onMessageUpdated(data.message);
      this.events.onChannelsChanged();
    }
  }

  private bumpUnread(m: ChatMessage): void {
    const k = this.storeKeyFor(m.channel, m.senderId);
    this.unread.set(k, (this.unread.get(k) ?? 0) + 1);
  }

  /** Storage key for a channel as seen by the current user. */
  private storeKeyFor(ref: ChannelRef, otherHint?: string): string {
    if (ref.kind === 'group') return channelKey(ref);
    const other = ref.id === this.me.id && otherHint ? otherHint : ref.id;
    return dmKey(this.me.id, other);
  }

  private appendMessage(m: ChatMessage): void {
    const store = this.load();
    const k = this.storeKeyFor(m.channel, m.senderId);
    const list = store[k] ?? (store[k] = []);
    if (!list.some((x) => x.id === m.id)) list.push(m);
    this.save(store);
  }

  // ---------- ChatTransport ----------
  async listChannels(): Promise<ChannelSummary[]> {
    const store = this.load();
    const out: ChannelSummary[] = [];
    for (const room of ROOMS) {
      const list = store[channelKey({ kind: 'group', id: room.id })] ?? [];
      const last = [...list].reverse().find((m) => m.type !== 'poll-vote');
      out.push({
        kind: 'group',
        id: room.id,
        title: room.name,
        subtitle: room.topic,
        lastText: last ? preview(last) : '',
        lastTime: last?.sentTime ?? 0,
        unread: this.unread.get(channelKey({ kind: 'group', id: room.id })) ?? 0,
      });
    }
    for (const p of PERSONAS) {
      if (p.id === this.me.id) continue;
      const list = store[dmKey(this.me.id, p.id)] ?? [];
      const last = [...list].reverse().find((m) => m.type !== 'poll-vote');
      out.push({
        kind: 'direct',
        id: p.id,
        title: p.name,
        subtitle: p.role,
        lastText: last ? preview(last) : '',
        lastTime: last?.sentTime ?? 0,
        unread: this.unread.get(dmKey(this.me.id, p.id)) ?? 0,
      });
    }
    return out;
  }

  async getHistory(channel: ChannelRef, beforeTime: number): Promise<ChatMessage[]> {
    const store = this.load();
    const list = store[this.storeKeyFor(channel)] ?? [];
    return list
      .filter((m) => m.sentTime < beforeTime)
      .slice(-40)
      .reverse()
      .map((m) => ({ ...m, mine: m.senderId === this.me.id }));
  }

  private newMessage(channel: ChannelRef, partial: Partial<ChatMessage>): ChatMessage {
    return {
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      channel,
      senderId: this.me.id,
      sentTime: Date.now(),
      type: 'text',
      reactions: [],
      mine: true,
      ...partial,
    };
  }

  private publish(m: ChatMessage): ChatMessage {
    this.appendMessage(m);
    this.bus?.postMessage({ kind: 'message', from: this.me.id, message: m } satisfies BusEvent);
    this.events.onChannelsChanged();
    return m;
  }

  async sendText(channel: ChannelRef, text: string): Promise<ChatMessage> {
    const m = this.publish(this.newMessage(channel, { type: 'text', text }));
    this.scheduleBotReply(channel);
    return m;
  }

  async createPoll(channel: ChannelRef, question: string, options: string[]): Promise<ChatMessage> {
    const m = this.publish(this.newMessage(channel, { type: 'poll', poll: { question, options } }));
    this.scheduleBotVotes(channel, m.id);
    return m;
  }

  async vote(channel: ChannelRef, pollId: string, optionIndex: number): Promise<void> {
    const m = this.newMessage(channel, { type: 'poll-vote', vote: { pollId, optionIndex } });
    this.publish(m);
  }

  async toggleReaction(msg: ChatMessage, reactionId: string): Promise<void> {
    const store = this.load();
    const k = this.storeKeyFor(msg.channel, msg.senderId);
    const list = store[k] ?? [];
    const target = list.find((x) => x.id === msg.id);
    if (!target) return;
    target.reactions = toggle(target.reactions, reactionId, this.me.id);
    this.save(store);
    const updated = { ...target, mine: target.senderId === this.me.id };
    this.bus?.postMessage({ kind: 'reaction', from: this.me.id, message: updated } satisfies BusEvent);
    this.events.onMessageUpdated(updated);
  }

  sendTyping(channel: ChannelRef): void {
    this.bus?.postMessage({ kind: 'typing', from: this.me.id, channel } satisfies BusEvent);
  }

  async markRead(channel: ChannelRef): Promise<void> {
    this.unread.delete(this.storeKeyFor(channel));
  }

  async getMembers(channel: ChannelRef): Promise<Persona[]> {
    if (channel.kind === 'direct') return [this.me, personaById(channel.id)];
    return PERSONAS;
  }

  // ---------- scripted neighbours (single-tab liveliness) ----------
  private scheduleBotReply(channel: ChannelRef): void {
    if (Math.random() > 0.65) return;
    const others = PERSONAS.filter((p) => p.id !== this.me.id);
    const bot = others[Math.floor(Math.random() * others.length)];
    const typingTimer = window.setTimeout(() => {
      this.events.onTyping(channel, [bot.id]);
    }, 700);
    const replyTimer = window.setTimeout(() => {
      this.events.onTyping(channel, []);
      const pool = channel.kind === 'group' ? BOT_LINES[channel.id] ?? BOT_LINES['campfire-general'] : BOT_LINES.direct;
      const text = pool[Math.floor(Math.random() * pool.length)];
      const m: ChatMessage = {
        id: `bot-${Date.now()}`,
        channel,
        senderId: bot.id,
        sentTime: Date.now(),
        type: 'text',
        text,
        reactions: [],
        mine: false,
      };
      this.appendMessage(m);
      this.events.onMessage(m);
      this.bumpUnread(m);
      this.events.onChannelsChanged();
    }, 2200 + Math.random() * 1800);
    this.botTimers.push(typingTimer, replyTimer);
  }

  private scheduleBotVotes(channel: ChannelRef, pollId: string): void {
    const others = PERSONAS.filter((p) => p.id !== this.me.id);
    const voters = others.slice(0, 2 + Math.floor(Math.random() * 2));
    voters.forEach((bot, i) => {
      const timer = window.setTimeout(() => {
        const m: ChatMessage = {
          id: `botvote-${Date.now()}-${bot.id}`,
          channel,
          senderId: bot.id,
          sentTime: Date.now(),
          type: 'poll-vote',
          vote: { pollId, optionIndex: Math.floor(Math.random() * 3) },
          reactions: [],
          mine: false,
        };
        this.appendMessage(m);
        this.events.onMessage(m);
        this.events.onChannelsChanged();
      }, 2500 + i * 2200);
      this.botTimers.push(timer);
    });
  }
}

type BusEvent =
  | { kind: 'message'; from: string; message: ChatMessage }
  | { kind: 'typing'; from: string; channel: ChannelRef }
  | { kind: 'reaction'; from: string; message: ChatMessage };

function preview(m: ChatMessage): string {
  if (m.type === 'poll') return `📊 ${m.poll?.question ?? 'Poll'}`;
  return m.text ?? '';
}

function toggle(reactions: ReactionSummary[], reactionId: string, userId: string): ReactionSummary[] {
  const out = reactions.map((r) => ({ ...r, userIds: [...r.userIds] }));
  const existing = out.find((r) => r.reactionId === reactionId);
  if (existing) {
    if (existing.userIds.includes(userId)) {
      existing.userIds = existing.userIds.filter((u) => u !== userId);
      existing.mine = false;
    } else {
      existing.userIds.push(userId);
      existing.mine = true;
    }
    return out.filter((r) => r.userIds.length > 0);
  }
  out.push({ reactionId, userIds: [userId], mine: true });
  return out;
}
