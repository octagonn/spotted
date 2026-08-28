import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { TrophyUnlockModal } from "@/components/trophies/TrophyUnlockModal";
import { type TrophyShareData } from "@/components/trophies/TrophyShareCard";
import { useTrophyCatalog } from "@/hooks/queries/useTrophyCatalog";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { rarityKey, rarityPctFor } from "@/lib/trophyRaritySeeds";
import { useAuthStore } from "@/stores/auth";

type EarnedRow = {
  user_id: string;
  trophy_id: string;
  instance_key: string;
  earned_at: string;
  celebrated_at: string | null;
  context: Record<string, unknown> | null;
};

/**
 * The earn moment (spec §Display locations 2): every tier, every time. Mounted
 * once at the root; listens for new `user_trophies` rows for the signed-in
 * user (the SQL engine is the only writer, so this covers posts, workouts,
 * community joins and the monthly top-of-gym job alike), queues them, shows
 * the full-screen celebration one at a time, and marks each celebrated.
 * On launch it also drains anything earned while the app was closed.
 */
export function TrophyEarnHost() {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  const { rowByKey, live } = useTrophyCatalog();
  const [queue, setQueue] = useState<EarnedRow[]>([]);
  const seen = useRef<Set<string>>(new Set());

  const enqueue = (rows: EarnedRow[]) => {
    const fresh = rows.filter((r) => {
      const id = `${r.trophy_id}#${r.instance_key}`;
      if (seen.current.has(id)) return false;
      seen.current.add(id);
      return true;
    });
    if (fresh.length) setQueue((q) => [...q, ...fresh]);
  };

  // Drain un-celebrated rows (earned while the app was closed / backgrounded).
  useEffect(() => {
    if (!isSupabaseConfigured || !userId) return;
    let cancelled = false;
    void supabase
      .from("user_trophies")
      .select("user_id, trophy_id, instance_key, earned_at, celebrated_at, context")
      .eq("user_id", userId)
      .is("celebrated_at", null)
      .gt("earned_at", new Date(Date.now() - 14 * 86_400_000).toISOString())
      .order("earned_at", { ascending: true })
      .limit(10)
      .then(({ data }) => {
        if (!cancelled && data) enqueue(data as EarnedRow[]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Live: a new row lands → celebrate now.
  useEffect(() => {
    if (!isSupabaseConfigured || !userId) return;
    const channel = supabase
      .channel(`trophies:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "user_trophies", filter: `user_id=eq.${userId}` },
        (payload) => {
          enqueue([payload.new as EarnedRow]);
          void queryClient.invalidateQueries({ queryKey: ["user-trophies", userId] });
          void queryClient.invalidateQueries({ queryKey: ["trophy-progress", userId] });
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const current = queue[0] ?? null;
  const def = current ? rowByKey.get(current.trophy_id) : undefined;
  const data: TrophyShareData | null =
    current && def
      ? {
          icon: def.icon,
          name: def.name,
          familyName: def.family && def.rule_type === "threshold" ? (def.tier ? `${def.tier[0].toUpperCase()}${def.tier.slice(1)} tier` : null) : null,
          earnedAt: current.earned_at,
          rarityPct: rarityPctFor(
            def.family && def.rule_type === "threshold" ? rarityKey(def.family, Number(def.rule_params?.value ?? 0) || 0) : rarityKey(def.key),
            live
          ),
          medal: def.tier,
          context: current.context ?? undefined
        }
      : null;

  const dismiss = () => {
    if (current && userId) {
      void supabase
        .from("user_trophies")
        .update({ celebrated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("trophy_id", current.trophy_id)
        .eq("instance_key", current.instance_key)
        .then(() => undefined, () => undefined);
    }
    setQueue((q) => q.slice(1));
  };

  // Definitions still loading for a queued row → wait (modal stays hidden).
  return <TrophyUnlockModal data={data} visible={Boolean(data)} onClose={dismiss} />;
}
