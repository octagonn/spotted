import { Redirect, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { ChevronDown, Flame, Grid3x3, Lock, MapPin, MoreHorizontal, Send, Share2, Tag, UserPlus, type LucideIcon } from "lucide-react-native";
import { useEffect, useState } from "react";
import { LayoutAnimation, Modal, ScrollView, Text, View , useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ContentMenu } from "@/components/ContentMenu";
import { PostGridCell } from "@/components/profile/PostGridCell";
import { SocialLinksRow } from "@/components/profile/SocialLinksRow";
import { StreakCalendar } from "@/components/profile/StreakCalendar";
import { StreakPopup } from "@/components/profile/StreakPopup";
import { Avatar } from "@/components/ui/Avatar";
import { CachedImage } from "@/components/ui/CachedImage";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { useSheet } from "@/components/ui/Sheet";
import { Skeleton, SkeletonGrid } from "@/components/ui/Skeleton";
import { Stat } from "@/components/ui/Stat";
import { useMutualFriends } from "@/hooks/queries/useFollowing";
import { useCancelFriendRequest, useRemoveFriend, useRespondToRequest, useSendFriendRequest } from "@/hooks/queries/useFriends";
import { useFriendshipStatus, useProfileByUsername, useRecordProfileView, useUserStreak } from "@/hooks/queries/useProfile";
import { useSendTaunt } from "@/hooks/queries/useTaunts";
import { useSignedUserPosts } from "@/hooks/queries/useSignedUserPosts";
import { useTaggedPosts } from "@/hooks/queries/useTaggedPosts";
import { useTrophies } from "@/hooks/useTrophies";
import { useStreakDays } from "@/hooks/queries/useStreakDays";
import { useGymStreak } from "@/hooks/useGymStreak";
import { useStories } from "@/hooks/queries/useStories";
import { usePostedState } from "@/hooks/queries/usePostedState";
import { useUserCounts } from "@/hooks/queries/useUserCounts";
import { shareProfile as shareProfileLink } from "@/lib/share";
import { randomTauntLine } from "@/lib/tauntLines";
import { useAuthStore } from "@/stores/auth";
import { relationshipButton, useRelationships } from "@/stores/relationships";
import { localDateKey, showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";
import type { RelationshipState } from "@/types/redesign";

/** Even, icon-labelled profile action button. `compact` = square icon-only. */
function ActionButton({
  label,
  icon: Icon,
  onPress,
  primary = false,
  disabled = false,
  compact = false
}: {
  label: string;
  icon?: LucideIcon;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} pressScale={0.97} accessibilityLabel={label} style={compact ? undefined : { flex: 1 }}>
      <View
        style={{
          height: 40,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          paddingHorizontal: compact ? 0 : 12,
          width: compact ? 44 : undefined,
          borderRadius: 10,
          borderWidth: primary ? 0 : 1,
          borderColor: colors.iron,
          backgroundColor: primary ? colors.white : "transparent",
          opacity: disabled ? 0.55 : 1
        }}
      >
        {Icon ? <Icon size={16} color={primary ? colors.black : colors.white} strokeWidth={2} /> : null}
        {!compact ? (
          <Text style={{ fontFamily: "Geist_700Bold", fontSize: 13, color: primary ? colors.black : colors.white }}>
            {label}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function backendState(status: ReturnType<typeof useFriendshipStatus>["data"]): RelationshipState {
  if (status === "accepted") return "friend";
  if (status === "pending-outgoing") return "requested";
  if (status === "pending-incoming") return "incoming";
  return "none";
}

/**
 * Read-only public profile — same layout as your own (avatar, stats, name, bio,
 * gym, socials, streak calendar, posts), but with Add/Message/Share instead of
 * editing. Private accounts show a locked state until you're friends.
 */
export default function UserProfileScreen() {
  const { username = "" } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sheet = useSheet();
  const { width: winW } = useWindowDimensions();
  // Exact one-third so the grid is ALWAYS 3 columns on any device (percentages
  // + a gap were rounding up and wrapping to 2).
  const cellW = Math.floor(winW / 3);
  const profileQuery = useProfileByUsername(username);
  const profile = profileQuery.data;
  // Backend-only capture: who viewed this profile, when. Server dedupes
  // within the hour and ignores self/blocked. No UI reads this yet.
  useRecordProfileView(profile?.id);
  const ownUserId = useAuthStore((state) => state.userId);
  const friendship = useFriendshipStatus(profile?.id);
  const posts = useSignedUserPosts(profile?.id);
  const [grid, setGrid] = useState<"posts" | "tagged">("posts");
  const tagged = useTaggedPosts(profile?.id, grid === "tagged");
  const counts = useUserCounts(profile?.id);
  const streakDays = useStreakDays(profile?.id);
  const userStreak = useUserStreak(profile?.id);
  const mutuals = useMutualFriends(profile?.id);
  const stories = useStories();
  const sendRequest = useSendFriendRequest();
  const sendTaunt = useSendTaunt();
  // Taunts only exist to call out friends who HAVEN'T gone yet — once they've
  // posted today's daily, the button flips to a "Went today" pill (same
  // pattern as the friends tab). streakDays already holds their daily-drop
  // days, so this costs no extra query.
  const targetWentToday = streakDays.data instanceof Map && streakDays.data.has(localDateKey());
  // One-button taunt: random line from the 20-line rotation, no picker.
  const fireTaunt = () => {
    if (!profile || sendTaunt.isPending || targetWentToday) return;
    const line = randomTauntLine();
    sendTaunt.mutate(
      { targetId: profile.id, lineId: line.id, lineText: line.text },
      // Errors already toast inside useSendTaunt — a second toast here
      // showed every rejection twice.
      { onSuccess: () => showToast("Taunt sent") }
    );
  };
  const respondRequest = useRespondToRequest();
  const cancelRequest = useCancelFriendRequest();
  const removeFriend = useRemoveFriend();
  const relationships = useRelationships();
  const [streakOpen, setStreakOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false); // streak calendar — collapsed by default
  const toggleCal = () => {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, "easeInEaseOut", "opacity"));
    setCalOpen((v) => !v);
  };
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
  const handle = profile?.username ?? username;
  const bio = profile?.bio ?? null;
  const gym = profile?.gym?.name ?? null;
  const hasActiveStory = Boolean(profile && stories.data?.some((g) => g.userId === profile.id));

  // Public accounts are viewable by anyone; private ones unlock only for
  // friends. is_private is the content gate — discoverable only governs
  // search visibility and must not unlock profiles.
  const isPublic = profile?.is_private === false;
  // "Private posts": public, findable account whose content is friends-only.
  const postsPrivate = profile?.posts_private === true;
  const canView = isFriend || (isPublic && !postsPrivate);
  // Identity still loading: painting the "This account is private" branch
  // (with zeroed counts and no avatar) for a friend's PUBLIC profile during
  // this window was the reported private-profile flash. While resolving,
  // show a quiet loading state instead of any verdict.
  const resolving = profileQuery.isLoading || (Boolean(profile) && !(isPublic && !postsPrivate) && friendship.isLoading);

  const gymStreak = useGymStreak(streakDays.data);
  const currentStreak = gymStreak.count;
  const longestStreak = Math.max(userStreak.data?.longest_streak ?? 0, currentStreak);
  const friendTrophies = useTrophies(profile?.id);
  const trophyCount = friendTrophies.earnedCount;
  const postCount = counts.data?.posts ?? (posts.data ?? []).filter((p) => p.hasMedia).length;
  const gridPosts = (posts.data ?? []).filter((p) => p.hasMedia);

  const advance = () => {
    const from = state;
    const transition = relationships.advance(key, name);
    if (!transition || !profile) return;
    if (from === "none" && transition.to === "requested") sendRequest.mutate(profile.id);
    if (from === "incoming" && transition.to === "friend") {
      respondRequest.mutate({ requesterId: profile.id, accept: true });
    }
    // "Added" → tap again withdraws. The store flipped and toasted, but the
    // pending row never left the server, so the request came back on reload
    // ("unadding people doesn't work").
    if (from === "requested" && transition.to === "none") cancelRequest.mutate(profile.id);
  };

  const unfriend = () => {
    if (!profile) return;
    removeFriend.mutate(profile.id, {
      onSuccess: () => {
        relationships.setRelationship(key, "none");
        showToast(`Removed ${name.split(" ")[0]}`);
      }
    });
  };

  const shareProfile = () => {
    shareProfileLink(handle);
  };

  // Report / Block from the profile itself — blocking used to be reachable
  // only from an open DM thread.
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

  // Identity still loading — a shaped skeleton instead of the blank header
  // (zeroed counts + no avatar) testers saw for a few seconds.
  if (profileQuery.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        <PanelHeader title={username} />
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingTop: 8, gap: 18 }}>
          <Skeleton width={88} height={88} radius={44} />
          <View style={{ flex: 1, flexDirection: "row", justifyContent: "space-around" }}>
            <Skeleton width={52} height={34} radius={8} />
            <Skeleton width={52} height={34} radius={8} />
          </View>
        </View>
        <View style={{ paddingHorizontal: 18, paddingTop: 16, gap: 8 }}>
          <Skeleton width="45%" height={14} />
          <Skeleton width="70%" height={11} />
        </View>
        <View style={{ paddingHorizontal: 18, paddingTop: 18, flexDirection: "row", gap: 8 }}>
          <Skeleton height={40} radius={10} style={{ flex: 1, width: "auto" }} />
          <Skeleton height={40} radius={10} style={{ flex: 1, width: "auto" }} />
        </View>
        <View style={{ paddingTop: 24 }}>
          <SkeletonGrid count={6} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}>
        <PanelHeader title={handle} />

        {/* Avatar + stats */}
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingTop: 8 }}>
          <Pressable
            disabled={!hasActiveStory && !profile?.avatar_url}
            accessibilityLabel={hasActiveStory ? `${name}'s profile photo, has a story` : `${name}'s profile photo`}
            onPress={() => {
              if (hasActiveStory && profile) router.push(`/story?user=${profile.id}`);
              else if (profile?.avatar_url) setAvatarZoom(true);
            }}
            onLongPress={() => profile?.avatar_url && setAvatarZoom(true)}
            delayLongPress={220}
          >
            <View
              style={{
                width: 88,
                height: 88,
                borderRadius: 44,
                borderWidth: hasActiveStory ? 2.5 : 0,
                borderColor: colors.white,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Avatar name={name} uri={profile?.avatar_url} size={hasActiveStory ? 78 : 84} />
            </View>
          </Pressable>
          <View style={{ flex: 1, flexDirection: "row", paddingLeft: 6 }}>
            <Stat size="sm" value={postCount} label="posts" />
            <Stat size="sm"
              value={counts.data?.friends ?? 0}
              label="friends"
              // The COUNT is always visible (IG model), but the list only
              // opens when their content is viewable (public, or you're
              // friends) AND they haven't hidden their friends list. The
              // server enforces the same rules in user_friends().
              onPress={
                profile && canView && !profile.friends_list_hidden
                  ? () => router.push(`/people/friends?user=${profile.id}` as Href)
                  : undefined
              }
            />
          </View>
        </View>

        {/* Name, bio, gym, socials */}
        <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>
          <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 15, color: colors.white }}>{name}</Text>
          {bio ? (
            <Text style={{ marginTop: 5, fontFamily: "Geist_400Regular", fontSize: 13.5, lineHeight: 13.5 * 1.45, color: colors.mist }}>
              {bio}
            </Text>
          ) : null}
          {gym ? (
            <View style={{ marginTop: 7, flexDirection: "row", alignItems: "center", gap: 5 }}>
              <MapPin size={12} color={colors.fog} strokeWidth={2} />
              <Text style={{ fontFamily: "Geist_400Regular", fontSize: 12, color: colors.fog }}>{gym}</Text>
            </View>
          ) : null}
          <SocialLinksRow links={profile?.social_links} />
        </View>

        {/* Action row — even, icon-labelled buttons. Friends: Message (primary)
            + Taunt + Share. Otherwise: Add/Following (primary) + Share. */}
        <View style={{ paddingHorizontal: 18, paddingTop: 16, flexDirection: "row", gap: 8 }}>
          {isFriend && profile ? (
            <>
              <ActionButton primary label="Message" icon={Send} onPress={() => router.push(`/chat/${profile.id}`)} />
              {/* Taunts only exist to call out no-shows — once they've posted
                  today, the button disappears entirely. */}
              {!targetWentToday ? (
                <ActionButton
                  label={sendTaunt.isPending ? "Sending…" : "Taunt"}
                  icon={Flame}
                  onPress={fireTaunt}
                  disabled={sendTaunt.isPending}
                />
              ) : null}
              <ActionButton label="Share" icon={Share2} onPress={shareProfile} compact />
              <ActionButton label="More options" icon={MoreHorizontal} onPress={openOptions} compact />
            </>
          ) : (
            <>
              <ActionButton
                primary={button.kind === "primary"}
                label={button.label}
                icon={button.kind === "primary" ? UserPlus : undefined}
                onPress={advance}
                disabled={button.disabled}
              />
              <ActionButton label="Share" icon={Share2} onPress={shareProfile} />
              <ActionButton label="More options" icon={MoreHorizontal} onPress={openOptions} compact />
            </>
          )}
        </View>

        {/* Mutual friends row */}
        {mutuals.data && mutuals.data.length > 0 && profile ? (
          <Pressable
            onPress={() => router.push(`/people/mutuals?user=${profile.id}` as Href)}
            style={{ paddingHorizontal: 18, paddingTop: 14, flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <View style={{ flexDirection: "row" }}>
              {mutuals.data.slice(0, 3).map((m, i) => (
                <View key={m.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                  <Avatar name={m.display_name} uri={m.avatar_url} size={22} borderColor={colors.black} borderWidth={2} />
                </View>
              ))}
            </View>
            <Text style={{ flex: 1, fontFamily: "Geist_400Regular", fontSize: 12.5, color: colors.silver }} numberOfLines={1}>
              <Text style={{ color: colors.mist }}>{mutuals.data.length} mutual {mutuals.data.length === 1 ? "friend" : "friends"}</Text>
              {"  ·  "}
              {mutuals.data.slice(0, 2).map((m) => m.display_name.split(" ")[0]).join(", ")}
              {mutuals.data.length > 2 ? ` +${mutuals.data.length - 2}` : ""}
            </Text>
          </Pressable>
        ) : null}

        {canView && (postedToday || !postedResolved) ? (
          <>
            {/* Inline stats */}
            <View style={{ paddingHorizontal: 18, paddingTop: 24, flexDirection: "row" }}>
              <Stat
                size="sm"
                value={currentStreak}
                unit="days"
                label="Gym streak"
                icon={<Flame size={13} color={colors.gold} strokeWidth={2.2} />}
                onPress={() => setStreakOpen(true)}
              />
              <Stat size="sm" value={longestStreak} unit="days" label="Longest" />
              <Stat size="sm"
                value={trophyCount}
                label="Trophies"
                onPress={() =>
                  profile &&
                  router.push(`/profile-section/trophies?user=${profile.id}&name=${encodeURIComponent(profile.display_name.split(" ")[0])}` as Href)
                }
              />
            </View>

            {/* Streak calendar — collapsible, collapsed by default. */}
            <View style={{ paddingTop: 24 }}>
              <View style={{ marginHorizontal: 18, borderRadius: 16, backgroundColor: colors.ink, overflow: "hidden" }}>
                <Pressable onPress={toggleCal} accessibilityRole="button" accessibilityState={{ expanded: calOpen }}>
                  <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 }}>
                    <Flame size={15} color={colors.gold} strokeWidth={2.2} />
                    <Text style={{ marginLeft: 8, flex: 1, fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.white }}>
                      Streak calendar
                    </Text>
                    <ChevronDown size={17} color={colors.fog} strokeWidth={2} style={{ transform: [{ rotate: calOpen ? "180deg" : "0deg" }] }} />
                  </View>
                </Pressable>
                {calOpen ? (
                  <View style={{ paddingBottom: 16 }}>
                    <StreakCalendar
                      days={streakDays.data instanceof Map ? streakDays.data : new Map()}
                      createdAt={profile?.created_at}
                      onDayPress={(dateKey) => profile && router.push(`/daily/${dateKey}?user=${profile.id}` as Href)}
                    />
                  </View>
                ) : null}
              </View>
            </View>

            {/* Posts / Tagged tabs (same as your own profile) */}
            <View style={{ marginTop: 22, borderTopWidth: 1, borderTopColor: colors.graphite, flexDirection: "row" }}>
              <UserProfileTab active={grid === "posts"} icon={Grid3x3} label="POSTS" onPress={() => setGrid("posts")} />
              <UserProfileTab active={grid === "tagged"} icon={Tag} label="TAGGED" onPress={() => setGrid("tagged")} />
            </View>
            {grid === "posts" ? (
              gridPosts.length ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", paddingTop: 2 }}>
                  {gridPosts.map((post) => (
                    <Pressable
                      key={post.id}
                      style={{ width: cellW, aspectRatio: 4 / 5, padding: 1 }}
                      accessibilityLabel="Open post"
                      onPress={() => profile && router.push(`/profile-posts/${post.id}?user=${profile.id}` as Href)}
                    >
                      <PostGridCell
                        mediaUrl={post.media_url}
                        thumbnailUrl={post.thumbnailUrl}
                        insetUrl={post.inset_url}
                        isVideo={post.mediaType === "video"}
                      />
                    </Pressable>
                  ))}
                </View>
              ) : posts.isLoading ? (
                <View style={{ paddingTop: 2 }}>
                  <SkeletonGrid count={6} />
                </View>
              ) : (
                <View style={{ alignItems: "center", paddingTop: 40, paddingHorizontal: 40 }}>
                  <Text style={{ fontSize: 13, color: colors.fog, textAlign: "center" }}>No posts yet.</Text>
                </View>
              )
            ) : tagged.data?.length ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", paddingTop: 2 }}>
                {tagged.data.map((post) => (
                  <Pressable
                    key={post.id}
                    style={{ width: cellW, aspectRatio: 4 / 5, padding: 1 }}
                    accessibilityLabel="Open post"
                    // One swipeable feed over their tagged posts — see
                    // /tagged-posts/[postId].
                    onPress={() => profile && router.push(`/tagged-posts/${post.id}?user=${profile.id}` as Href)}
                  >
                    <PostGridCell
                      mediaUrl={post.media_url}
                      thumbnailUrl={post.thumbnail_url}
                      isVideo={post.media_type === "video"}
                    />
                  </Pressable>
                ))}
              </View>
            ) : tagged.isLoading ? (
              <View style={{ paddingTop: 2 }}>
                <SkeletonGrid count={6} />
              </View>
            ) : (
              <View style={{ alignItems: "center", paddingTop: 40, paddingHorizontal: 40 }}>
                <Text style={{ fontSize: 13, color: colors.fog, textAlign: "center" }}>
                  No tagged posts yet.
                </Text>
              </View>
            )}
          </>
        ) : canView ? (
          // You haven't posted your daily — their content is locked (feed-lock
          // philosophy: post to see others).
          <EmptyState
            tone="gold"
            icon={<Lock size={22} color={colors.gold} strokeWidth={2} />}
            title={`Post to unlock ${name.split(" ")[0]}'s profile`}
            body="Drop today's SPOTTED to see their streak, posts, and progress."
            paddingTop={40}
          >
            <Button onPress={() => router.push("/camera?mode=daily")}>Post today&apos;s SPOTTED</Button>
          </EmptyState>
        ) : resolving ? (
          // Don't render a private/locked verdict until profile + friendship
          // have actually loaded.
          <View style={{ paddingTop: 24 }}>
            <SkeletonGrid count={6} />
          </View>
        ) : (
          // Private account — locked state.
          <EmptyState
            icon={<Lock size={22} color={colors.silver} strokeWidth={2} />}
            title={isPublic && postsPrivate ? "Posts are friends-only" : "This account is private"}
            body={`Add ${name.split(" ")[0]} to see their posts, streak, and progress.`}
            paddingTop={40}
          >
            {state === "none" ? <Button onPress={advance}>Add {name.split(" ")[0]}</Button> : null}
          </EmptyState>
        )}
      </ScrollView>

      <StreakPopup visible={streakOpen} name={name} streak={currentStreak} onClose={() => setStreakOpen(false)} />

      {/* Hold-to-enlarge avatar (Instagram-style). */}
      <Modal visible={avatarZoom} transparent animationType="fade" onRequestClose={() => setAvatarZoom(false)} statusBarTranslucent>
        <Pressable onPress={() => setAvatarZoom(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center", padding: 32 }}>
          <View style={{ width: "100%", aspectRatio: 1, maxWidth: 380, borderRadius: 24, overflow: "hidden", backgroundColor: colors.graphite }}>
            {profile?.avatar_url ? (
              <CachedImage source={{ uri: profile.avatar_url }} contentFit="cover" style={{ flex: 1 }} transition={120} />
            ) : null}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function UserProfileTab({
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
    <Pressable onPress={onPress} style={{ flex: 1 }} haptic={false} accessibilityLabel={label} accessibilityState={{ selected: active }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          paddingVertical: 12,
          borderBottomWidth: 2,
          borderBottomColor: active ? colors.white : "transparent"
        }}
      >
        <Icon size={16} color={active ? colors.white : colors.fog} strokeWidth={2} />
        <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 10.5, letterSpacing: 10.5 * 0.12, color: active ? colors.white : colors.fog }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}


