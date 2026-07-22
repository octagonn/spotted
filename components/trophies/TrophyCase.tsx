import { useMemo, useState } from "react";
import { Text, View, useWindowDimensions } from "react-native";

import { EarnedTrophyCard } from "@/components/trophies/EarnedTrophyCard";
import { PersonalRecordsSection } from "@/components/trophies/PersonalRecordsSection";
import { TrophyCategorySection } from "@/components/trophies/TrophyCategorySection";
import { TrophyDetailSheet } from "@/components/trophies/TrophyDetailSheet";
import { TrophyGrid, trophyCardWidth } from "@/components/trophies/TrophyGrid";
import { TrophySegmentedControl, type TrophyTab } from "@/components/trophies/TrophySegmentedControl";
import { TrophyUnlockModal } from "@/components/trophies/TrophyUnlockModal";
import { type TrophyShareData } from "@/components/trophies/TrophyShareCard";
import { usePersonalRecords } from "@/hooks/usePersonalRecords";
import { useTrophies } from "@/hooks/useTrophies";
import { useMyProfile } from "@/hooks/queries/useProfile";
import { useSetFeaturedTrophies } from "@/hooks/queries/useProfileExtras";
import { showToast } from "@/stores/ui";
import { type TrophyCardModel } from "@/lib/trophySelectors";
import { colors } from "@/theme/colors";

/**
 * The trophy case. Two tabs only — Categories (default) and Earned. Categories
 * shows one card per family under category headers; Earned lists every earned
 * tier/standalone newest-first. Every card and sheet shows the exact rarity
 * percentage. Newly-earned achievements pop the unlock modal.
 */
export function TrophyCase({ userId }: { userId?: string | null }) {
  const { width } = useWindowDimensions();
  const { sections, earned, ladderFor, newlyEarned, dismissNewlyEarned } = useTrophies(userId);
  // Workout-session PRs (any exercise) — they belong in the case too.
  const profile = useMyProfile().data;
  const myId = profile?.id ?? null;
  const isOwn = !userId || userId === myId;
  const setFeatured = useSetFeaturedTrophies();
  const featured = useMemo(() => {
    const raw = profile?.featured_trophies;
    return Array.isArray(raw) ? (raw as { id?: string; icon: string; name: string; familyName: string | null }[]) : [];
  }, [profile?.featured_trophies]);
  const featuredIds = useMemo(() => {
    // Match by stored id when present (new writes), else by display name (legacy).
    const names = new Set(featured.map((f) => f.name));
    const storedIds = new Set(featured.map((f) => f.id).filter(Boolean) as string[]);
    const ids = new Set<string>();
    for (const section of sections) for (const card of section.cards) {
      if (storedIds.has(card.def.id) || names.has(card.displayTier?.name ?? card.def.name)) ids.add(card.def.id);
    }
    return ids;
  }, [featured, sections]);
  const personalRecords = usePersonalRecords(userId ?? myId);
  const [tab, setTab] = useState<TrophyTab>("Categories");
  const [openId, setOpenId] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<TrophyShareData | null>(null);

  const cardWidth = trophyCardWidth(width);

  const cardById = useMemo(() => {
    const map = new Map<string, TrophyCardModel>();
    for (const section of sections) for (const card of section.cards) map.set(card.def.id, card);
    return map;
  }, [sections]);

  const openCard = openId ? cardById.get(openId) ?? null : null;
  const ladder = useMemo(() => (openCard ? ladderFor(openCard.def) : []), [openCard, ladderFor]);

  const shareFromCard = (card: TrophyCardModel): TrophyShareData => ({
    icon: card.def.icon,
    name: card.displayTier ? card.displayTier.name : card.def.name,
    familyName: card.def.type === "stacked" ? card.def.name : null,
    earnedAt: card.earnedAt,
    rarityPct: card.rarityPct
  });

  return (
    <View style={{ paddingBottom: 12 }}>
      <TrophySegmentedControl value={tab} onChange={setTab} />

      {tab === "Categories" ? (
        <>
          <PersonalRecordsSection records={personalRecords.records} />
          {sections.map((section) => (
            <TrophyCategorySection key={section.category} section={section} cardWidth={cardWidth} onOpen={setOpenId} />
          ))}
        </>
      ) : earned.length === 0 && personalRecords.records.length === 0 ? (
        <View style={{ alignItems: "center", paddingTop: 48, paddingHorizontal: 40 }}>
          <Text style={{ fontFamily: "Geist_400Regular", fontSize: 13, lineHeight: 19, color: colors.fog, textAlign: "center" }}>
            No trophies earned yet. Post, check in, and hit the gym to start your case.
          </Text>
        </View>
      ) : (
        <View style={{ paddingTop: 6 }}>
          <PersonalRecordsSection records={personalRecords.records} />
          <TrophyGrid>
            {earned.map((entry) => (
              <EarnedTrophyCard key={entry.key} entry={entry} width={cardWidth} onPress={() => setOpenId(entry.def.id)} />
            ))}
          </TrophyGrid>
        </View>
      )}

      <TrophyDetailSheet
        card={openCard}
        ladder={ladder}
        visible={openCard !== null}
        onClose={() => setOpenId(null)}
        onShare={
          openCard
            ? () => {
                const data = shareFromCard(openCard);
                setOpenId(null);
                setCelebrate(data);
              }
            : undefined
        }
        // Feature/unfeature only on your OWN case (spec C — 3 pins max).
        featured={openCard ? featuredIds.has(openCard.def.id) : false}
        onFeature={
          openCard && isOwn
            ? () => {
                const id = openCard.def.id;
                const already = featuredIds.has(id);
                if (!already && featured.length >= 3) {
                  showToast("You can feature up to 3 trophies");
                  return;
                }
                const next = already
                  ? featured.filter((f) => f.id !== id)
                  : [...featured, { id, icon: openCard.def.icon, name: openCard.displayTier?.name ?? openCard.def.name, familyName: openCard.def.type === "stacked" ? openCard.def.name : null }];
                setFeatured.mutate(
                  next.map((f) => ({ id: f.id ?? "", icon: f.icon, name: f.name, familyName: f.familyName }))
                );
              }
            : undefined
        }
      />

      <TrophyUnlockModal
        data={
          celebrate ??
          (newlyEarned
            ? {
                icon: newlyEarned.icon,
                name: newlyEarned.displayName,
                familyName: newlyEarned.familyName,
                earnedAt: newlyEarned.earnedAt,
                rarityPct: newlyEarned.rarityPct
              }
            : null)
        }
        visible={celebrate !== null || newlyEarned !== null}
        onClose={() => {
          setCelebrate(null);
          dismissNewlyEarned();
        }}
      />
    </View>
  );
}
