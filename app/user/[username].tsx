import { Image } from "expo-image";
import { Redirect, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Flame, Grid3x3, Lock, MapPin, Tag } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Linking, ScrollView, Share, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StreakCalendar } from "@/components/profile/StreakCalendar";
import { StreakPopup } from "@/components/profile/StreakPopup";
import { Avatar } from "@/components/ui/Avatar";
import { TauntPickerSheet } from "@/components/friends/TauntPickerSheet";
import { Button, RelButton } from "@/components/ui/Button";
import { useSheet } from "@/components/ui/Sheet";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { useMutualFriends } from "@/hooks/queries/useFollowing";
import { useRespondToRequest, useSendFriendRequest } from "@/hooks/queries/useFriends";
import { useFriendshipStatus, useProfileByUsername, useUserStreak } from "@/hooks/queries/useProfile";
import { useSignedUserPosts } from "@/hooks/queries/useSignedUserPosts";
import { useTaggedPosts } from "@/hooks/queries/useTaggedPosts";
import { useTrophies } from "@/hooks/useTrophies";
import { useStreakDays } from "@/hooks/queries/useStreakDays";
import { useStories } from "@/hooks/queries/useStories";
import { useUserCounts } from "@/hooks/queries/useUserCounts";
import { parseSocialLinks, socialEntries } from "@/lib/socialLinks";
import { computeGymStreak } from "@/lib/streak";
import { useAuthStore } from "@/stores/auth";
import { relationshipButton, useRelationships } from "@/stores/relationships";
import { colors } from "@/theme/colors";
import type { RelationshipState } from "@/types/redesign";

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
  const sheet = useSheet();
  const insets = useSafeAreaInsets();
  const profileQuery = useProfileByUsername(username);
  const profile = profileQuery.data;
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
  const respondRequest = useRespondToRequest();
  const relationships = useRelationships();
  const [streakOpen, setStreakOpen] = useState(false);

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
  const socials = useMemo(() => socialEntries(parseSocialLinks(profile?.social_links)), [profile?.social_links]);
  const hasActiveStory = Boolean(profile && stories.data?.some((g) => g.userId === profile.id));

  // Public accounts are viewable by anyone; private ones unlock only for friends.
  const isPublic = profile?.discoverable === true;
  const canView = isFriend || isPublic;

  const gymStreak = useMemo(
    () => computeGymStreak(streakDays.data ? streakDays.data.keys() : []),
    [streakDays.data]
  );
  const currentStreak = gymStreak.count;
  const longestStreak = Math.max(userStreak.data?.longest_streak ?? 0, currentStreak);
  const friendTrophies = useTrophies(profile?.id);
  const trophyCount = friendTrophies.earnedCount;
  const postCount = counts.data?.posts ?? (posts.data ?? []).filter((p) => p.media_url).length;
  const gridPosts = (posts.data ?? []).filter((p) => p.media_url);

  const advance = () => {
    const from = state;
    const transition = relationships.advance(key, name);
    if (!transition || !profile) return;
    if (from === "none" && transition.to === "requested") sendRequest.mutate(profile.id);
    if (from === "incoming" && transition.to === "friend") {
      respondRequest.mutate({ requesterId: profile.id, accept: true });
    }
  };

  const shareProfile = () => {
    void Share.share({ message: `Check out @${handle} on Spotted 💪` });
  };

  if (profile && ownUserId && profile.id === ownUserId) {
    return <Redirect href="/(tabs)/profile" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}>
        <PanelHeader title={handle} />

        {/* Avatar + stats */}
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingTop: 8 }}>
          <Pressable disabled={!hasActiveStory} onPress={() => profile && router.push(`/story?user=${profile.id}`)}>
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
            <StatCell value={postCount} label="posts" />
            <StatCell
              value={counts.data?.friends ?? 0}
              label="friends"
              onPress={() => profile && router.push(`/people/friends?user=${profile.id}` as Href)}
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
          {socials.length ? (
            <View style={{ marginTop: 14, flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {socials.map(({ meta, url }) => (
                <Pressable key={meta.key} onPress={() => void Linking.openURL(url)} accessibilityLabel={meta.label} hitSlop={6}>
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

        {/* Add / Message / Share — one relationship model: friends. */}
        <View style={{ paddingHorizontal: 18, paddingTop: 16, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <RelButton label={button.label} kind={button.kind} disabled={button.disabled} onPress={advance} />
          {isFriend && profile ? (
            <RelButton label="Message" kind="quiet" onPress={() => router.push(`/chat/${profile.id}`)} />
          ) : null}
          {/* Taunt (spec B) — server enforces eligibility/limits; the sheet is
              the canned-line picker with trophy-gated extras. */}
          {isFriend && profile ? (
            <RelButton
              label="Taunt 😈"
              kind="quiet"
              onPress={() => sheet.open(<TauntPickerSheet targetId={profile.id} name={profile.display_name} />)}
            />
          ) : null}
          <RelButton label="Share" kind="quiet" onPress={shareProfile} />
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

        {canView ? (
          <>
            {/* Inline stats */}
            <View style={{ paddingHorizontal: 18, paddingTop: 24, flexDirection: "row" }}>
              <Pressable style={{ flex: 1, alignItems: "center" }} haptic={false} onPress={() => setStreakOpen(true)} accessibilityLabel="Gym streak">
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Flame size={13} color={colors.gold} strokeWidth={2.2} />
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 3 }}>
                    <Text style={{ fontFamily: "Geist_700Bold", fontSize: 18, color: colors.white }}>{currentStreak}</Text>
                    <Text style={{ fontFamily: "Geist_400Regular", fontSize: 10.5, color: colors.fog }}>days</Text>
                  </View>
                </View>
                <Text style={{ marginTop: 5, fontFamily: "Geist_400Regular", fontSize: 11.5, color: colors.fog }}>Gym streak</Text>
              </Pressable>
              <StatCell value={longestStreak} unit="days" label="Longest" />
              <StatCell
                value={trophyCount}
                label="Trophies"
                onPress={() =>
                  profile &&
                  router.push(`/profile-section/trophies?user=${profile.id}&name=${encodeURIComponent(profile.display_name.split(" ")[0])}` as Href)
                }
              />
            </View>

            {/* Streak calendar */}
            <View style={{ paddingTop: 24 }}>
              <View
                style={{
                  marginHorizontal: 18,
                  borderRadius: 16,
                  backgroundColor: colors.ink,
                  paddingVertical: 16,
                  overflow: "hidden"
                }}
              >
                <StreakCalendar
                  days={streakDays.data ?? new Map()}
                  createdAt={profile?.created_at}
                  onDayPress={(dateKey) => router.push(`/daily/${dateKey}` as Href)}
                />
              </View>
            </View>

            {/* Posts / Tagged tabs (same as your own profile) */}
            <View style={{ marginTop: 22, borderTopWidth: 1, borderTopColor: colors.graphite, flexDirection: "row" }}>
              <UserProfileTab active={grid === "posts"} icon={Grid3x3} label="POSTS" onPress={() => setGrid("posts")} />
              <UserProfileTab active={grid === "tagged"} icon={Tag} label="TAGGED" onPress={() => setGrid("tagged")} />
            </View>
            {grid === "posts" ? (
              gridPosts.length ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 2, paddingTop: 2 }}>
                  {gridPosts.map((post) => (
                    <Pressable
                      key={post.id}
                      style={{ width: "33%", aspectRatio: 4 / 5 }}
                      onPress={() => profile && router.push(`/profile-posts/${post.id}?user=${profile.id}` as Href)}
                    >
                      <View style={{ flex: 1, backgroundColor: colors.graphite }}>
                        {post.media_url ? (
                          <Image source={{ uri: post.media_url }} contentFit="cover" style={{ flex: 1 }} />
                        ) : null}
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View style={{ alignItems: "center", paddingTop: 40, paddingHorizontal: 40 }}>
                  <Text style={{ fontSize: 13, color: colors.fog, textAlign: "center" }}>No posts yet.</Text>
                </View>
              )
            ) : tagged.data?.length ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 2, paddingTop: 2 }}>
                {tagged.data.map((post) => (
                  <Pressable
                    key={post.id}
                    style={{ width: "33%", aspectRatio: 4 / 5 }}
                    onPress={() => profile && router.push(`/profile-posts/${post.id}?user=${profile.id}` as Href)}
                  >
                    <View style={{ flex: 1, backgroundColor: colors.graphite }}>
                      {post.media_url ? (
                        <Image source={{ uri: post.media_url }} contentFit="cover" style={{ flex: 1 }} />
                      ) : null}
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={{ alignItems: "center", paddingTop: 40, paddingHorizontal: 40 }}>
                <Text style={{ fontSize: 13, color: colors.fog, textAlign: "center" }}>
                  {tagged.isLoading ? "Loading tagged posts…" : "No tagged posts yet."}
                </Text>
              </View>
            )}
          </>
        ) : (
          // Private account — locked state.
          <View style={{ alignItems: "center", paddingTop: 40, paddingHorizontal: 40 }}>
            <View
              style={{
                width: 58,
                height: 58,
                borderRadius: 29,
                borderWidth: 1.5,
                borderColor: colors.slate,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Lock size={22} color={colors.silver} strokeWidth={2} />
            </View>
            <Text style={{ marginTop: 16, fontFamily: "Geist_700Bold", fontSize: 15, color: colors.white, textAlign: "center" }}>
              This account is private
            </Text>
            <Text style={{ marginTop: 8, fontSize: 12.5, lineHeight: 18, color: colors.fog, textAlign: "center" }}>
              Add {name.split(" ")[0]} to see their posts, streak, and progress.
            </Text>
            {state === "none" ? (
              <View style={{ paddingTop: 18, alignSelf: "stretch", paddingHorizontal: 40 }}>
                <Button onPress={advance}>Add {name.split(" ")[0]}</Button>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      <StreakPopup visible={streakOpen} name={name} streak={currentStreak} onClose={() => setStreakOpen(false)} />
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
    <Pressable onPress={onPress} style={{ flex: 1 }} haptic={false} accessibilityLabel={label}>
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

function StatCell({ value, unit, label, onPress }: { value: number; unit?: string; label: string; onPress?: () => void }) {
  const body = (
    <>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 3 }}>
        <Text style={{ fontFamily: "Geist_700Bold", fontSize: 17, color: colors.white }}>{value}</Text>
        {unit ? <Text style={{ fontFamily: "Geist_400Regular", fontSize: 10.5, color: colors.fog }}>{unit}</Text> : null}
      </View>
      <Text numberOfLines={1} style={{ marginTop: 4, fontFamily: "Geist_400Regular", fontSize: 11, color: colors.silver }}>
        {label}
      </Text>
    </>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={{ flex: 1, alignItems: "center", paddingHorizontal: 1 }} haptic={false} accessibilityLabel={label}>
        {body}
      </Pressable>
    );
  }
  return <View style={{ flex: 1, alignItems: "center" }}>{body}</View>;
}
