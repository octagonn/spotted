import { useFocusEffect } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";

/**
 * Refetch a screen's data every time the screen comes into view.
 *
 * React Query's focusManager is wired to AppState (see app/_layout.tsx), so
 * data refreshed when you left the app and came back — but NOT when you moved
 * between tabs, because tab screens stay mounted and never remount. That's why
 * new messages and friend requests only appeared after backgrounding the app.
 *
 * Pass the query-key heads a screen shows; they refetch on focus (skipping the
 * very first focus, where the queries have just mounted and fetched anyway).
 */
export function useRefreshOnFocus(keys: string[]): void {
  const queryClient = useQueryClient();
  const firstFocus = useRef(true);
  const signature = keys.join(",");

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      for (const key of signature.split(",")) {
        if (key) void queryClient.invalidateQueries({ queryKey: [key] });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queryClient, signature])
  );
}
