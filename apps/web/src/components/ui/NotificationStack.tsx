import { Notification } from './Notification.js';
import type { NotificationItem } from '../../notifications/types.js';

type NotificationStackProps = {
  items: NotificationItem[];
  onDismiss: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
};

export function NotificationStack({ items, onDismiss, onPause, onResume }: NotificationStackProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col gap-3 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96"
    >
      {items.map((item) => (
        <div key={item.id} className="pointer-events-auto">
          <Notification item={item} onDismiss={onDismiss} onPause={onPause} onResume={onResume} />
        </div>
      ))}
    </div>
  );
}
