# Campfire: Nexconn Build Challenge 2026 Write-Up

**Track:** Social & Community
**Team:** Solo, Duan (@dunoil)
**App name:** Campfire
**Nexconn App Key:** `pgyu6atqpc04u` (from the Nexconn Console; also in the submission form)

## The problem

Online communities live or die on lightweight coordination: deciding things together,
asking for help, reacting in the moment. Most community tools bury those interactions in
separate apps: a poll tool here, a group chat there, a planning thread somewhere else.
Campfire puts the coordination **inside the conversation**: the chat itself is where the
community votes, reacts and plans.

## What Campfire is

Campfire is a real-time community chat web app, think a friendly neighbourhood or
interest-group hub, built entirely on the Nexconn Chat SDK:

- **Four topic rooms** (Campfire General, Show & Tell, Help Circle, Weekend Plans),
  each a Nexconn **group channel** with full history, unread badges and previews.
- **Direct messages** between members (Nexconn **direct channels**).
- **Live polls posted from the composer.** A poll is a Nexconn **custom message**
  (`campfire:poll`); each vote is its own custom message (`campfire:vote`). Every
  connected client tallies votes from the message stream, so results update live on
  every screen with no extra backend and no polling. Voters can change their vote:
  the latest vote per user wins.
- **Message reactions** (👍 ❤️ 😂 🎉) using the SDK's reaction APIs and
  reaction-change events.
- **Typing presence** ("Ben is typing…") via typing-status events.
- **A persona picker** as the front door: four community members, each a distinct
  Nexconn user ID with a server-issued token. Open two browsers/tabs as different
  personas and everything syncs in real time.

## How Nexconn is used (the technical core)

- **Identity & tokens:** A zero-dependency Node token server holds the App Secret and
  calls the Nexconn Server API (`POST /v4/auth/access-token/issue`) with the documented
  signature scheme (`SHA1(AppSecret + Nonce + Timestamp)`). The browser only ever sees
  the App Key and per-user tokens. The App Secret never ships to a client.
- **Connection:** `NCEngine.initialize({ appKey })`, custom message types registered up
  front, then `NCEngine.connect({ token })` with the SDK's built-in reconnection.
- **Rooms:** Group channels created and joined both ways for robustness: seeded from
  the server (Server API `/v4/group-channel/create` + `/v4/group-channel/join`) and
  ensured from the client on first connect (`GroupChannel.createGroup`, `join()`).
- **Messages:** Text via `SendTextMessageParams`; polls/votes via
  `SendMessageParams(content, messageType)`; history via paginated
  `BaseChannel.createMessagesQuery`; unread state via channel `unreadCount` /
  `clearUnreadCount()`; reactions via `addReaction` / `removeReaction` /
  `getMessageReactionSummaries`; typing via `sendTypingStatus` and
  `ChannelHandler.onTypingStatusChanged`; live updates via
  `MessageHandler.onMessageReceived`.

## Zero-config demo mode

So judges can run Campfire instantly, the app ships with a **local demo transport**
behind the same UI: if no App Key is configured, messages persist locally and sync
between browser tabs in real time, with scripted neighbours keeping a solo session
lively. Adding the App Key + token server URL to `config.js` switches the identical
UI to live Nexconn cloud chat, with no rebuild and no code change. (Demo mode is a fallback
for evaluation convenience; all scoring-relevant functionality is implemented against
the real SDK.)

## Verification

- Production build passes TypeScript + Vite with no errors.
- A 17-point headless browser smoke test passes end-to-end (persona gate, channel
  list, seeded history, poll creation and voting with tally updates, reactions,
  cross-tab real-time delivery, DMs, room switching, zero page errors).
  Script: `scripts/smoke-test.mjs`; screenshots in `docs/`.

## Business & growth thinking (traction/viability)

Campfire's pattern (rooms + in-chat polls + reactions) generalises to any
community that coordinates in chat: apartment residents, hobby clubs, campus groups,
creator communities, small-team standups. Nexconn's free tier (10,000 MAU) makes the
unit economics work from day one; the natural paid steps are larger communities
(Pro plan member limits), custom branding, and moderation tooling, all incremental
on the same SDK foundation, with chat data and identity already in place.

## What was built for this challenge

Everything: the app, the token server, the poll/vote custom-message design, the demo
transport, docs and tests were created during the challenge window (Oct 23 – Nov 22,
2026). No pre-existing project was reused.
