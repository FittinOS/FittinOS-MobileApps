import { Text, View } from 'react-native';
import type { CoinPackageDto } from '@/api/shared';
import { Button } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { CoinIcon } from './CoinIcon';

/**
 * One coin package — the web's CoinPackageCard (compact, centred): tag pill,
 * coin badge, coins, bonus, price with the "was" price struck through, and
 * Buy now. Every value comes from the /coin-packages catalog; the tag pill
 * only ever shows the catalog's own `tag`.
 */
export function CoinPackageCard({
  pkg,
  onBuy,
  buying = false,
  disabled = false,
  compact = false,
}: {
  pkg: CoinPackageDto;
  onBuy: (pkg: CoinPackageDto) => void;
  /** This card's purchase is in flight. */
  buying?: boolean;
  /** Any purchase is in flight. */
  disabled?: boolean;
  compact?: boolean;
}) {
  const coins = pkg.coins.toLocaleString('en-IN');
  return (
    <View
      className={`relative items-center rounded-3xl border-2 bg-card ${compact ? 'px-3 pb-3 pt-4' : 'px-3.5 pb-3.5 pt-5'} ${
        pkg.tag ? 'border-primary' : 'border-border'
      }`}
    >
      {pkg.tag ? (
        <View className="absolute -top-3 rounded-full bg-action px-2.5 py-0.5">
          <Text className="text-[10px] font-bold text-white" numberOfLines={1}>
            {pkg.tag}
          </Text>
        </View>
      ) : null}
      <CoinIcon size={compact ? 40 : 48} />
      <Text className={`mt-2 font-bold text-text-heading ${compact ? 'text-sm' : 'text-[15px]'}`} numberOfLines={1}>
        {coins} Coins
      </Text>
      {pkg.bonusCoins > 0 ? (
        <Text className="mt-0.5 text-xs font-semibold text-success-ink">+{pkg.bonusCoins.toLocaleString('en-IN')} Bonus</Text>
      ) : (
        <Text className="mt-0.5 text-xs text-text-body">No Bonus</Text>
      )}
      <View className="mt-2 flex-row items-baseline">
        <Text className={`font-bold text-text-heading ${compact ? 'text-base' : 'text-lg'}`}>{formatMoney(pkg.priceAmount)}</Text>
        {pkg.originalPriceAmount != null && pkg.originalPriceAmount > pkg.priceAmount ? (
          <Text className="ml-1.5 text-[11px] text-text-body line-through">{formatMoney(pkg.originalPriceAmount)}</Text>
        ) : null}
      </View>
      <View className="mt-3 w-full">
        <Button
          title="Buy now"
          size="sm"
          loading={buying}
          disabled={disabled && !buying}
          onPress={() => onBuy(pkg)}
          accessibilityLabel={`Buy ${coins} coins for ${formatMoney(pkg.priceAmount)}`}
        />
      </View>
    </View>
  );
}
