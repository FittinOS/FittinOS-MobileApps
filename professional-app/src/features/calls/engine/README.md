# Call engine (shared with the web)

These files are byte-for-byte copies of `apps/web/lib/calls/{call-engine,call-status,media,availability,call-socket-config}.ts`
and their `node --test` suites (origin/main @ 493b54a). The engine is framework-agnostic: every
platform dependency (socket, getUserMedia, RTCPeerConnection, ICE fetch, ringing) is injected,
so the mobile app supplies `react-native-webrtc` + `socket.io-client` implementations in
`../call-provider.tsx` and the protocol itself stays identical to the web's.

Keep them in sync with the web copies (run `diff` against `apps/web/lib/calls`); a future step
could move both into `packages/` — not done here to avoid touching the web app.

Run the suites: `npm run test:calls` (Node ≥ 22.18 strips the TypeScript types natively).
