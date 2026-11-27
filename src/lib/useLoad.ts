import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { friendlyError } from './api';

/** Loads data when the screen gains focus, with pull-to-refresh support. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const reload = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    try {
      setData(await fnRef.current());
      setError(null);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { data, error, refreshing, reload, refresh: () => reload(true), setData };
}
