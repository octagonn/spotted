import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const KEY = "spotted.startedThreads";

/**
 * Locally-persisted set of DM threads the user has opened. Lets an empty
 * "Tap to start conversation" thread clear its unread styling permanently once
 * opened — even if no message is ever sent (Instagram behavior).
 */
export function useStartedThreads() {
  const [started, setStarted] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (active && raw) {
          try {
            setStarted(new Set(JSON.parse(raw) as string[]));
          } catch {
            /* ignore malformed */
          }
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const markStarted = useCallback((id: string) => {
    setStarted((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev).add(id);
      void AsyncStorage.setItem(KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, []);

  return { started, markStarted };
}
