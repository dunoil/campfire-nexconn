# Demo video: script and shot list

Target length: **2:30–3:00**. Record at 1440×900 (or 1080p), browser zoom 100%.
Two delivery options:

- **Option A (best, once live keys exist):** record the LIVE app: two browser windows
  side by side (Ava left, Ben right) on the deployed URL with real Nexconn chat.
- **Option B (works today, zero accounts):** record DEMO mode the same way: two tabs
  of the static build. Everything below behaves identically; the gate banner honestly
  shows "Demo mode". If Option B is used, say so in one line of narration (script
  includes it). Judges also get the live-mode code and App Key to verify.

## Shot list

| # | Time | Visual | Action |
|---|------|--------|--------|
| 1 | 0:00–0:15 | Persona gate | Hover the four persona cards; the mode banner is visible. Click **Ava Hart**. |
| 2 | 0:15–0:35 | Campfire General | Show seeded history + the community-night poll with tallies. Scroll a little. |
| 3 | 0:35–0:55 | Poll vote | As Ava, vote **Cooking swap** on the seeded poll, and the bar and % update instantly. |
| 4 | 0:55–1:20 | Second window (Ben) | Open the app in a second window, enter as **Ben**. Ben votes **Outdoor film screening**; cut back to Ava's window: the tally moved live. |
| 5 | 1:20–1:45 | Real-time chat | Ben types in Campfire General. Ava's window shows "Ben is typing…", then the message lands. Ava replies; add a ❤️ reaction from Ben's window; it appears on Ava's. |
| 6 | 1:45–2:05 | Create a poll | As Ava: 📊 button → question "Best day for the riverside walk?", options Saturday/Sunday → Post. Ben votes; bars animate. |
| 7 | 2:05–2:25 | Rooms + DM | Click **Help Circle** (history loads), then open the DM with Ben and send a message; show the channel list previews/unread updating. |
| 8 | 2:25–2:50 | Code close-up | Quick cuts: `public/config.js` (App Key drops in), `src/nexconn-transport.ts` (registerCustomMessages + connect), token server `/token`. End on the app. |

## Narration script (voice-over or captions)

1. "This is Campfire, a real-time community app built on the Nexconn Chat SDK, for the
   Social and Community track."
2. "Four neighbours, four topic rooms. Every room is a Nexconn group channel, with
   history, unread badges and live updates."
3. "The heart of Campfire is coordination inside the chat. This poll isn't a plugin.
   It's a Nexconn custom message. Votes are custom messages too, so every client
   tallies the same result in real time."
4. "Here's Ben in a second window. When he votes, Ava's tally moves instantly, with no
   refresh and no polling."
5. "Typing presence, reactions, direct messages: all straight from the SDK."
6. "Anyone can start a poll from the composer. Two taps and the whole room is voting."
7. "Rooms, DMs, one channel list that stays in sync."
8. "Under the hood: a tiny token server keeps the App Secret off the client and signs
   token requests to the Nexconn Server API. The web app only holds the App Key."
   *(Option B only, add: "You're seeing Campfire's zero-config demo transport; the
   same UI runs on live Nexconn chat the moment an App Key is added in config.js.
   The integration code is in the repo.")*
9. "Campfire: communities that decide together, right inside the conversation.
   Built solo for the Nexconn Build Challenge 2026."

## Recording checklist

- [ ] Fresh browser profile / cleared localStorage for a clean seeded state
- [ ] Both windows logged in as different personas before recording the cuts
- [ ] Notifications off, no personal tabs visible
- [ ] Export 1080p MP4, upload unlisted/public per Reskilll instructions
- [ ] Paste the video URL into SUBMISSION.md and the Reskilll form
