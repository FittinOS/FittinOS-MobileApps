// This tab destination IS the existing Coin Wallet screen — not a copy. The
// same component is still reachable via a stack push at /(app)/wallet (e.g.
// from Home's wallet hero), unchanged; this file only gives it a second,
// tab-bar-reachable route. The screen's own `useSegments()` check tells the
// two cases apart at render time — a back button when pushed onto the
// stack, a plain title when this mount's route runs through (tabs).
export { default } from '../wallet';
