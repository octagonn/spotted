import { useRouter } from "expo-router";
import { ChevronDown, MessageCircle, Swords, UserPlus, type LucideIcon } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RelButton } from "@/components/ui/Button";
import { ListRow } from "@/components/ui/ListRow";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { Avatar } from "@/components/ui/Avatar";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { useMyCommunityInvite, useRespondCommunityInvite } from "@/hooks/queries/useCommunities";
import { useIncomingRequests, useRespondToRequest } from "@/hooks/queries/useFriends";
import { supabase } from "@/lib/supabase";
import { routeForNotification } from "@/lib/notificationRouting";
import { randomTauntLine } from "@/lib/tauntLines";
import { localDateKey, showToast } from "@/stores/ui";
import {
  useMarkNotificationsRead,
  useNotifications,
  type AppNotification
} from "@/hooks/queries/useNotifications";
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
      return "reacted to your post";
    case "dm":
      return "sent you a message";
    case "gym_arrival_friend":
      return "just checked in at the gym";
    case "streak_break_friend":
      return "'s streak ended";
    case "streak_milestone":
      return "hit a streak milestone";
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
    <View style={{ width: 42, height: 42 }}>
      <Avatar name={name} uri={avatar} size={42} />
      {Icon ? (
        <View style={{ position: "absolute", right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.charcoal, borderWidth: 1.5, borderColor: colors.black, alignItems: "center", justifyContent: "center" }}>
          <Icon size={11} color={colors.mist} strokeWidth={2.2} />
        </View>
      ) : null}
    </View>
  );
}

/** One-button taunt: sends a RANDOM line from the 20-line rotation. */
function useDirectTaunt() {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const sendTaunt = async (targetId: string) => {
    if (pendingId) return;
    setPendingId(targetId);
    const line = randomTauntLine();
    const { error } = await supabase.rpc("send_taunt", { p_target: targetId, p_text: line.text });
    setPendingId(null);
    if (error) {
      showToast(error.message.includes("cooldown") ? "Easy — you already taunted them today" : "Couldn't send the taunt");
    } else {
      showToast("Taunt sent");
    }
  };
  return { sendTaunt, pendingId };
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
    { label: "Today", rows: today },
    { label: "Yesterday", rows: yesterday },
    { label: "Last week", rows: lastWeek }
  ];
}

export default function InboxScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const directTaunt = useDirectTaunt();
  const requests = useIncomingRequests();
  const respond = useRespondToRequest();
  const notifications = useNotifications();
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
            <Pressable onPress={() => setRequestsOpen((open) => !open)}>
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
              {group.rows.map((n) => (
                <Pressable
                  key={n.id}
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
                      paddingVertical: 12,
                      paddingHorizontal: 18,
                      backgroundColor: n.read ? "transparent" : "rgba(255,255,255,0.04)"
                    }}
                  >
                    <NotifAvatar name={n.actorName} avatar={n.actorAvatar} type={n.type} />
                    <Text style={{ flex: 1, fontSize: 13.5, color: colors.mist, lineHeight: 13.5 * 1.4 }}>
                      <Text style={{ fontFamily: "Geist_700Bold", color: colors.white }}>{n.actorName}</Text>
                      {n.type === "streak_break_friend" ? "" : " "}
                      {notificationText(n)}
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
          <View style={{ alignItems: "center", paddingTop: 60, paddingHorizontal: 40 }}>
            {notifications.isLoading || requests.isLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={{ fontSize: 13, color: colors.fog, textAlign: "center", lineHeight: 19 }}>
                No activity yet. Friend requests and reactions show up here.
              </Text>
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
