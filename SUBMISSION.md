# SUBMISSION, Nexconn Build Challenge 2026 (Campfire)

**Deadline:** The Reskilll event page states **Nov 22, 2026, 11:59 PM IST**
(= Nov 22, 18:29 UTC / Nov 23, 02:29 WITA). Submit before the IST time to be safe.
Submissions can be edited on Reskilll until the deadline.
Register/submit at: https://reskilll.com/hack/nexconn

## Prepared submission values

| Field | Prepared value |
| --- | --- |
| Team name | `dunoil` (team of 1, solo) |
| Team members | Duan, GitHub @dunoil |
| Track | **Social & Community** |
| Project name | **Campfire** |
| Tagline | Real-time community rooms where the chat runs the show, live polls, reactions and typing presence, powered by the Nexconn Chat SDK. |
| Runnable app link | `https://dunoil.github.io/campfire-nexconn/` (live, wired to Nexconn) |
| Public GitHub repo | `https://github.com/dunoil/campfire-nexconn` |
| Demo video | `campfire-demo.mp4` in this repo (real app screenshots + narration, made per DEMO_VIDEO.md), upload to YouTube and put the URL in the form |
| Write-up | WRITEUP.md in this repo, PDF ready as WRITEUP.pdf (App Key already filled in) |
| Nexconn App Key | `pgyu6atqpc04u`, also in WRITEUP.md and the form's App Key field |
| Token server | `https://campfire-token-server.onrender.com` (Render free tier), health green, real token issuance verified through the public URL, 4 rooms created server side |
| Traction proof (optional bonus) | Leave empty, or attach docs/screenshot-crosstab.png (two personas chatting live) |

## Accounts / keys, status (all done 19 Nov 2026)

1. **Reskilll account + team**: done. Team `dunoil` (solo), track
   **Social & Community** selected and saved.
2. **Nexconn developer account + app**: done. Free app in the Singapore data
   center, App Key and App Secret obtained. App Key is in `public/config.js`,
   WRITEUP.md and WRITEUP.pdf. App Secret lives only in the token server
   environments (local .env, gitignored, and the Render env settings).
3. **Token server hosting**: done on Render free tier,
   `https://campfire-token-server.onrender.com`. Health returns
   `appKeyConfigured: true`; a real access token was issued through the public
   `/token` endpoint; the 4 rooms were created server side with `POST /seed`
   (the REST join call has an API quirk, the client SDK joins rooms itself on
   connect, so this does not block anything).
4. **GitHub repo**: public, Pages serves the live-mode build from the
   `gh-pages` branch.

## Final pre-submit checklist

- [x] Live app loads at the Pages URL with the live config (App Key + token
      server URL verified in the served config.js; banner renders Live mode
      from that config)
- [ ] Two personas in a real browser exchange live messages + vote in the
      same poll (demo mode cross-tab verified 17/17; live token path verified;
      full live two-browser pass still to do)
- [x] App Key pasted into WRITEUP.md and WRITEUP.pdf produced
- [ ] Demo video assembled (campfire-demo.mp4), upload + URL in the form
- [x] Repo is public and its README renders with screenshots
- [ ] Submit on Reskilll **before Nov 22, 23:59 IST**, then screenshot the
      confirmation for records
