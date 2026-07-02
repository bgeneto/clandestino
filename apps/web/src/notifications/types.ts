export type NotificationVariant = 'success' | 'info' | 'warning' | 'danger';

export type NotificationOptions = {
  description?: string;
  duration?: number;
};

export type NotificationItem = {
  id: string;
  variant: NotificationVariant;
  message: string;
  description?: string;
  duration: number;
  createdAt: number;
  pausedAt: number | null;
  elapsedWhilePaused: number;
};

export type NotificationApi = {
  success: (message: string, options?: NotificationOptions) => string;
  info: (message: string, options?: NotificationOptions) => string;
  warning: (message: string, options?: NotificationOptions) => string;
  danger: (message: string, options?: NotificationOptions) => string;
  dismiss: (id: string) => void;
};

export const DEFAULT_NOTIFICATION_DURATION_MS = 6_000;
export const DANGER_NOTIFICATION_DURATION_MS = 8_000;
export const MAX_VISIBLE_NOTIFICATIONS = 3;
