// Live transport: real integration with the Nexconn Chat SDK (@nexconn/chat).
//
// Flow:
//   1. POST {tokenServerUrl}/token { userId, name }  ->  { token }
//      (the token server signs a request to the Nexconn Server API with the
//      App Secret; the secret never reaches the browser)
//   2. NCEngine.initialize({ appKey }) + registerCustomMessages (poll types)
//   3. NCEngine.connect({ token })
//   4. Rooms are Nexconn group channels; DMs are direct channels.
//
// SDK features used: group channels (create/join/members), direct channels,
// text messages, custom messages (polls + votes), message reactions,
// typing status, unread counts, message history queries, read clearing.

import {
  BaseChannel,
  ChannelHandler,
  ConnectionStatusHandler,
  DirectChannel,
  GroupChannel,
  MessageHandler,
  NCEngine,
  SendMessageParams,
  SendTextMessageParams,
} from '@nexconn/chat';
import type { Message as NCMessage } from '@nexconn/chat';
import { PERSONAS, ROOMS, personaById, roomById } from './data';
import type { Persona } from './data';
import type {
  CampfireConfig,
  ChannelRef,
  ChannelSummary,
  ChatMessage,
  ChatTransport,
  ReactionSummary,
  TransportEvents,
} from './types';

export const POLL_MESSAGE_TYPE = 'campfire:poll';
export const VOTE_MESSAGE_TYPE = 'campfire:vote';
const TEXT_MESSAGE_TYPE = 'RC:TxtMsg';

let engineInitialized = false;

function pageItems<T>(res: { data?: unknown }): T[] {
  const page = res.data as { data?: T[] } | T[] | undefined;
  if (Array.isArray(page)) return page;
  return page?.data ?? [];
}

export class NexconnTransport implements ChatTransport {
  readonly mode = 'live' as const;
  private config: CampfireConfig;
  private me!: Persona;
  private events!: TransportEvents;
  private channels = new Map<string, BaseChannel>();

  constructor(config: CampfireConfig) {
    this.config = config;
  }

  private key(ref: ChannelRef): string {
    return `${ref.kind}:${ref.id}`;
  }

  private channelFor(ref: ChannelRef): BaseChannel {
    const k = this.key(ref);
    let ch = this.channels.get(k);
    if (!ch) {
      ch = ref.kind === 'group' ? new GroupChannel(ref.id) : new DirectChannel(ref.id);
      this.channels.set(k, ch);
    }
    return ch;
  }

  private refFromIdentifier(identifier: { channelType: unknown; channelId: string }): ChannelRef | null {
    const t = Number(identifier.channelType);
    if (t === 3) return { kind: 'group', id: identifier.channelId };
    if (t === 1) return { kind: 'direct', id: identifier.channelId };
    return null;
  }

  private toChatMessage(m: NCMessage): ChatMessage | null {
    const ref = this.refFromIdentifier(m.channelIdentifier as never);
    if (!ref) return null;
    const base: ChatMessage = {
      id: m.messageId,
      channel: ref,
      senderId: m.senderUserId,
      sentTime: m.sentTime,
      type: 'text',
      reactions: [],
      mine: m.senderUserId === this.me.id,
    };
    if (m.messageType === TEXT_MESSAGE_TYPE) {
      base.type = 'text';
      base.text = (m.content as { text?: string })?.text ?? '';
      return base;
    }
    if (m.messageType === POLL_MESSAGE_TYPE) {
      const c = m.content as { question?: string; options?: string[] };
      if (!c?.question || !Array.isArray(c.options)) return null;
      base.type = 'poll';
      base.poll = { question: c.question, options: c.options };
      return base;
    }
    if (m.messageType === VOTE_MESSAGE_TYPE) {
      const c = m.content as { pollId?: string; optionIndex?: number };
      if (!c?.pollId || typeof c.optionIndex !== 'number') return null;
      base.type = 'poll-vote';
      base.vote = { pollId: c.pollId, optionIndex: c.optionIndex };
      return base;
    }
    return null; // other SDK message types are not rendered by Campfire
  }

  async connect(persona: Persona, events: TransportEvents): Promise<void> {
    this.me = persona;
    this.events = events;
    events.onConnection('connecting');

    // 1. Get a user token from our token server (App Secret stays server-side).
    let token: string;
    try {
      const resp = await fetch(`${this.config.tokenServerUrl}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: persona.id, name: persona.name }),
      });
      const body = (await resp.json()) as { token?: string; error?: string };
      if (!resp.ok || !body.token) {
        throw new Error(body.error ?? `Token server responded ${resp.status}`);
      }
      token = body.token;
    } catch (err) {
      events.onConnection('error', `Could not reach the token server: ${(err as Error).message}`);
      throw err;
    }

    // 2. Initialize the SDK once per page load.
    if (!engineInitialized) {
      NCEngine.initialize({ appKey: this.config.appKey });
      NCEngine.registerCustomMessages([
        { messageType: POLL_MESSAGE_TYPE, isPersisted: true, isCounted: true },
        { messageType: VOTE_MESSAGE_TYPE, isPersisted: true, isCounted: false },
      ]);
      engineInitialized = true;
    }

    // Registered for lifecycle visibility (drop/reconnect events surface in
    // the console); the UI's connected state is driven by connect()'s result.
    NCEngine.addConnectionStatusHandler('campfire-conn', new ConnectionStatusHandler({
      onConnectionStatusChanged: ({ status, code }) => {
        console.info('[campfire] Nexconn connection status:', status, 'code:', code);
      },
    }));

    NCEngine.addMessageHandler('campfire-msg', new MessageHandler({
      onMessageReceived: ({ messages }) => {
        for (const m of messages) {
          const cm = this.toChatMessage(m);
          if (cm) events.onMessage(cm);
        }
        events.onChannelsChanged();
      },
      onMessageReactionChanged: ({ reactions }) => {
        for (const r of reactions) {
          void this.refreshMessageReactions(r as unknown as { messageId: string });
        }
      },
    }));

    NCEngine.addChannelHandler('campfire-chan', new ChannelHandler({
      onTypingStatusChanged: ({ channelIdentifier, userTypingStatus }) => {
        const ref = this.refFromIdentifier(channelIdentifier as never);
        if (!ref) return;
        const userIds = (userTypingStatus ?? [])
          .map((u) => u.userId)
          .filter((id) => id !== this.me.id);
        events.onTyping(ref, userIds);
      },
    }));

    // 3. Connect.
    const res = await NCEngine.connect({ token });
    if (!res.isOk) {
      events.onConnection('error', `Nexconn connect failed (code ${res.code}). Check the App Key and token server.`);
      throw new Error(`connect failed: ${res.code}`);
    }
    events.onConnection('connected');

    // 4. Make sure the community rooms exist and we are a member.
    await this.ensureRooms();
    events.onChannelsChanged();
  }

  private async ensureRooms(): Promise<void> {
    const invitees = PERSONAS.map((p) => p.id);
    for (const room of ROOMS) {
      try {
        // Idempotent in practice: creating an existing group reports failures
        // per member in the result data instead of throwing; joining is safe.
        await GroupChannel.createGroup({
          groupId: room.id,
          groupName: `${room.emoji} ${room.name}`,
          inviteeUserIds: invitees,
        });
      } catch { /* group may already exist, join below is what matters */ }
      try {
        await new GroupChannel(room.id).join();
      } catch { /* already a member, or group pending creation */ }
    }
  }

  private async refreshMessageReactions(r: { messageId: string }): Promise<void> {
    // Find which open channel holds the message by asking each known channel.
    for (const ch of this.channels.values()) {
      try {
        const res = await ch.getMessageReactionSummaries([r.messageId]);
        const list = res.data?.[r.messageId];
        if (res.isOk && list && list.length >= 0) {
          const msg = await this.fetchMessage(ch, r.messageId);
          if (msg) {
            msg.reactions = list.map((x) => ({
              reactionId: x.reactionId,
              userIds: (x.users ?? []).map((u) => (u as { userId: string }).userId),
              mine: x.hasCurrentUserReacted,
            }));
            this.events.onMessageUpdated(msg);
          }
          return;
        }
      } catch { /* try next channel */ }
    }
  }

  private async fetchMessage(ch: BaseChannel, messageId: string): Promise<ChatMessage | null> {
    const res = await BaseChannel.getMessagesByIds({
      channelIdentifier: ch.identifier,
      messageIds: [messageId],
    });
    const m = res.data?.[messageId];
    return m ? this.toChatMessage(m) : null;
  }

  async disconnect(): Promise<void> {
    await NCEngine.disconnect();
    this.events.onConnection('disconnected');
  }

  async listChannels(): Promise<ChannelSummary[]> {
    const out: ChannelSummary[] = [];
    const refs: ChannelRef[] = [
      ...ROOMS.map((r) => ({ kind: 'group' as const, id: r.id })),
      ...PERSONAS.filter((p) => p.id !== this.me.id).map((p) => ({ kind: 'direct' as const, id: p.id })),
    ];
    for (const ref of refs) {
      const ch = this.channelFor(ref);
      let unread = 0;
      let lastText = '';
      let lastTime = 0;
      try {
        await ch.reload();
        unread = ch.unreadCount ?? 0;
        const lm = ch.latestMessage;
        if (lm) {
          lastTime = lm.sentTime;
          const cm = this.toChatMessage(lm);
          if (cm?.type === 'text') lastText = cm.text ?? '';
          else if (cm?.type === 'poll') lastText = `📊 ${cm.poll?.question ?? 'Poll'}`;
        }
      } catch { /* channel not synced yet */ }
      if (ref.kind === 'group') {
        const room = roomById(ref.id);
        out.push({
          ...ref,
          title: room?.name ?? ref.id,
          subtitle: room?.topic ?? '',
          lastText, lastTime, unread,
        });
      } else {
        const p = personaById(ref.id);
        out.push({
          ...ref,
          title: p.name,
          subtitle: p.role,
          lastText, lastTime, unread,
        });
      }
    }
    return out;
  }

  async getHistory(channel: ChannelRef, beforeTime: number): Promise<ChatMessage[]> {
    const ch = this.channelFor(channel);
    const query = BaseChannel.createMessagesQuery({
      channelIdentifier: ch.identifier,
      startTime: beforeTime,
      pageSize: 40,
      isAscending: false,
    });
    const res = await query.loadNextPage();
    if (!res.isOk) return [];
    const msgs = pageItems<NCMessage>(res)
      .map((m) => this.toChatMessage(m))
      .filter((m): m is ChatMessage => m !== null);
    // Attach reaction summaries for the visible (non-vote) messages.
    const visible = msgs.filter((m) => m.type !== 'poll-vote');
    if (visible.length) {
      try {
        const sums = await ch.getMessageReactionSummaries(visible.map((m) => m.id));
        if (sums.isOk && sums.data) {
          for (const m of visible) {
            const list = sums.data[m.id];
            if (list) {
              m.reactions = list.map((x) => ({
                reactionId: x.reactionId,
                userIds: (x.users ?? []).map((u) => (u as { userId: string }).userId),
                mine: x.hasCurrentUserReacted,
              }));
            }
          }
        }
      } catch { /* reactions are decorative; history still renders */ }
    }
    return msgs; // newest-first, per query order
  }

  async sendText(channel: ChannelRef, text: string): Promise<ChatMessage> {
    const ch = this.channelFor(channel);
    const res = await ch.sendMessage(new SendTextMessageParams({ text }));
    if (!res.isOk || !res.data) throw new Error(`Send failed (code ${res.code})`);
    const cm = this.toChatMessage(res.data);
    if (!cm) throw new Error('Send failed: unrecognised message');
    return cm;
  }

  async createPoll(channel: ChannelRef, question: string, options: string[]): Promise<ChatMessage> {
    const ch = this.channelFor(channel);
    const params = new SendMessageParams({ question, options }, POLL_MESSAGE_TYPE);
    const res = await ch.sendMessage(params);
    if (!res.isOk || !res.data) throw new Error(`Poll send failed (code ${res.code})`);
    const cm = this.toChatMessage(res.data);
    if (!cm) throw new Error('Poll send failed: unrecognised message');
    return cm;
  }

  async vote(channel: ChannelRef, pollId: string, optionIndex: number): Promise<void> {
    const ch = this.channelFor(channel);
    const params = new SendMessageParams({ pollId, optionIndex }, VOTE_MESSAGE_TYPE);
    params.disableUpdateLastMessage = true;
    await ch.sendMessage(params);
  }

  async toggleReaction(msg: ChatMessage, reactionId: string): Promise<void> {
    const ch = this.channelFor(msg.channel);
    const found = await this.fetchSdkMessage(ch, msg.id);
    if (!found) return;
    const existing = msg.reactions.find((r) => r.reactionId === reactionId);
    if (existing?.mine) await found.removeReaction({ reactionId });
    else await found.addReaction({ reactionId });
  }

  private async fetchSdkMessage(ch: BaseChannel, messageId: string): Promise<NCMessage | null> {
    const res = await BaseChannel.getMessagesByIds({
      channelIdentifier: ch.identifier,
      messageIds: [messageId],
    });
    return res.data?.[messageId] ?? null;
  }

  sendTyping(channel: ChannelRef): void {
    const ch = this.channelFor(channel) as BaseChannel & {
      sendTypingStatus?: (t: string) => Promise<unknown>;
    };
    try {
      void ch.sendTypingStatus?.(TEXT_MESSAGE_TYPE);
    } catch { /* typing is best-effort */ }
  }

  async markRead(channel: ChannelRef): Promise<void> {
    try {
      await this.channelFor(channel).clearUnreadCount();
    } catch { /* non-fatal */ }
  }

  async getMembers(channel: ChannelRef): Promise<Persona[]> {
    if (channel.kind === 'direct') {
      return [this.me, personaById(channel.id)];
    }
    try {
      const res = await GroupChannel.getGroupsInfo([channel.id]);
      void res;
    } catch { /* fall through to roster */ }
    // Campfire's rooms have a fixed community roster (the seed personas).
    // Member-level detail is available via GroupChannel.getMembers in the SDK.
    return PERSONAS;
  }
}
