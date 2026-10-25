import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

type ToastTone = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

const ToastContext = createContext<{ show: (message: string, tone?: ToastTone) => void } | null>(null);

const toneStyle: Record<ToastTone, { bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  success: { bg: 'bg-success', icon: 'checkmark-circle' },
  error: { bg: 'bg-danger', icon: 'alert-circle' },
  info: { bg: 'bg-secondary', icon: 'information-circle' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const insets = useSafeAreaInsets();

  const show = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = nextId.current++;
    setToasts((all) => [...all.slice(-2), { id, tone, message }]);
    setTimeout(() => setToasts((all) => all.filter((t) => t.id !== id)), 3500);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="none" className="absolute left-0 right-0 px-4" style={{ top: insets.top + 8 }}>
        {toasts.map((t) => (
          <View
            key={t.id}
            className={`mb-2 flex-row items-center rounded-xl px-4 py-3 shadow-md ${toneStyle[t.tone].bg}`}
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
          >
            <Ionicons name={toneStyle[t.tone].icon} size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text className="flex-1 text-sm font-medium text-white">{t.message}</Text>
          </View>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used within ToastProvider');
  return value;
}
