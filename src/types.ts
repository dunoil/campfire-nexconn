// Transport contract shared by the live Nexconn transport and the local
// demo transport. The UI only ever talks to this interface.

import type { Persona } from './data';

export type ChannelKind = 'group' | 'direct';

export interface ChannelRef {
  kind: ChannelKind;
  /** group channel ID, or the other user's ID for direct channels */
  id: string;
}

export interface ChannelSummary extends ChannelRef {
  title: string;
  subtitle: string;
  lastText: string;
  lastTime: number;
  unread: number;
}

export interface PollData {
  question: string;
  options: string[];
}

export interface ReactionSummary {
  reactionId: string;
  userIds: string[];
  mine: boolean;
}

export interface ChatMessage {
  id: string;
  channel: ChannelRef;
  senderId: string;
  sentTime: number;
  type: 'text' | 'poll' | 'poll-vote';
  text?: string;
  poll?: PollData;
  /** for type === 'poll-vote' */
  vote?: { pollId: string; optionIndex: number };
  reactions: ReactionSummary[];
  mine: boolean;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface TransportEvents {
  onConnection(status: ConnectionStatus, detail?: string): void;
  onMessage(msg: ChatMessage): void;
  onChannelsChanged(): void;
  onTyping(channel: ChannelRef, userIds: string[]): void;
  onMessageUpdated(msg: ChatMessage): void;
}

export interface ChatTransport {
  readonly mode: 'live' | 'demo';
  connect(persona: Persona, events: TransportEvents): Promise<void>;
  disconnect(): Promise<void>;
  listChannels(): Promise<ChannelSummary[]>;
  /** Newest-first page of history before `beforeTime` (exclusive). */
  getHistory(channel: ChannelRef, beforeTime: number): Promise<ChatMessage[]>;
  sendText(channel: ChannelRef, text: string): Promise<ChatMessage>;
  createPoll(channel: ChannelRef, question: string, options: string[]): Promise<ChatMessage>;
  vote(channel: ChannelRef, pollId: string, optionIndex: number): Promise<void>;
  toggleReaction(msg: ChatMessage, reactionId: string): Promise<void>;
  sendTyping(channel: ChannelRef): void;
  markRead(channel: ChannelRef): Promise<void>;
  getMembers(channel: ChannelRef): Promise<Persona[]>;
}

export interface CampfireConfig {
  appKey: string;
  tokenServerUrl: string;
}

export function loadConfig(): CampfireConfig {
  const w = window as unknown as { CAMPFIRE_CONFIG?: Partial<CampfireConfig> };
  return {
    appKey: (w.CAMPFIRE_CONFIG?.appKey ?? '').trim(),
    tokenServerUrl: (w.CAMPFIRE_CONFIG?.tokenServerUrl ?? '').trim().replace(/\/$/, ''),
  };
}
