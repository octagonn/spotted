import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ChevronDown, ChevronRight, MessageCircle, ShieldCheck, Swords, UserPlus, type LucideIcon } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RelButton } from "@/components/ui/Button";
import { ListRow } from "@/components/ui/ListRow";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { Avatar } from "@/components/ui/Avatar";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useMyCommunityInvite, useRespondCommunityInvite } from "@/hooks/queries/useCommunities";
import { useIncomingRequests, useRespondToRequest } from "@/hooks/queries/useFriends";
import { routeForNotification } from "@/lib/notificationRouting";
import { randomTauntLine } from "@/lib/tauntLines";
import { useSendTaunt } from "@/hooks/queries/useTaunts";
import { localDateKey, showToast } from "@/stores/ui";
import {
  useMarkNotificationsRead,
  useNotifications,
  type AppNotification
} from "@/hooks/queries/useNotifications";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { colors } from "@/theme/colors";

function timeAgo(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / (60 * 24))}d`;
}

function notificationText(n: AppNotification): string {
  switch (n.type) {
    case "friend_accepted":
      return "accepted your friend request";
    case "post_reaction":
      // Heart-likes store the 🔥 like emoji in the payload; live-reaction
      // selfies store null — split the copy so likes read as likes.
      return n.payload?.reaction === "🔥" ? "liked your post" : "reacted to your post";
    case "post_comment":
      return "commented on your post";
    case "mention":
      return "mentioned you in a comment";
    case "dm":
      return "sent you a message";
    case "gym_arrival_friend":
      return "just checked in at the gym";
    case "streak_break_friend":
      return "'s streak ended";
    case "streak_milestone":
      return "hit a streak milestone";
    case "trophy_unlocked":
      return `unlocked ${String(n.payload?.name ?? "a trophy")} 🏆`;
    case "taunt":
      return `roasted you: "${String(n.payload?.text ?? "…")}"`;
    case "community_invite":
      return `invited you to ${String(n.payload?.community_name ?? "a community")}`;
    case "wave":
      return n.payload?.gymName ? `waved at you — they're at ${String(n.payload.gymName)}` : "waved at you";
    case "community_nudge":
      return n.payload?.text
        ? `nudged ${String(n.payload?.communityName ?? "your crew")}: "${String(n.payload.text)}"`
        : `nudged ${String(n.payload?.communityName ?? "your crew")} — it's been quiet`;
    case "tagged":
      return `tagged you in their ${n.payload?.kind === "story" ? "story" : "post"}`;
    case "second_workout":
      return `put in a second workout today — ${String(n.payload?.workout_name ?? "another session")}`;
    case "taunt_answered":
      return "answered your taunt — they posted";
    case "claim_approved":
      return `approved your ${String(n.payload?.trophy_id ?? "lift")} claim — trophy unlocked`;
    case "claim_rejected":
      return `rejected your ${String(n.payload?.trophy_id ?? "lift")} claim: ${String(n.payload?.reason ?? "not verifiable")}`;
    case "system_notice":
      return String(n.payload?.body ?? n.payload?.title ?? "posted an update");
    default:
      return "sent you an update";
  }
}

/**
 * Notification avatar with a small type-icon badge (#22). Friend → friend
 * icon, message → message icon, taunt → taunt icon. Buddy check-in, stream
 * end, and trophy earns intentionally have NO badge.
 */
function NotifAvatar({ name, avatar, type }: { name: string; avatar: string | null; type: string }) {
  let Icon: LucideIcon | null = null;
  if (type === "friend_request" || type === "friend_accepted") Icon = UserPlus;
  else if (type === "dm") Icon = MessageCircle;
  else if (type === "streak_break_friend") Icon = Swords;
  return (
    <View style={{ width: 48, height: 48 }}>
      <Avatar name={name} uri={avatar} size={48} />
      {Icon ? (
        <View style={{ position: "absolute", right: -2, bottom: -2, width: 21, height: 21, borderRadius: 10.5, backgroundColor: colors.charcoal, borderWidth: 1.5, borderColor: colors.black, alignItems: "center", justifyContent: "center" }}>
          <Icon size={12} color={colors.mist} strokeWidth={2.2} />
        </View>
      ) : null}
    </View>
  );
}

/** One-button taunt: sends a RANDOM line from the 20-line rotation. Goes
 *  through the guarded send_taunt_line RPC (the legacy send_taunt RPC skipped
 *  the already-posted / daily-limit / quiet-hours / mute checks and is gone). */
function useDirectTaunt() {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const guarded = useSendTaunt();
  const sendTaunt = (targetId: string) => {
    if (pendingId) return;
    setPendingId(targetId);
    const line = randomTauntLine();
    guarded.mutate(
      { targetId, lineId: line.id, lineText: line.text },
      {
        onSuccess: () => showToast("Taunt sent"),
        // Errors surface via useSendTaunt's own toast.
        onSettled: () => setPendingId(null)
      }
    );
  };
  return { sendTaunt, pendingId };
}

/**
 * Actor-less account/policy notice (type "system_notice"): the payload carries
 * its own title + body and deep-links to an allowlisted screen (e.g. the
 * privacy policy). Rendered as a card, not as "Someone sent you an update".
 */
function SystemNoticeRow({ notice, onOpen }: { notice: AppNotification; onOpen: () => void }) {
  const title = String(notice.payload?.title ?? "Spotted update");
  const body = typeof notice.payload?.body === "string" ? notice.payload.body : null;
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${title}. ${body ?? ""} ${timeAgo(notice.createdAt)}`}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 14,
          paddingHorizontal: 18,
          backgroundColor: notice.read ? "transparent" : "rgba(255,255,255,0.04)"
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.iron,
            backgroundColor: colors.charcoal,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <ShieldCheck size={22} color={colors.white} strokeWidth={2} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14.5, color: colors.white }}>
            {title}
            <Text style={{ fontFamily: "Geist_400Regular", color: colors.fog }}>{`  ${timeAgo(notice.createdAt)}`}</Text>
          </Text>
          {body ? (
            <Text numberOfLines={3} style={{ marginTop: 3, fontSize: 13, lineHeight: 18, color: colors.mist }}>
              {body}
            </Text>
          ) : null}
        </View>
        <ChevronRight size={18} color={colors.fog} strokeWidth={2} />
        {!notice.read ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.white }} /> : null}
      </View>
    </Pressable>
  );
}

/** Join/ignore buttons on a community-invite notification. */
function InviteActions({ communityId }: { communityId: string }) {
  const invite = useMyCommunityInvite(communityId);
  const respond = useRespondCommunityInvite();
  // Once handled (or if the invite no longer exists), show nothing.
  if (!invite.data) return null;
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <RelButton
        label="Join"
        kind="primary"
        disabled={respond.isPending}
        onPress={() => respond.mutate({ communityId, accept: true })}
      />
      <RelButton
        label="Ignore"
        kind="quiet"
        disabled={respond.isPending}
        onPress={() => respond.mutate({ communityId, accept: false })}
      />
    </View>
  );
}

/** Bucket notifications by recency; drops anything older than a week. */
function groupNotifications(activity: AppNotification[]) {
  const now = new Date();
  const todayKey = localDateKey(now);
  const yesterdayKey = localDateKey(new Date(now.getTime() - 86_400_000));
  const weekAgo = now.getTime() - 7 * 86_400_000;
  const today: AppNotification[] = [];
  const yesterday: AppNotification[] = [];
  const lastWeek: AppNotification[] = [];
  for (const n of activity) {
    const t = new Date(n.createdAt);
    if (t.getTime() < weekAgo) continue;
    const key = localDateKey(t);
    if (key === todayKey) today.push(n);
    else if (key === yesterdayKey) yesterday.push(n);
    else lastWeek.push(n);
  }
  return [
    { label: "Today", rows: mergeByActor(today) },
    { label: "Yesterday", rows: mergeByActor(yesterday) },
    { label: "Last week", rows: mergeByActor(lastWeek) }
  ];
}

/** Types that stack per actor ("X sent you 4 messages") instead of one row each. */
const MERGEABLE = new Set(["dm", "post_reaction", "post_comment", "mention", "tagged", "taunt", "wave", "gym_arrival_friend", "second_workout"]);

/**
 * Collapse a bucket so one actor + one type = one row (newest first). The
 * merged row keeps the newest notification's id/route/thumb, is unread if any
 * member is, and carries `count` for the copy.
 */
function mergeByActor(rows: AppNotification[]): AppNotification[] {
  const out: AppNotification[] = [];
  const index = new Map<string, number>();
  for (const n of rows) {
    if (!n.actorId || !MERGEABLE.has(n.type)) {
      out.push(n);
      continue;
    }
    const key = `${n.actorId}|${n.type}`;
    const at = index.get(key);
    if (at === undefined) {
      index.set(key, out.length);
      out.push({ ...n, count: 1, mergedIds: [n.id] });
    } else {
      const head = out[at];
      out[at] = { ...head, count: (head.count ?? 1) + 1, read: head.read && n.read, mergedIds: [...(head.mergedIds ?? []), n.id] };
    }
  }
  return out;
}

/** Copy for a merged row; falls back to the single-row copy when count is 1. */
function mergedNotificationText(n: AppNotification): string {
  const c = n.count ?? 1;
  if (c <= 1) return notificationText(n);
  switch (n.type) {
    case "dm":
      return `sent you ${c} messages`;
    case "post_reaction":
      return `reacted to ${c} of your posts`;
    case "post_comment":
      return `left ${c} comments on your posts`;
    case "mention":
      return `mentioned you in ${c} comments`;
    case "tagged":
      return `tagged you in ${c} posts`;
    case "taunt":
      return `roasted you ${c} times`;
    case "wave":
      return `waved at you ${c} times`;
    case "gym_arrival_friend":
      return `checked in at the gym ${c} times`;
    case "second_workout":
      return `logged ${c} extra workouts`;
    default:
      return `${mergedNotificationText(n)} (${c})`;
  }
}

export default function InboxScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const directTaunt = useDirectTaunt();
  const requests = useIncomingRequests();
  const respond = useRespondToRequest();
  const notifications = useNotifications();
  // Notifications (friend requests, taunts, reactions) refresh on every
  // visit, not just after the app was backgrounded.
  useRefreshOnFocus(["notifications", "friend-requests"]);
  const markRead = useMarkNotificationsRead();
  const [requestsOpen, setRequestsOpen] = useState(false);

  // Opening the inbox clears the unread badge.
  useEffect(() => {
    markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestRows = requests.data ?? [];
  const activity = notifications.data ?? [];
  // Bucket into Today / Yesterday / Last week; anything older than 7 days is
  // dropped (the server sweeps it too).
  const groups = groupNotifications(activity);
  const empty = requestRows.length === 0 && groups.every((g) => g.rows.length === 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title="Notifications" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}>
        {/* Friend-requests card — tap to expand and act on each. */}
        {requestRows.length > 0 ? (
          <View style={{ paddingTop: 4 }}>
            <Pressable onPress={() => setRequestsOpen((open) => !open)} accessibilityState={{ expanded: requestsOpen }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 18
                }}
              >
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    borderWidth: 1,
                    borderColor: colors.iron,
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <UserPlus size={20} color={colors.white} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14.5, color: colors.white }}>
                    Friend requests
                  </Text>
                  <Text style={{ marginTop: 2, fontSize: 12.5, color: colors.fog }}>
                    {`${requestRows.length} ${requestRows.length === 1 ? "person wants" : "people want"} to be friends`}
                  </Text>
                </View>
                <View
                  style={{
                    minWidth: 22,
                    height: 22,
                    borderRadius: 11,
                    paddingHorizontal: 6,
                    backgroundColor: colors.white,
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Text style={{ fontFamily: "GeistMono_500Medium", fontSize: 11, color: colors.black }}>
                    {requestRows.length}
                  </Text>
                </View>
                <ChevronDown
                  size={18}
                  color={colors.fog}
                  style={{ transform: [{ rotate: requestsOpen ? "180deg" : "0deg" }] }}
                />
              </View>
            </Pressable>
            {requestsOpen
              ? requestRows.map((request) => (
                  <ListRow
                    key={request.requesterId}
                    left={<Avatar name={request.profile.display_name} uri={request.profile.avatar_url} size={44} />}
                    name={request.profile.display_name}
                    sub={`@${request.profile.username}`}
                    right={
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <RelButton
                          label="Confirm"
                          kind="primary"
                          disabled={respond.isPending}
                          onPress={() => respond.mutate({ requesterId: request.requesterId, accept: true })}
                        />
                        <RelButton
                          label="Delete"
                          kind="quiet"
                          disabled={respond.isPending}
                          onPress={() => respond.mutate({ requesterId: request.requesterId, accept: false })}
                        />
                      </View>
                    }
                    onPress={() => router.push(`/user/${request.profile.username}`)}
                  />
                ))
              : null}
          </View>
        ) : null}

        {groups.map((group) =>
          group.rows.length > 0 ? (
            <View key={group.label}>
              <SectionLabel>{group.label}</SectionLabel>
              {group.rows.map((n) => n.type === "system_notice" ? (
                <SystemNoticeRow
                  key={n.id}
                  notice={n}
                  onOpen={() => router.push(routeForNotification({ type: n.type, payload: n.payload }) as never)}
                />
              ) : (
                <Pressable
                  key={n.id}
                  accessibilityLabel={`${n.actorName}${n.type === "streak_break_friend" ? "" : " "}${mergedNotificationText(n)}, ${timeAgo(n.createdAt)}${n.read ? "" : ", unread"}`}
                  onPress={() => {
                    router.push(
                      routeForNotification({
                        type: n.type,
                        actorId: n.actorId,
                        actorUsername: n.actorUsername,
                        payload: n.payload
                      }) as never
                    );
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingVertical: 14,
                      paddingHorizontal: 18,
                      backgroundColor: n.read ? "transparent" : "rgba(255,255,255,0.04)"
                    }}
                  >
                    <NotifAvatar name={n.actorName} avatar={n.actorAvatar} type={n.type} />
                    <Text style={{ flex: 1, fontSize: 14.5, color: colors.mist, lineHeight: 14.5 * 1.4 }}>
                      <Text style={{ fontFamily: "Geist_700Bold", color: colors.white }}>{n.actorName}</Text>
                      {n.type === "streak_break_friend" ? "" : " "}
                      {mergedNotificationText(n)}
                      <Text style={{ color: colors.fog }}>{`  ${timeAgo(n.createdAt)}`}</Text>
                    </Text>
                    {n.type === "community_invite" && n.payload?.community_id ? (
                      <InviteActions communityId={String(n.payload.community_id)} />
                    ) : null}
                    {n.type === "streak_break_friend" && n.actorId ? (
                      <RelButton
                        label={directTaunt.pendingId === n.actorId ? "Sending…" : "Taunt"}
                        kind="primary"
                        onPress={() => void directTaunt.sendTaunt(n.actorId as string)}
                      />
                    ) : null}
                    {/* Related-post preview (IG-style) — reactions, tags,
                        answered taunts show the post on the right. */}
                    {n.postThumbUrl ? (
                      <Image
                        source={{ uri: n.postThumbUrl }}
                        accessible={false}
                        contentFit="cover"
                        style={{ width: 40, height: 50, borderRadius: 8, backgroundColor: colors.graphite }}
                      />
                    ) : null}
                    {!n.read ? (
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.white }} />
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null
        )}

        {empty ? (
          notifications.isLoading || requests.isLoading ? (
            <SkeletonRows count={5} />
          ) : (
            <View style={{ alignItems: "center", paddingTop: 60, paddingHorizontal: 40 }}>
              <Text style={{ fontSize: 13, color: colors.fog, textAlign: "center", lineHeight: 19 }}>
                No activity yet. Friend requests and reactions show up here.
              </Text>
            </View>
          )
        ) : null}
      </ScrollView>
    </View>
  );
}
