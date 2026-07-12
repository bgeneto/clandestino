import { useEffect, useState } from 'react';
import {
  getOnlineStatus,
  startOnlineStatusMonitor,
  subscribeOnlineStatus,
} from '../lib/online-status.js';

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(getOnlineStatus);

  useEffect(() => {
    startOnlineStatusMonitor();
    const unsubscribe = subscribeOnlineStatus(setOnline);
    setOnline(getOnlineStatus());
    return unsubscribe;
  }, []);

  return online;
}
