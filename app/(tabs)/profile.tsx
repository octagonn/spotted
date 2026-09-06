import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import {
  CalendarDays,
  Camera,
  ChevronDown,
  Dumbbell,
  Globe,
  Grid3x3,
  Lock,
  Menu,
  Tag,
  Trophy,
  Users
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FeaturedTrophies, type FeaturedTrophy } from "@/components/profile/FeaturedTrophies";
import { ProfileContentTabs } from "@/components/profile/ProfileContentTabs";
import { PROFILE_GUTTER, ProfileIdentity } from "@/components/profile/ProfileIdentity";
import { ProfileMediaGrid } from "@/components/profile/ProfileMediaGrid";
import { ProfileStatsRow } from "@/components/profile/ProfileStatsRow";
import { StreakCalendarSection } from "@/components/profile/StreakCalendarSection";
import { StreakPopup } from "@/components/profile/StreakPopup";
import { VisibilityPicker, type Visibility } from "@/components/profile/VisibilityPicker";
import { WeeklySplit } from "@/components/profile/WeeklySplit";
import { appAlert } from "@/components/ui/AppDialog";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { SettingNavRow } from "@/components/ui/SettingRow";
import { Text } from "@/components/ui/Text";
import { useFriends } from "@/hooks/queries/useFriends";
import { useMyProfile } from "@/hooks/queries/useProfile";
import { useSetSplitPublic, useSetVisibility } from "@/hooks/queries/useProfileExtras";
import { restDayMessage, useMarkRestDay } from "@/hooks/queries/useRestDay";
import { useSignedUserPosts } from "@/hooks/queries/useSignedUserPosts";
import { useRecordStreakHighWater, useStreak } from "@/hooks/queries/useStreak";
import { useStreakDays } from "@/hooks/queries/useStreakDays";
import { useTaggedPosts } from "@/hooks/queries/useTaggedPosts";
import { useUserCounts } from "@/hooks/queries/useUserCounts";
import { useWorkouts } from "@/hooks/queries/useWorkouts";
import { useGymStreak } from "@/hooks/useGymStreak";
import { useTrophyProgress } from "@/hooks/useTrophyProgress";
import { shareProfile as shareProfileLink } from "@/lib/share";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { tabBarClearance } from "@/theme/layout";
import { icon, space, tokens } from "@/theme/tokens";

const CALENDAR_OPEN_KEY = "profile-calendar-open";
/** Vertical rhythm between profile sections. */
const SECTION = space[4];

type GridTab = "posts" | "split" | "tagged";
const GRID_TABS = [
  { key: "posts" as const, label: "POSTS", icon: Grid3x3 },
  { key: "split" as const, label: "SPLIT", icon: CalendarDays },
  { key: "tagged" as const, label: "TAGGED", icon: Tag }
];

const VISIBILITY_ICON = { public: Globe, private: Lock, friends: Users } as const;

/**
 * Own profile. Orchestrates data + owner actions and composes the shared
 * profile sections (identity → actions → stats → trophies → nav rows →
 * streak calendar → content tabs). The other-user profile composes the same
 * sections with relationship controls instead of owner controls.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useMyProfile().data;
  const friends = useFriends();
  const posts = useSignedUserPosts(profile?.id);
  const streak = useStreak();
  const streakDays = useStreakDays(profile?.id);
  const markRestDay = useMarkRestDay();
  const setVisibility = useSetVisibility();
  const [streakOpen, setStreakOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [grid, setGrid] = useState<GridTab>("posts");
  // Collapsible calendar — hidden by default; the expanded choice sticks
  // across sessions.
  const [calendarOpen, setCalendarOpen] = useState(false);
  useEffect(() => {
    void AsyncStorage.getItem(CALENDAR_OPEN_KEY).then((v) => {
      if (v === "1") setCalendarOpen(true);
    });
  }, []);
  const toggleCalendar = () => {
    setCalendarOpen((open) => {
      void AsyncStorage.setItem(CALENDAR_OPEN_KEY, open ? "0" : "1").catch(() => undefined);
      return !open;
    });
  };

  // Weekly split data — straight from My Workouts.
  const workouts = useWorkouts(profile?.id);
  const setSplitPublic = useSetSplitPublic();

  // Pull-to-refresh: force-update stats, streaks, posts, split.
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
  const visibility = (profile?.schedule_visibility ?? "friends") as Visibility;
  const VisibilityIcon = VISIBILITY_ICON[visibility] ?? Users;
  const counts = useUserCounts(profile?.id);
  const friendCount = counts.data?.friends ?? friends.data?.length ?? 0;
  // Streak computed from the gym-day posts with a grace window for today, so it
  // never reads 0 the morning after a post.
  const gymStreak = useGymStreak(streakDays.data);
  const currentStreak = gymStreak.count;
  const longestStreak = Math.max(streak.data?.longest_streak ?? 0, currentStreak);
  // Persist a newly-observed high-water so "Longest" survives a streak break.
  useRecordStreakHighWater(currentStreak, streak.data?.longest_streak ?? 0);
  const trophies = useTrophyProgress();
  const featuredTrophies = useMemo<FeaturedTrophy[]>(() => {
    const raw = profile?.featured_trophies;
    return Array.isArray(raw) ? (raw as FeaturedTrophy[]) : [];
  }, [profile?.featured_trophies]);

  // One continuous grid of everything the user has posted.
  const gridPosts = useMemo(
    () =>
      (posts.data ?? [])
        .filter((p) => p.hasMedia)
        .map((p) => ({
          id: p.id,
          mediaUrl: p.media_url,
          thumbnailUrl: p.thumbnailUrl,
          insetUrl: p.inset_url,
          isVideo: p.mediaType === "video"
        })),
    [posts.data]
  );
  const taggedPosts = useMemo(
    () =>
      (tagged.data ?? []).map((p) => ({
        id: p.id,
        mediaUrl: p.media_url,
        thumbnailUrl: p.thumbnail_url,
        isVideo: p.media_type === "video"
      })),
    [tagged.data]
  );

  const openTrophies = () => router.push("/profile-section/trophies" as Href);

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.white} />
        }
        contentContainerStyle={{ paddingTop: insets.top + space[2], paddingBottom: tabBarClearance(insets.bottom) }}
      >
        {/* Top bar: handle + visibility · settings */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: PROFILE_GUTTER,
            paddingBottom: space[4]
          }}
        >
          <Pressable
            onPress={() => setPrivacyOpen(true)}
            haptic="none"
            accessibilityLabel="Change who can see you"
            hitSlop={8}
            style={{ flexDirection: "row", alignItems: "center", gap: space[2], flexShrink: 1 }}
          >
            <VisibilityIcon size={icon.size.xs} color={tokens.text.secondary} strokeWidth={icon.stroke.regular} />
            <Text variant="heading" numberOfLines={1} className="flex-shrink">
              {handle || "you"}
            </Text>
            <ChevronDown size={icon.size.xs} color={tokens.text.tertiary} strokeWidth={icon.stroke.regular} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/settings" as Href)}
            haptic="none"
            accessibilityLabel="Menu"
            hitSlop={6}
          >
            <Menu size={icon.size.md} color={tokens.text.primary} strokeWidth={icon.stroke.regular} />
          </Pressable>
        </View>

        <ProfileIdentity
          name={name}
          handle={handle}
          avatarUrl={profile?.avatar_url}
          // Tapping your own photo goes straight to editing it.
          onAvatarPress={() => router.push("/edit-profile")}
          avatarAccessibilityLabel="Your profile photo. Edit profile"
          postCount={gridPosts.length}
          friendCount={friendCount}
          onPressFriends={() => router.push("/people/friends" as Href)}
          bio={profile?.bio}
          gym={profile?.gym?.name}
          // Tapping the home gym edits it — it used to be reachable only by
          // guessing it lived inside Edit profile.
          onPressGym={() => router.push("/edit-profile")}
          socialLinks={profile?.social_links}
        />

        {/* Owner actions */}
        <View style={{ flexDirection: "row", gap: space[2], paddingHorizontal: PROFILE_GUTTER, paddingTop: SECTION }}>
          <Button variant="ghost" style={{ flex: 1 }} onPress={() => router.push("/edit-profile" as Href)}>
            Edit profile
          </Button>
          <Button variant="ghost" style={{ flex: 1 }} onPress={() => shareProfileLink(handle)}>
            Share profile
          </Button>
        </View>

        <View style={{ paddingTop: SECTION }}>
          <ProfileStatsRow
            currentStreak={currentStreak}
            longestStreak={longestStreak}
            trophyCount={trophies.earnedCount}
            onPressStreak={() => setStreakOpen(true)}
            onPressTrophies={openTrophies}
            keepAlive={gymStreak.keepAlive}
          />
        </View>

        {featuredTrophies.length > 0 ? (
          <View style={{ paddingTop: space[3] }}>
            <FeaturedTrophies trophies={featuredTrophies} onPress={openTrophies} />
          </View>
        ) : null}

        {/* Deep links — plain rows, not cards: the content below is the point. */}
        <View style={{ paddingHorizontal: PROFILE_GUTTER, paddingTop: space[2] }}>
          <SettingNavRow
            icon={<Dumbbell size={icon.size.sm} color={tokens.text.primary} strokeWidth={icon.stroke.regular} />}
            title="My Workouts"
            sub="History, records and in-progress sessions"
            onPress={() => router.push("/my-workouts" as Href)}
          />
          <SettingNavRow
            icon={<Trophy size={icon.size.sm} color={tokens.accent.gold} strokeWidth={icon.stroke.regular} />}
            title="Trophies"
            sub={trophies.earnedCount > 0 ? `${trophies.earnedCount} earned` : "Earn your first"}
            onPress={openTrophies}
          />
        </View>

        <View style={{ paddingTop: SECTION }}>
          <StreakCalendarSection
            open={calendarOpen}
            onToggle={toggleCalendar}
            days={streakDays.data instanceof Map ? streakDays.data : undefined}
            createdAt={profile?.created_at}
            onDayPress={(dateKey) => router.push(`/daily/${dateKey}` as Href)}
            // Change of mind: today's rest cell taps through to cancel.
            onRestDayPress={() =>
              appAlert("Cancel today's rest day?", "Your streak goes back to needing a post today.", [
                { text: "Keep resting", style: "cancel" },
                {
                  text: "Cancel rest day",
                  onPress: () =>
                    markRestDay.mutate(false, {
                      onSuccess: (result) => showToast(restDayMessage(result)),
                      onError: () => showToast("Couldn't cancel — try again.")
                    })
                }
              ])
            }
            showHint
          />
        </View>

        <View style={{ marginTop: SECTION }}>
          <ProfileContentTabs tabs={GRID_TABS} value={grid} onChange={setGrid} />
        </View>
        {grid === "split" ? (
          <View style={{ paddingTop: space[3] }}>
            <WeeklySplit
              workouts={workouts.data ?? []}
              gymDays={streakDays.data instanceof Map ? streakDays.data : undefined}
              isLoading={workouts.isLoading}
              ownProfile
              splitPublic={profile?.split_public ?? true}
              onTogglePublic={(next) => setSplitPublic.mutate(next)}
            />
          </View>
        ) : grid === "posts" ? (
          <ProfileMediaGrid
            posts={gridPosts}
            isLoading={posts.isLoading}
            onPressPost={(id) => router.push(`/profile-posts/${id}` as Href)}
            empty={{ icon: Camera, title: "No posts yet", body: "Your daily SPOTTED drops land here." }}
          />
        ) : (
          <ProfileMediaGrid
            posts={taggedPosts}
            isLoading={tagged.isLoading}
            // One swipeable feed over ALL tagged posts, landing on this one.
            onPressPost={(id) => router.push(`/tagged-posts/${id}?user=${profile?.id}` as Href)}
            empty={{ icon: Tag, title: "No tagged posts yet" }}
            skeletonCount={6}
          />
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
