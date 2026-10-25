import { Image } from 'react-native';

const coin = require('../../../assets/coin.png');

/**
 * The FittinOS coin — the gold "F" badge, identical to the web's
 * components/coins/CoinIcon.tsx (rasterised from that SVG into assets/coin.png,
 * since this app has no SVG module). Use it wherever coins are shown so every
 * coin in the app looks the same.
 */
export function CoinIcon({ size = 24 }: { size?: number }) {
  return <Image source={coin} style={{ width: size, height: size }} accessibilityIgnoresInvertColors accessible={false} />;
}
