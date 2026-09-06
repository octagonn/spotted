import { Redirect, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Flame, Grid3x3, Lock, MoreHorizontal, Send, Share2, Tag, UserPlus } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Modal, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ContentMenu } from "@/components/ContentMenu";
import { ProfileContentTabs } from "@/components/profile/ProfileContentTabs";
import { PROFILE_GUTTER, ProfileIdentity } from "@/components/profile/ProfileIdentity";
import { ProfileMediaGrid } from "@/components/profile/ProfileMediaGrid";
import { ProfileStatsRow } from "@/components/profile/ProfileStatsRow";
import { StreakCalendarSection } from "@/components/profile/StreakCalendarSection";
import { StreakPopup } from "@/components/profile/StreakPopup";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { CachedImage } from "@/components/ui/CachedImage";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { useSheet } from "@/components/ui/Sheet";
import { Skeleton, SkeletonGrid } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useMutualFriends } from "@/hooks/queries/useFollowing";
import {
  useCancelFriendRequest,
  useRemoveFriend,
  useRespondToRequest,
  useSendFriendRequest
} from "@/hooks/queries/useFriends";
import { usePostedState } from "@/hooks/queries/usePostedState";
import {
  useFriendshipStatus,
  useProfileByUsername,
  useRecordProfileView,
  useUserStreak
} from "@/hooks/queries/useProfile";
import { useSignedUserPosts } from "@/hooks/queries/useSignedUserPosts";
import { useStreakDays } from "@/hooks/queries/useStreakDays";
import { useTaggedPosts } from "@/hooks/queries/useTaggedPosts";
import { useSendTaunt } from "@/hooks/queries/useTaunts";
import { useUserCounts } from "@/hooks/queries/useUserCounts";
import { useGymStreak } from "@/hooks/useGymStreak";
import { useTrophies } from "@/hooks/useTrophies";
import { shareProfile as shareProfileLink } from "@/lib/share";
import { randomTauntLine } from "@/lib/tauntLines";
import { useAuthStore } from "@/stores/auth";
import { relationshipButton, useRelationships } from "@/stores/relationships";
import { localDateKey, showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { icon, radius, space, tokens } from "@/theme/tokens";
import type { RelationshipState } from "@/types/redesign";

const SECTION = space[4];

type GridTab = "posts" | "tagged";
const GRID_TABS = [
  { key: "posts" as const, label: "POSTS", icon: Grid3x3 },
  { key: "tagged" as const, label: "TAGGED", icon: Tag }
];

function backendState(status: ReturnType<typeof useFriendshipStatus>["data"]): RelationshipState {
  if (status === "accepted") return "friend";
  if (status === "pending-outgoing") return "requested";
  if (status === "pending-incoming") return "incoming";
  return "none";
}

/**
 * Read-only profile of another user. Composes the same profile sections as
 * your own profile (identity → stats → calendar → tabs → grid) with
 * relationship controls instead of owner controls. Private accounts show a
 * locked state until you're friends; everyone's content is gated behind
 * posting your own daily (feed-lock philosophy).
 */
export default function UserProfileScreen() {
  const { username = "" } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sheet = useSheet();
  const profileQuery = useProfileByUsername(username);
  const profile = profileQuery.data;
  // Backend-only capture: who viewed this profile, when. Server dedupes
  // within the hour and ignores self/blocked. No UI reads this yet.
  useRecordProfileView(profile?.id);
  const ownUserId = useAuthStore((state) => state.userId);
  const friendship = useFriendshipStatus(profile?.id);
  const posts = useSignedUserPosts(profile?.id);
  const [grid, setGrid] = useState<GridTab>("posts");
  const tagged = useTaggedPosts(profile?.id, grid === "tagged");
  const counts = useUserCounts(profile?.id);
  const streakDays = useStreakDays(profile?.id);
  const userStreak = useUserStreak(profile?.id);
  const mutuals = useMutualFriends(profile?.id);
  const sendRequest = useSendFriendRequest();
  const sendTaunt = useSendTaunt();
  // Taunts only exist to call out friends who HAVEN'T gone yet — once they've
  // posted today's daily, the button disappears. streakDays already holds
  // their daily-drop days, so this costs no extra query.
  const targetWentToday = useMemo(
    () => streakDays.data instanceof Map && streakDays.data.has(localDateKey()),
    [streakDays.data]
  );
  const fireTaunt = () => {
    if (!profile || sendTaunt.isPending || targetWentToday) return;
    const line = randomTauntLine();
    sendTaunt.mutate(
      { targetId: profile.id, lineId: line.id, lineText: line.text, source: "profile" },
      // Errors already toast inside useSendTaunt.
      { onSuccess: () => showToast("Taunt sent") }
    );
  };
  const respondRequest = useRespondToRequest();
  const cancelRequest = useCancelFriendRequest();
  const removeFriend = useRemoveFriend();
  const relationships = useRelationships();
  const [streakOpen, setStreakOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false); // collapsed by default
  const [avatarZoom, setAvatarZoom] = useState(false);
  // You must post your own daily before you can see anyone else's profile
  // below the header (same gate philosophy as the home feed lock).
  const { postedToday, resolved: postedResolved } = usePostedState();

  const key = profile?.id ?? username;
  const initialState = backendState(friendship.data);
  const friendshipResolved = friendship.isSuccess;
  useEffect(() => {
    if (friendshipResolved && profile) {
      relationships.setRelationship(profile.id, backendState(friendship.data));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendshipResolved, profile?.id]);

  const state = relationships.stateFor(key, initialState);
  const isFriend = state === "friend";
  const button = relationshipButton(state);
  const name = profile?.display_name ?? username.replace(/[._]/g, " ");
  const firstName = name.split(" ")[0];
  const handle = profile?.username ?? username;

  // Public accounts are viewable by anyone; private ones unlock only for
  // friends. is_private is the content gate — discoverable only governs
  // search visibility and must not unlock profiles.
  const isPublic = profile?.is_private === false;
  // "Private posts": public, findable account whose content is friends-only.
  const postsPrivate = profile?.posts_private === true;
  const canView = isFriend || (isPublic && !postsPrivate);
  // Identity still loading: don't paint a private/locked verdict (with zeroed
  // counts and no avatar) until profile + friendship have actually resolved.
  const resolving =
    profileQuery.isLoading || (Boolean(profile) && !(isPublic && !postsPrivate) && friendship.isLoading);

  const gymStreak = useGymStreak(streakDays.data);
  const currentStreak = gymStreak.count;
  const longestStreak = Math.max(userStreak.data?.longest_streak ?? 0, currentStreak);
  const friendTrophies = useTrophies(profile?.id);
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
  const postCount = counts.data?.posts ?? gridPosts.length;

  const advance = () => {
    const from = state;
    const transition = relationships.advance(key, name);
    if (!transition || !profile) return;
    if (from === "none" && transition.to === "requested") sendRequest.mutate(profile.id);
    if (from === "incoming" && transition.to === "friend") {
      respondRequest.mutate({ requesterId: profile.id, accept: true });
    }
    // "Added" → tap again withdraws the pending request on the server too.
    if (from === "requested" && transition.to === "none") cancelRequest.mutate(profile.id);
  };

  const unfriend = () => {
    if (!profile) return;
    removeFriend.mutate(profile.id, {
      onSuccess: () => {
        relationships.setRelationship(key, "none");
        showToast(`Removed ${firstName}`);
      }
    });
  };

  const shareProfile = () => shareProfileLink(handle);

  // Report / Block / Remove friend from the profile itself.
  const openOptions = () => {
    if (!profile) return;
    sheet.open(
      <ContentMenu
        contentType="user"
        contentId={profile.id}
        reportLabel="account"
        reportedUserId={profile.id}
        onRemoveFriend={isFriend ? unfriend : undefined}
      />
    );
  };

  if (profile && ownUserId && profile.id === ownUserId) {
    return <Redirect href="/(tabs)/profile" />;
  }

  // Identity still loading — a shaped skeleton instead of a blank header.
  if (profileQuery.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        <PanelHeader title={username} />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: PROFILE_GUTTER,
            paddingTop: space[2],
            gap: space[4]
          }}
        >
          <Skeleton width={88} height={88} radius={44} />
          <View style={{ flex: 1, flexDirection: "row", justifyContent: "space-around" }}>
            <Skeleton width={52} height={34} radius={radius.sm} />
            <Skeleton width={52} height={34} radius={radius.sm} />
          </View>
        </View>
        <View style={{ paddingHorizontal: PROFILE_GUTTER, paddingTop: space[4], gap: space[2] }}>
          <Skeleton width="45%" height={14} />
          <Skeleton width="70%" height={11} />
        </View>
        <View style={{ paddingHorizontal: PROFILE_GUTTER, paddingTop: SECTION, flexDirection: "row", gap: space[2] }}>
          <Skeleton height={44} radius={radius.sm} style={{ flex: 1, width: "auto" }} />
          <Skeleton height={44} radius={radius.sm} style={{ flex: 1, width: "auto" }} />
        </View>
        <View style={{ paddingTop: space[6] }}>
          <SkeletonGrid count={6} />
        </View>
      </View>
    );
  }

  const iconColor = (primary: boolean) => (primary ? colors.black : tokens.text.primary);
  const actionIcon = (Icon: typeof Send, primary = false) => (
    <Icon size={icon.size.xs} color={iconColor(primary)} strokeWidth={icon.stroke.regular} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space[8] }}>
        <PanelHeader title={handle} />

        <View style={{ paddingTop: space[2] }}>
          <ProfileIdentity
            name={name}
            handle={handle}
            avatarUrl={profile?.avatar_url}
            avatarAccessibilityLabel={`${name}'s profile photo`}
            onAvatarPress={profile?.avatar_url ? () => setAvatarZoom(true) : undefined}
            // Hold-to-enlarge (Instagram-style).
            onAvatarLongPress={profile?.avatar_url ? () => setAvatarZoom(true) : undefined}
            postCount={postCount}
            friendCount={counts.data?.friends ?? 0}
            // The COUNT is always visible, but the list only opens when their
            // content is viewable AND they haven't hidden their friends list.
            // The server enforces the same rules in user_friends().
            onPressFriends={
              profile && canView && !profile.friends_list_hidden
                ? () => router.push(`/people/friends?user=${profile.id}` as Href)
                : undefined
            }
            bio={profile?.bio}
            gym={profile?.gym?.name}
            socialLinks={profile?.social_links}
          />
        </View>

        {/* Relationship actions. Friends: Message (primary) · Taunt · Share · More.
            Otherwise: Add/Requested (primary) · Share · More. */}
        <View style={{ paddingHorizontal: PROFILE_GUTTER, paddingTop: SECTION, flexDirection: "row", gap: space[2] }}>
          {isFriend && profile ? (
            <>
              <Button
                style={{ flex: 1 }}
                icon={actionIcon(Send, true)}
                onPress={() => router.push(`/chat/${profile.id}`)}
              >
                Message
              </Button>
              {!targetWentToday ? (
                <Button
                  variant="ghost"
                  style={{ flex: 1 }}
                  icon={actionIcon(Flame)}
                  onPress={fireTaunt}
                  disabled={sendTaunt.isPending}
                  loading={sendTaunt.isPending}
                >
                  Taunt
                </Button>
              ) : null}
              <IconButton icon={actionIcon(Share2)} accessibilityLabel="Share profile" onPress={shareProfile} />
              <IconButton icon={actionIcon(MoreHorizontal)} accessibilityLabel="More options" onPress={openOptions} />
            </>
          ) : (
            <>
              <Button
                variant={button.kind === "primary" ? "solid" : "ghost"}
                style={{ flex: 1 }}
                icon={button.kind === "primary" ? actionIcon(UserPlus, true) : undefined}
                onPress={advance}
                disabled={button.disabled}
              >
                {button.label}
              </Button>
              <Button variant="ghost" style={{ flex: 1 }} icon={actionIcon(Share2)} onPress={shareProfile}>
                Share
              </Button>
              <IconButton icon={actionIcon(MoreHorizontal)} accessibilityLabel="More options" onPress={openOptions} />
            </>
          )}
        </View>

        {/* Mutual friends */}
        {mutuals.data && mutuals.data.length > 0 && profile ? (
          <Pressable
            onPress={() => router.push(`/people/mutuals?user=${profile.id}` as Href)}
            haptic="none"
            accessibilityLabel={`${mutuals.data.length} mutual friends`}
            style={{
              paddingHorizontal: PROFILE_GUTTER,
              paddingTop: space[3],
              flexDirection: "row",
              alignItems: "center",
              gap: space[2]
            }}
          >
            <View style={{ flexDirection: "row" }}>
              {mutuals.data.slice(0, 3).map((m, i) => (
                <View key={m.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                  <Avatar
                    name={m.display_name}
                    uri={m.avatar_url}
                    size={22}
                    borderColor={colors.black}
                    borderWidth={2}
                  />
                </View>
              ))}
            </View>
            <Text variant="meta" numberOfLines={1} className="flex-1">
              <Text variant="meta-strong" className="text-mist">
                {mutuals.data.length} mutual {mutuals.data.length === 1 ? "friend" : "friends"}
              </Text>
              {"  ·  "}
              {mutuals.data
                .slice(0, 2)
                .map((m) => m.display_name.split(" ")[0])
                .join(", ")}
              {mutuals.data.length > 2 ? ` +${mutuals.data.length - 2}` : ""}
            </Text>
          </Pressable>
        ) : null}

        {canView && (postedToday || !postedResolved) ? (
          <>
            <View style={{ paddingTop: space[6] }}>
              <ProfileStatsRow
                currentStreak={currentStreak}
                longestStreak={longestStreak}
                trophyCount={friendTrophies.earnedCount}
                onPressStreak={() => setStreakOpen(true)}
                onPressTrophies={() =>
                  profile &&
                  router.push(
                    `/profile-section/trophies?user=${profile.id}&name=${encodeURIComponent(firstName)}` as Href
                  )
                }
              />
            </View>

            <View style={{ paddingTop: SECTION }}>
              <StreakCalendarSection
                open={calOpen}
                onToggle={() => setCalOpen((v) => !v)}
                days={streakDays.data instanceof Map ? streakDays.data : undefined}
                createdAt={profile?.created_at}
                onDayPress={(dateKey) => profile && router.push(`/daily/${dateKey}?user=${profile.id}` as Href)}
              />
            </View>

            <View style={{ marginTop: SECTION }}>
              <ProfileContentTabs tabs={GRID_TABS} value={grid} onChange={setGrid} />
            </View>
            {grid === "posts" ? (
              <ProfileMediaGrid
                posts={gridPosts}
                isLoading={posts.isLoading}
                onPressPost={(id) => profile && router.push(`/profile-posts/${id}?user=${profile.id}` as Href)}
                empty={{ icon: Grid3x3, title: "No posts yet" }}
                skeletonCount={6}
              />
            ) : (
              <ProfileMediaGrid
                posts={taggedPosts}
                isLoading={tagged.isLoading}
                // One swipeable feed over their tagged posts.
                onPressPost={(id) => profile && router.push(`/tagged-posts/${id}?user=${profile.id}` as Href)}
                empty={{ icon: Tag, title: "No tagged posts yet" }}
                skeletonCount={6}
              />
            )}
          </>
        ) : canView ? (
          // You haven't posted your daily — their content is locked.
          <EmptyState
            tone="gold"
            icon={<Lock size={icon.size.sm + 2} color={tokens.accent.gold} strokeWidth={icon.stroke.regular} />}
            title={`Post to unlock ${firstName}'s profile`}
            body="Drop today's SPOTTED to see their streak, posts, and progress."
            paddingTop={space[10]}
          >
            <Button onPress={() => router.push("/camera?mode=daily")}>Post today&apos;s SPOTTED</Button>
          </EmptyState>
        ) : resolving ? (
          <View style={{ paddingTop: space[6] }}>
            <SkeletonGrid count={6} />
          </View>
        ) : (
          // Private account — locked state.
          <EmptyState
            icon={<Lock size={icon.size.sm + 2} color={tokens.text.secondary} strokeWidth={icon.stroke.regular} />}
            title={isPublic && postsPrivate ? "Posts are friends-only" : "This account is private"}
            body={`Add ${firstName} to see their posts, streak, and progress.`}
            paddingTop={space[10]}
          >
            {state === "none" ? <Button onPress={advance}>Add {firstName}</Button> : null}
          </EmptyState>
        )}
      </ScrollView>

      <StreakPopup visible={streakOpen} name={name} streak={currentStreak} onClose={() => setStreakOpen(false)} />

      {/* Hold-to-enlarge avatar. Full-screen system modal by design — it must
          cover the navigation chrome. */}
      <Modal
        visible={avatarZoom}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarZoom(false)}
        statusBarTranslucent
      >
        <Pressable
          onPress={() => setAvatarZoom(false)}
          haptic="none"
          accessibilityLabel="Close"
          style={{
            flex: 1,
            backgroundColor: colors.black,
            alignItems: "center",
            justifyContent: "center",
            padding: space[8]
          }}
        >
          <View
            style={{
              width: "100%",
              aspectRatio: 1,
              maxWidth: 380,
              borderRadius: radius.lg,
              overflow: "hidden",
              backgroundColor: tokens.bg.raised
            }}
          >
            {profile?.avatar_url ? (
              <CachedImage source={{ uri: profile.avatar_url }} contentFit="cover" style={{ flex: 1 }} />
            ) : null}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
