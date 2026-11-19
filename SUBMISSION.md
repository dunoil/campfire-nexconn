# SUBMISSION — Nexconn Build Challenge 2026 (Campfire)

**Deadline:** The Reskilll event page states **Nov 22, 2026, 11:59 PM IST**
(= Nov 22, 18:29 UTC / Nov 23, 02:29 WITA). Submit before the IST time to be safe.
Submissions can be edited on Reskilll until the deadline.
Register/submit at: https://reskilll.com/hack/nexconn

## Prepared submission values

| Field | Prepared value |
| --- | --- |
| Team name | `dunoil` (team of 1 — solo) |
| Team members | Duan — GitHub @dunoil |
| Track | **Social & Community** |
| Project name | **Campfire** |
| Tagline | Real-time community rooms where the chat runs the show — live polls, reactions and typing presence, powered by the Nexconn Chat SDK. |
| Runnable app link | `<<AFTER DEPLOY>>` — target: `https://dunoil.github.io/campfire-nexconn/` (GitHub Pages workflow included in the repo) |
| Public GitHub repo | `<<AFTER PUSH>>` — target: `https://github.com/dunoil/campfire-nexconn` |
| Demo video | `<<AFTER RECORDING>>` — script + shot list in DEMO_VIDEO.md (works in demo mode today; re-record in live mode after keys exist if time allows) |
| Write-up | WRITEUP.md in this repo — convert to PDF for the "Write-up PDF" upload (e.g. open in a Markdown viewer / GitHub and print to PDF), after pasting the App Key into it |
| Nexconn App Key | `<<FROM NEXCONN CONSOLE>>` — judges use this to verify SDK usage; paste into WRITEUP.md and the form's App Key field |
| Traction proof (optional bonus) | Leave empty, or attach docs/screenshot-crosstab.png (two personas chatting live) |

## Accounts / keys still needed (do these in one batch)

1. **Reskilll account + team** (reskilll.com/hack/nexconn)
   - Sign up / log in, click Register, create a team of 1 named `dunoil`, select
     track **Social & Community**. This unlocks the submission form.
2. **Nexconn developer account + app** (console.nexconn.ai)
   - Register (free; registration auto-creates an app on the Free plan, valid one
     month, no credit card). Open the app → Key Management → copy **App Key** and
     **App Secret**. Default data center is Singapore.
   - App Key → `public/config.js` in the repo + WRITEUP.md + submission form.
   - App Secret → ONLY into the token server's environment (never the repo —
     the one exception: a host's env-var settings screen).
3. **Token server hosting** (any free Node host: Render / Railway / Fly.io)
   - Deploy `server/token-server.mjs` with env `NEXCONN_APP_KEY`,
     `NEXCONN_APP_SECRET`, `NEXCONN_API_BASE=https://api.sg-light-api.com`.
   - Verify `GET /health` returns `appKeyConfigured: true`, then
     `POST /seed` once to create the rooms server-side.
   - Put the server's public URL into `public/config.js` as `tokenServerUrl`,
     rebuild, redeploy the static app.
4. **GitHub repo** — create public repo `campfire-nexconn` under @dunoil, push this
   folder, enable Pages (the included workflow deploys `dist/` on push to main).

## Final pre-submit checklist

- [ ] Live app loads at the Pages URL and the gate banner says **Live mode**
- [ ] Two personas (two browsers) can exchange messages + vote in the same poll
- [ ] App Key pasted into WRITEUP.md and converted write-up PDF
- [ ] Demo video recorded + uploaded, URL in the form
- [ ] Repo is public and its README renders with screenshots
- [ ] Submit on Reskilll **before Nov 22, 23:59 IST**, then screenshot the
      confirmation for records
