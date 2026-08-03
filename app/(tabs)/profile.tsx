import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { useRouter, type Href } from "expo-router";
import { CalendarDays, Camera, ChevronDown, ChevronRight, Flame, Globe, Grid3x3, Lock, MapPin, Menu, Play, Plus, Tag, Trophy, Users } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { LayoutAnimation, Linking, RefreshControl, ScrollView, Share, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CalendarTapHint } from "@/components/profile/CalendarTapHint";
import { StreakCalendar } from "@/components/profile/StreakCalendar";
import { WeeklySplit } from "@/components/profile/WeeklySplit";
import { StreakPopup } from "@/components/profile/StreakPopup";
import { VisibilityPicker, type Visibility } from "@/components/profile/VisibilityPicker";
import { Avatar } from "@/components/ui/Avatar";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { useFriends } from "@/hooks/queries/useFriends";
import { useUserCounts } from "@/hooks/queries/useUserCounts";
import { useMyProfile } from "@/hooks/queries/useProfile";
import { useHasActiveStory, useSetSplitPublic, useSetVisibility } from "@/hooks/queries/useProfileExtras";
import { useWorkouts } from "@/hooks/queries/useWorkouts";
import { useSignedUserPosts } from "@/hooks/queries/useSignedUserPosts";
import { useQueryClient } from "@tanstack/react-query";
import { useRecordStreakHighWater, useStreak } from "@/hooks/queries/useStreak";
import { useStreakDays } from "@/hooks/queries/useStreakDays";
import { useTaggedPosts } from "@/hooks/queries/useTaggedPosts";
import { useTrophyProgress } from "@/hooks/useTrophyProgress";
import { parseSocialLinks, socialEntries } from "@/lib/socialLinks";
import { computeGymStreak } from "@/lib/streak";
import { localDateKey } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { radius as R, tokens } from "@/theme/tokens";

const NAV_H = 84;
const RADIUS = 16;
const CALENDAR_OPEN_KEY = "profile-calendar-open";
// Vertical rhythm between sections — generous so the page scrolls as one piece.
const SECTION = 30;

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const gridCellW = Math.floor(width / 3); // exact third -> always 3 columns
  // Adapt to narrow phones (SE-class ≈ 320–375) without breaking wide ones.
  const compact = width < 360;
  const H = compact ? 16 : 18;
  const avatarOuter = compact ? 82 : 92;
  const ring = avatarOuter - 4;
  const profile = useMyProfile().data;
  const friends = useFriends();
  const posts = useSignedUserPosts(profile?.id);
  const streak = useStreak();
  const streakDays = useStreakDays(profile?.id);
  const hasStory = useHasActiveStory(profile?.id);
  const setVisibility = useSetVisibility();
  const [streakOpen, setStreakOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [grid, setGrid] = useState<"posts" | "split" | "tagged">("posts");
  // Collapsible calendar (spec #3) — hidden by default; the expanded choice
  // sticks across sessions. Expand/collapse animates (LayoutAnimation).
  const [calendarOpen, setCalendarOpen] = useState(false);
  useEffect(() => {
    void AsyncStorage.getItem(CALENDAR_OPEN_KEY).then((v) => {
      if (v === "1") setCalendarOpen(true);
    });
  }, []);
  const toggleCalendar = () => {
    LayoutAnimation.configureNext(LayoutAnimation.create(260, "easeInEaseOut", "opacity"));
    setCalendarOpen((open) => {
      void AsyncStorage.setItem(CALENDAR_OPEN_KEY, open ? "0" : "1").catch(() => undefined);
      return !open;
    });
  };

  // Weekly split data — straight from My Workouts (spec #6).
  const workouts = useWorkouts(profile?.id);
  const setSplitPublic = useSetSplitPublic();

  // Pull-to-refresh (spec #20): force-update stats, streaks, posts, split.
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["profile"] }),
      queryClient.invalidateQueries({ queryKey: ["user-posts"] }),
      queryClient.invalidateQueries({ queryKey: ["streak"] }),
      queryClient.invalidateQueries({ queryKey: ["streak-days"] }),
      queryClient.invalidateQueries({ queryKey: ["tagged-posts"] }),
      queryClient.invalidateQueries({ queryKey: ["workouts"] }),
      queryClient.invalidateQueries({ queryKey: ["user-lifts"] })
    ]);
    setRefreshing(false);
  };
  const tagged = useTaggedPosts(profile?.id, grid === "tagged");

  const name = profile?.display_name ?? "";
  const handle = profile?.username ?? "";
  const bio = profile?.bio ?? null;
  const gym = profile?.gym?.name ?? null;
  const visibility = (profile?.schedule_visibility ?? "friends") as Visibility;
  const counts = useUserCounts(profile?.id);
  const friendCount = counts.data?.friends ?? friends.data?.length ?? 0;
  const postCount = (posts.data ?? []).filter((p) => p.hasMedia).length;
  // Streak computed from the gym-day posts with a grace window for today, so it
  // never reads 0 the morning after a post.
  const gymStreak = useMemo(
    () => computeGymStreak(streakDays.data ? streakDays.data.keys() : []),
    [streakDays.data]
  );
  const currentStreak = gymStreak.count;
  const longestStreak = Math.max(streak.data?.longest_streak ?? 0, currentStreak);
  // Persist a newly-observed high-water so "Longest" survives a streak break.
  useRecordStreakHighWater(currentStreak, streak.data?.longest_streak ?? 0);
  const trophies = useTrophyProgress();
  const hasActiveStory = hasStory.data ?? false;
  const socials = useMemo(() => socialEntries(parseSocialLinks(profile?.social_links)), [profile?.social_links]);
  // Featured trophies pinned to the header (spec C).
  const featuredTrophies = useMemo(() => {
    const raw = profile?.featured_trophies;
    return Array.isArray(raw) ? (raw as { icon: string; name: string; familyName: string | null }[]) : [];
  }, [profile?.featured_trophies]);

  // One continuous grid of everything the user has posted.
  const gridPosts = useMemo(() => (posts.data ?? []).filter((p) => p.hasMedia), [posts.data]);

  const openAvatarStory = () => {
    if (hasActiveStory && profile) router.push(`/story?user=${profile.id}`);
    else router.push("/camera?mode=story");
  };

  const shareProfile = () => {
    void Share.share({ message: `Check out @${handle} on Spotted` });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.white} />}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: NAV_H + insets.bottom + 12 }}
      >
        {/* Top bar: username + lock, add-story, menu */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: H,
            paddingBottom: 18
          }}
        >
          <Pressable
            onPress={() => setPrivacyOpen(true)}
            accessibilityLabel="Change who can see you"
            hitSlop={8}
            style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
          >
            {visibility === "public" ? (
              <Globe size={16} color={colors.silver} strokeWidth={2.2} />
            ) : visibility === "private" ? (
              <Lock size={16} color={colors.silver} strokeWidth={2.2} />
            ) : (
              <Users size={16} color={colors.silver} strokeWidth={2.2} />
            )}
            <Text style={{ fontFamily: "Boldonse_400Regular", fontSize: 20, color: colors.white }}>
              {handle || "you"}
            </Text>
            <ChevronDown size={16} color={colors.fog} strokeWidth={2.2} />
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <Pressable onPress={() => router.push("/camera?mode=story")} accessibilityLabel="Add story" hitSlop={6}>
              <Plus size={23} color={colors.white} strokeWidth={2} />
            </Pressable>
            <Pressable onPress={() => router.push("/settings" as Href)} accessibilityLabel="Menu" hitSlop={6}>
              <Menu size={23} color={colors.white} strokeWidth={2} />
            </Pressable>
          </View>
        </View>

        {/* Avatar + stats */}
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: H }}>
          <Pressable onPress={openAvatarStory} accessibilityLabel="Your story">
            <View style={{ width: avatarOuter, height: avatarOuter, alignItems: "center", justifyContent: "center" }}>
              <View
                style={{
                  width: ring,
                  height: ring,
                  borderRadius: ring / 2,
                  borderWidth: hasActiveStory ? 2.5 : 0,
                  borderColor: colors.white,
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Avatar name={name || "?"} uri={profile?.avatar_url} size={hasActiveStory ? avatarOuter - 14 : avatarOuter - 8} />
              </View>
              {!hasActiveStory ? (
                <View
                  style={{
                    position: "absolute",
                    right: 3,
                    bottom: 3,
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: colors.white,
                    borderWidth: 3,
                    borderColor: colors.black,
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Plus size={13} color={colors.black} strokeWidth={3} />
                </View>
              ) : null}
            </View>
          </Pressable>

          <View style={{ flex: 1, flexDirection: "row", paddingLeft: 8 }}>
            <Stat value={postCount} label="posts" onPress={() => {}} />
            <Stat value={friendCount} label="friends" onPress={() => router.push("/people/friends" as Href)} />
          </View>
        </View>

        {/* Name, bio, gym, socials */}
        <View style={{ paddingHorizontal: H, paddingTop: 16 }}>
          {name ? (
            <Text style={{ fontFamily: "Geist_700Bold", fontSize: 17, color: colors.white }}>{name}</Text>
          ) : null}
          {bio ? (
            <Text style={{ marginTop: 6, fontFamily: "Geist_400Regular", fontSize: 15, lineHeight: 15 * 1.4, color: colors.mist }}>
              {bio}
            </Text>
          ) : null}
          {gym ? (
            <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <MapPin size={14} color={colors.silver} strokeWidth={2} />
              <Text style={{ fontFamily: "Geist_400Regular", fontSize: 14, color: colors.silver }}>{gym}</Text>
            </View>
          ) : null}
          {socials.length ? (
            <View style={{ marginTop: 14, flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {socials.map(({ meta, url }) => (
                <Pressable
                  key={meta.key}
                  onPress={() => void Linking.openURL(url)}
                  accessibilityLabel={meta.label}
                  hitSlop={6}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: colors.iron,
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <meta.icon size={17} color={colors.silver} strokeWidth={2} />
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {/* Edit / Share — recessed, equal-width, 44pt outline buttons */}
        <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: H, paddingTop: 18 }}>
          <Button
            variant="ghost"
            style={{ flex: 1, height: 44, paddingVertical: 0, borderRadius: RADIUS, borderColor: colors.iron }}
            onPress={() => router.push("/edit-profile" as Href)}
          >
            Edit profile
          </Button>
          <Button
            variant="ghost"
            style={{ flex: 1, height: 44, paddingVertical: 0, borderRadius: RADIUS, borderColor: colors.iron }}
            onPress={shareProfile}
          >
            Share profile
          </Button>
        </View>

        {/* Inline stats — Instagram treatment, no backgrounds, no dividers */}
        <View style={{ paddingHorizontal: H, paddingTop: SECTION }}>
          <View style={{ flexDirection: "row" }}>
            <InlineStat
              value={currentStreak}
              unit="days"
              label="Gym streak"
              icon={<Flame size={13} color={colors.gold} strokeWidth={2.2} />}
              onPress={() => setStreakOpen(true)}
            />
            <InlineStat value={longestStreak} unit="days" label="Longest" />
            <InlineStat
              value={trophies.earnedCount}
              label="Trophies"
              icon={<Trophy size={13} color={tokens.accent.gold} strokeWidth={2} />}
              onPress={() => router.push("/profile-section/trophies" as Href)}
            />
          </View>
          {gymStreak.keepAlive ? (
            <Text style={{ marginTop: 12, fontFamily: "Geist_500Medium", fontSize: 12, color: colors.gold, textAlign: "center" }}>
              {currentStreak} {currentStreak === 1 ? "day" : "days"} — keep it alive. Post today.
            </Text>
          ) : null}

          {/* Featured trophies (spec C) — up to 3 pinned; tap opens the case. */}
          {featuredTrophies.length > 0 ? (
            <Pressable
              onPress={() => router.push("/profile-section/trophies" as Href)}
              accessibilityLabel="Featured trophies"
              style={{ marginTop: 14, flexDirection: "row", justifyContent: "center", gap: 10 }}
            >
              {featuredTrophies.slice(0, 3).map((t, i) => (
                <View
                  key={`${t.name}-${i}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingVertical: 6,
                    paddingHorizontal: 11,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: "rgba(232,180,76,0.4)",
                    backgroundColor: tokens.accent.goldSubtle
                  }}
                >
                  <Trophy size={12} color={tokens.accent.gold} strokeWidth={2} />
                  <Text numberOfLines={1} style={{ fontFamily: "Geist_600SemiBold", fontSize: 11.5, color: colors.gold, maxWidth: 90 }}>
                    {t.name}
                  </Text>
                </View>
              ))}
            </Pressable>
          ) : null}
        </View>

        {/* Streak calendar — the hero, the one contained surface. Collapsible;
            the header row always shows so it can be reopened. */}
        <View style={{ paddingTop: SECTION }}>
          <View
            style={{
              marginHorizontal: H,
              borderRadius: RADIUS,
              backgroundColor: colors.ink,
              paddingVertical: calendarOpen ? 16 : 4,
              overflow: "hidden"
            }}
          >
            <Pressable
              accessibilityLabel={calendarOpen ? "Collapse streak calendar" : "Expand streak calendar"}
              onPress={toggleCalendar}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingHorizontal: 16,
                paddingVertical: calendarOpen ? 0 : 10,
                paddingBottom: calendarOpen ? 8 : 10
              }}
            >
              <Flame size={13} color={colors.gold} strokeWidth={2.2} />
              <Text style={{ flex: 1, fontFamily: "Geist_600SemiBold", fontSize: 12.5, letterSpacing: 1, textTransform: "uppercase", color: colors.mist }}>
                Streak calendar
              </Text>
              {calendarOpen ? (
                <ChevronDown size={16} color={colors.fog} />
              ) : (
                <ChevronRight size={16} color={colors.fog} />
              )}
            </Pressable>
            {calendarOpen ? (
              <StreakCalendar
                days={streakDays.data ?? new Map()}
                createdAt={profile?.created_at}
                onDayPress={(dateKey) => router.push(`/daily/${dateKey}` as Href)}
              />
            ) : null}
          </View>
          {calendarOpen ? (
            <View style={{ paddingHorizontal: H }}>
              <CalendarTapHint />
            </View>
          ) : null}
        </View>

        {/* Trophies — recessed outline */}
        <View style={{ paddingHorizontal: H, paddingTop: SECTION }}>
          <AchievementButton
            icon={Trophy}
            label="Trophies"
            onPress={() => router.push("/profile-section/trophies" as Href)}
          />
        </View>

        {/* Posts / Split / Tagged tab bar — below the calendar + trophies. */}
        <View style={{ marginTop: SECTION, borderTopWidth: 1, borderTopColor: colors.graphite, flexDirection: "row" }}>
          <ProfileTab active={grid === "posts"} icon={Grid3x3} label="POSTS" onPress={() => setGrid("posts")} />
          <ProfileTab active={grid === "split"} icon={CalendarDays} label="SPLIT" onPress={() => setGrid("split")} />
          <ProfileTab active={grid === "tagged"} icon={Tag} label="TAGGED" onPress={() => setGrid("tagged")} />
        </View>
        {grid === "split" ? (
          <View style={{ paddingTop: 14 }}>
            <WeeklySplit
              workouts={workouts.data ?? []}
              isLoading={workouts.isLoading}
              ownProfile
              splitPublic={profile?.split_public ?? true}
              onTogglePublic={(next) => setSplitPublic.mutate(next)}
            />
          </View>
        ) : grid === "posts" ? (
          gridPosts.length ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", paddingTop: 2 }}>
              {gridPosts.map((post) => (
                <Pressable
                  key={post.id}
                  style={{ width: gridCellW, aspectRatio: 4 / 5, padding: 1 }}
                  onPress={() => router.push(`/profile-posts/${post.id}` as Href)}
                >
                  <GridCell post={{ media_url: post.media_url, media_type: post.mediaType, thumbnail_url: post.thumbnailUrl }} />
                </Pressable>
              ))}
            </View>
          ) : posts.isLoading ? (
            <View style={{ paddingTop: 2 }}>
              <SkeletonGrid count={9} />
            </View>
          ) : (
            <View style={{ alignItems: "center", paddingTop: 44, paddingHorizontal: 40 }}>
              <Camera size={26} color={tokens.text.tertiary} strokeWidth={1.8} />
              <Text style={{ marginTop: 12, fontFamily: "Geist_400Regular", fontSize: 14, color: tokens.text.tertiary, textAlign: "center", lineHeight: 20 }}>
                No posts yet
              </Text>
            </View>
          )
        ) : tagged.data?.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", paddingTop: 2 }}>
            {tagged.data.map((post) => (
              <Pressable
                key={post.id}
                style={{ width: "33.333%", aspectRatio: 4 / 5, padding: 1 }}
                onPress={() =>
                  router.push(
                    `/daily/${localDateKey(new Date(post.created_at))}?user=${post.user_id}&post=${post.id}` as Href
                  )
                }
              >
                <GridCell post={{ media_url: post.media_url, media_type: "image", thumbnail_url: null }} />
              </Pressable>
            ))}
          </View>
        ) : tagged.isLoading ? (
          <View style={{ paddingTop: 2 }}>
            <SkeletonGrid count={6} />
          </View>
        ) : (
          <View style={{ alignItems: "center", paddingTop: 44, paddingHorizontal: 40 }}>
            <Tag size={26} color={tokens.text.tertiary} strokeWidth={1.8} />
            <Text style={{ marginTop: 12, fontFamily: "Geist_400Regular", fontSize: 14, color: tokens.text.tertiary, textAlign: "center", lineHeight: 20 }}>
              No tagged posts yet
            </Text>
          </View>
        )}
      </ScrollView>
      <StreakPopup
        visible={streakOpen}
        name={name || "You"}
        streak={currentStreak}
        onClose={() => setStreakOpen(false)}
      />
      <VisibilityPicker
        visible={privacyOpen}
        current={visibility}
        onSelect={(v) => {
          setVisibility.mutate(v);
          setPrivacyOpen(false);
        }}
        onClose={() => setPrivacyOpen(false)}
      />
    </View>
  );
}

function InlineStat({
  value,
  unit,
  label,
  icon,
  onPress
}: {
  value: number;
  unit?: string;
  label: string;
  icon?: React.ReactNode;
  onPress?: () => void;
}) {
  const body = (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        {icon}
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 3 }}>
          <Text style={{ fontFamily: "Geist_700Bold", fontSize: 20, color: colors.white }}>{value}</Text>
          {unit ? <Text style={{ fontFamily: "Geist_400Regular", fontSize: 11.5, color: colors.fog }}>{unit}</Text> : null}
        </View>
      </View>
      <Text style={{ marginTop: 5, fontFamily: "Geist_400Regular", fontSize: 12.5, color: colors.fog }}>{label}</Text>
    </>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityLabel={label} haptic={false} style={{ flex: 1, alignItems: "center" }}>
        {body}
      </Pressable>
    );
  }
  return <View style={{ flex: 1, alignItems: "center" }}>{body}</View>;
}

function AchievementButton({
  icon: Icon,
  label,
  onPress
}: {
  icon: typeof Grid3x3;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }} accessibilityLabel={label}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          height: 52,
          borderRadius: R.md,
          borderWidth: 1,
          borderColor: tokens.border.default,
          backgroundColor: tokens.bg.raised
        }}
      >
        <Icon size={20} color={tokens.accent.gold} strokeWidth={2} />
        <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 16, color: tokens.text.primary }}>{label}</Text>
        <ChevronRight size={18} color={tokens.text.tertiary} strokeWidth={2} style={{ position: "absolute", right: 16 }} />
      </View>
    </Pressable>
  );
}

/**
 * One grid cell. Photos show their image; videos show the poster thumbnail (or
 * a bg.subtle placeholder when none was generated) with a play badge overlay,
 * so video posts never render as blank black cells.
 */
function GridCell({ post }: { post: { media_url: string | null; media_type?: string; thumbnail_url?: string | null } }) {
  const isVideo = post.media_type === "video";
  // Prefer the small thumbnail for ALL grid cells (photos + videos); fall back
  // to the full image only for legacy posts that have no thumbnail yet.
  const src = post.thumbnail_url ?? post.media_url;
  return (
    // Placeholder frame while the image streams in (spec #18) — expo-image
    // decodes async + caches to disk, so cells fade in instead of popping.
    <View style={{ flex: 1, backgroundColor: isVideo && !src ? tokens.bg.subtle : colors.graphite }}>
      {src ? <Image source={{ uri: src }} contentFit="cover" transition={140} cachePolicy="memory-disk" style={{ flex: 1 }} /> : null}
      {isVideo ? (
        <View style={{ position: "absolute", right: 6, bottom: 6 }}>
          <Play size={16} color="rgba(255,255,255,0.9)" fill="rgba(255,255,255,0.9)" strokeWidth={1} />
        </View>
      ) : null}
    </View>
  );
}

function ProfileTab({
  active,
  icon: Icon,
  label,
  onPress
}: {
  active: boolean;
  icon: typeof Grid3x3;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }} haptic={false} accessibilityLabel={label}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          paddingVertical: 12,
          borderBottomWidth: 2,
          borderBottomColor: active ? tokens.text.primary : "transparent"
        }}
      >
        <Icon size={16} color={active ? tokens.text.primary : tokens.text.tertiary} strokeWidth={2} />
        <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 12, letterSpacing: 1, color: active ? tokens.text.primary : tokens.text.tertiary }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function Stat({ value, label, onPress }: { value: number; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1, alignItems: "center", paddingHorizontal: 2 }} haptic={false}>
      <Text style={{ fontFamily: "Geist_700Bold", fontSize: 20, color: colors.white }}>{value}</Text>
      <Text numberOfLines={1} style={{ marginTop: 3, fontFamily: "Geist_400Regular", fontSize: 13, color: colors.silver }}>
        {label}
      </Text>
    </Pressable>
  );
}

