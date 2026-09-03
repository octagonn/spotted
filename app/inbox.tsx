import { useRouter } from "expo-router";
import { ChevronDown, UserPlus } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NotificationRow, SystemNoticeRow } from "@/components/notifications/NotificationRow";
import { RelButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { EMPTY_ART } from "@/lib/emptyStateArt";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { UserRow } from "@/components/ui/UserRow";
import { useMyCommunityInvite, useRespondCommunityInvite } from "@/hooks/queries/useCommunities";
import { useIncomingRequests, useRespondToRequest } from "@/hooks/queries/useFriends";
import { useMarkNotificationsRead, useNotifications } from "@/hooks/queries/useNotifications";
import { useSendTaunt } from "@/hooks/queries/useTaunts";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { groupNotifications } from "@/lib/notificationCopy";
import { routeForNotification } from "@/lib/notificationRouting";
import { randomTauntLine } from "@/lib/tauntLines";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { icon, radius, space, tokens } from "@/theme/tokens";

/** One-button taunt: a RANDOM line from the rotation through the guarded RPC. */
function useDirectTaunt() {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const guarded = useSendTaunt();
  const sendTaunt = (targetId: string) => {
    if (pendingId) return;
    setPendingId(targetId);
    const line = randomTauntLine();
    guarded.mutate(
      { targetId, lineId: line.id, lineText: line.text },
      // Errors surface via useSendTaunt's own toast.
      { onSuccess: () => showToast("Taunt sent"), onSettled: () => setPendingId(null) }
    );
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
    <View style={{ flexDirection: "row", gap: space[2] }}>
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

/** Notifications: friend requests (collapsible) · Today / Yesterday / Last week. */
export default function InboxScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const directTaunt = useDirectTaunt();
  const requests = useIncomingRequests();
  const respond = useRespondToRequest();
  const notifications = useNotifications();
  // Refresh on every visit, not just after the app was backgrounded.
  useRefreshOnFocus(["notifications", "friend-requests"]);
  const markRead = useMarkNotificationsRead();
  const [requestsOpen, setRequestsOpen] = useState(false);

  // Opening the inbox clears the unread badge.
  useEffect(() => {
    markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestRows = requests.data ?? [];
  const groups = useMemo(() => groupNotifications(notifications.data ?? []), [notifications.data]);
  const empty = requestRows.length === 0 && groups.every((g) => g.rows.length === 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title="Notifications" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space[6] }}>
        {requestRows.length > 0 ? (
          <View style={{ paddingTop: space[1] }}>
            <Pressable
              onPress={() => setRequestsOpen((open) => !open)}
              haptic="none"
              accessibilityLabel={`Friend requests, ${requestRows.length}`}
              accessibilityState={{ expanded: requestsOpen }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space[3],
                  paddingVertical: space[3],
                  paddingHorizontal: space[4]
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radius.pill,
                    backgroundColor: tokens.bg.raised,
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <UserPlus size={icon.size.sm} color={colors.white} strokeWidth={icon.stroke.regular} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="username">Friend requests</Text>
                  <Text variant="meta" className="mt-[2px]">
                    {`${requestRows.length} ${requestRows.length === 1 ? "person wants" : "people want"} to be friends`}
                  </Text>
                </View>
                <View
                  style={{
                    minWidth: 22,
                    height: 22,
                    borderRadius: radius.pill,
                    paddingHorizontal: 6,
                    backgroundColor: colors.white,
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Text variant="mono" className="text-black text-[11px]">
                    {String(requestRows.length)}
                  </Text>
                </View>
                <ChevronDown
                  size={icon.size.xs + 2}
                  color={tokens.text.tertiary}
                  strokeWidth={icon.stroke.regular}
                  style={{ transform: [{ rotate: requestsOpen ? "180deg" : "0deg" }] }}
                />
              </View>
            </Pressable>
            {requestsOpen
              ? requestRows.map((request) => (
                  <UserRow
                    key={request.requesterId}
                    name={request.profile.display_name}
                    avatarUrl={request.profile.avatar_url}
                    sub={`@${request.profile.username}`}
                    right={
                      <View style={{ flexDirection: "row", gap: space[2] }}>
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
              <SectionLabel style={{ paddingHorizontal: space[4], paddingTop: space[4], paddingBottom: space[1] }}>
                {group.label}
              </SectionLabel>
              {group.rows.map((n) =>
                n.type === "system_notice" ? (
                  <SystemNoticeRow
                    key={n.id}
                    notice={n}
                    onOpen={() => router.push(routeForNotification({ type: n.type, payload: n.payload }) as never)}
                  />
                ) : (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    onPress={() =>
                      router.push(
                        routeForNotification({
                          type: n.type,
                          actorId: n.actorId,
                          actorUsername: n.actorUsername,
                          payload: n.payload
                        }) as never
                      )
                    }
                    action={
                      n.type === "community_invite" && n.payload?.community_id ? (
                        <InviteActions communityId={String(n.payload.community_id)} />
                      ) : n.type === "streak_break_friend" && n.actorId ? (
                        <RelButton
                          label={directTaunt.pendingId === n.actorId ? "Sending…" : "Taunt"}
                          kind="primary"
                          onPress={() => void directTaunt.sendTaunt(n.actorId as string)}
                        />
                      ) : undefined
                    }
                  />
                )
              )}
            </View>
          ) : null
        )}

        {empty ? (
          notifications.isLoading || requests.isLoading ? (
            <SkeletonRows count={5} />
          ) : (
            <EmptyState
              art={EMPTY_ART.bell}
              title="No activity yet"
              body="Friend requests and reactions show up here."
              center
            />
          )
        ) : null}
      </ScrollView>
    </View>
  );
}
