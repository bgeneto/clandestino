import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { createClientId } from '../lib/create-client-id.js';
import { NotificationStack } from '../components/ui/NotificationStack.js';
import {
  DANGER_NOTIFICATION_DURATION_MS,
  DEFAULT_NOTIFICATION_DURATION_MS,
  MAX_VISIBLE_NOTIFICATIONS,
  type NotificationApi,
  type NotificationItem,
  type NotificationOptions,
  type NotificationVariant,
} from './types.js';

type NotificationContextValue = NotificationApi;

const NotificationContext = createContext<NotificationContextValue | null>(null);

function defaultDuration(variant: NotificationVariant, options?: NotificationOptions): number {
  if (options?.duration !== undefined) {
    return options.duration;
  }

  return variant === 'danger' ? DANGER_NOTIFICATION_DURATION_MS : DEFAULT_NOTIFICATION_DURATION_MS;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<NotificationItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const pause = useCallback((id: string) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id && item.pausedAt === null ? { ...item, pausedAt: Date.now() } : item,
      ),
    );
  }, []);

  const resume = useCallback((id: string) => {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== id || item.pausedAt === null) {
          return item;
        }

        return {
          ...item,
          pausedAt: null,
          elapsedWhilePaused: item.elapsedWhilePaused + (Date.now() - item.pausedAt),
        };
      }),
    );
  }, []);

  const push = useCallback(
    (variant: NotificationVariant, message: string, options?: NotificationOptions) => {
      const id = createClientId('notification');
      const item: NotificationItem = {
        id,
        variant,
        message,
        description: options?.description,
        duration: defaultDuration(variant, options),
        createdAt: Date.now(),
        pausedAt: null,
        elapsedWhilePaused: 0,
      };

      setItems((current) => [item, ...current].slice(0, MAX_VISIBLE_NOTIFICATIONS));
      return id;
    },
    [],
  );

  const value = useMemo<NotificationContextValue>(
    () => ({
      success: (message, options) => push('success', message, options),
      info: (message, options) => push('info', message, options),
      warning: (message, options) => push('warning', message, options),
      danger: (message, options) => push('danger', message, options),
      dismiss,
    }),
    [dismiss, push],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationStack items={items} onDismiss={dismiss} onPause={pause} onResume={resume} />
    </NotificationContext.Provider>
  );
}

export function useNotification(): NotificationApi {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }

  return context;
}
