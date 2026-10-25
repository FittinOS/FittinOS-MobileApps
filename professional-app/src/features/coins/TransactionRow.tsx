import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CoinTransactionDto } from '@/api/shared';
import { formatDate } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { CoinIcon } from './CoinIcon';
import { coinTransactionLabel } from './labels';

/** One coin transaction (wallet history and Buy Coins' recent activity). */
export function TransactionRow({ tx }: { tx: CoinTransactionDto }) {
  const { colors } = useTheme();
  const credit = tx.amount > 0;
  return (
    <View className="flex-row items-center rounded-2xl border border-border bg-card p-3.5">
      <View className={`h-10 w-10 items-center justify-center rounded-xl ${credit ? 'bg-success-soft' : 'bg-danger-soft'}`}>
        <Ionicons name={credit ? 'arrow-up' : 'arrow-down'} size={17} color={credit ? colors.success : colors.danger} />
      </View>
      <View className="mx-3 flex-1">
        <Text className="text-sm font-semibold text-text-heading" numberOfLines={2}>
          {tx.description || coinTransactionLabel(tx.type)}
        </Text>
        <Text className="text-xs text-text-body">
          {coinTransactionLabel(tx.type)} · {formatDate(tx.createdAt)}
        </Text>
      </View>
      <View className="items-end">
        <View className="flex-row items-center">
          <CoinIcon size={14} />
          <Text className={`ml-1 text-[15px] font-bold ${credit ? 'text-success-ink' : 'text-danger-ink'}`}>
            {credit ? '+' : ''}
            {tx.amount.toLocaleString('en-IN')}
          </Text>
        </View>
        <Text className="text-[11px] text-text-body">Balance: {tx.balanceAfter.toLocaleString('en-IN')}</Text>
      </View>
    </View>
  );
}
