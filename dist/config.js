// Campfire runtime configuration.
// Leave appKey empty to run the app in local DEMO mode (no account needed).
// To go LIVE on Nexconn:
//   1. Create a free app in the Nexconn Console (console.nexconn.ai) and copy its App Key here.
//   2. Run the token server in /server with your App Key + App Secret, deploy it anywhere
//      (Render / Railway / Fly / a VPS), and put its public URL below.
window.CAMPFIRE_CONFIG = {
  appKey: '',
  tokenServerUrl: '',
};
