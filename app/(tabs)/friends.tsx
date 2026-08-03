import { useRouter } from "expo-router";
import { ChevronRight, Mail, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useInboxThreadActions, useInboxThreads } from "@/components/friends/useInboxThreads";
import { useMessageRequests } from "@/hooks/queries/useMessagesExtras";
import { useQuery } from "@tanstack/react-query";
import { useSendTaunt } from "@/hooks/queries/useTaunts";
import { randomTauntLine } from "@/lib/tauntLines";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { showToast } from "@/stores/ui";
import { tokens } from "@/theme/tokens";
import { Avatar } from "@/components/ui/Avatar";
import { ListRow } from "@/components/ui/ListRow";
import { RelButton } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { SearchBar } from "@/components/ui/SearchBar";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Segmented } from "@/components/ui/Segmented";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useStartedThreads } from "@/hooks/useStartedThreads";
import {
  useFriendSuggestions,
  useFriends,
  useIncomingRequests,
  useRespondToRequest,
  useSearchPeople,
  useSendFriendRequest
} from "@/hooks/queries/useFriends";
import { relationshipButton, useRelationships } from "@/stores/relationships";
import { colors } from "@/theme/colors";
import type { FindPerson, RelationshipState } from "@/types/redesign";

const NAV_H = 84;

type FindRow = FindPerson & { avatarUrl?: string | null; real?: boolean };

export default function FriendsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState("Messages");
  // Friends tab: your full list first, discovery one hop deeper.
  const [friendsTab, setFriendsTab] = useState("My Friends");
  const [search, setSearch] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const messageRequests = useMessageRequests();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const inbox = useInboxThreads();
  const inboxActions = useInboxThreadActions();
  const startedThreads = useStartedThreads();
  const friends = useFriends();
  const suggestions = useFriendSuggestions();
  const requests = useIncomingRequests();
  const sendFriendRequest = useSendFriendRequest();
  const sendTaunt = useSendTaunt();
  const [nudgedIds, setNudgedIds] = useState<Set<string>>(new Set());
  // Which friends already posted (went to the gym) today — drives the Nudge
  // button on the My Friends list.
  const friendsPostedToday = useQuery({
    queryKey: ["friends-posted-today", (friends.data ?? []).map((f) => f.id).join(",")],
    enabled: isSupabaseConfigured && (friends.data ?? []).length > 0 && tab === "Friends",
    refetchOnWindowFocus: "always",
    queryFn: async (): Promise<Set<string>> => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("posts")
        .select("user_id")
        .gte("created_at", startOfDay.toISOString())
        .in("user_id", (friends.data ?? []).map((f) => f.id));
      if (error) throw error;
      return new Set((data ?? []).map((row) => row.user_id));
    }
  });
  const nudgeFriend = (friendId: string) => {
    if (nudgedIds.has(friendId) || sendTaunt.isPending) return;
    const line = randomTauntLine();
    sendTaunt.mutate(
      { targetId: friendId, lineId: line.id, lineText: line.text },
      {
        onSuccess: () => {
          setNudgedIds((prev) => new Set(prev).add(friendId));
          showToast("Nudge sent");
        },
        onError: (error) => showToast(error.message)
      }
    );
  };
  const respondToRequest = useRespondToRequest();
  const relationships = useRelationships();

  const realFindRows = useMemo<FindRow[]>(() => {
    const rows = new Map<string, FindRow>();
    for (const request of requests.data ?? []) {
      rows.set(request.profile.id, {
        id: request.profile.id,
        name: request.profile.display_name,
        handle: request.profile.username,
        note: "Wants to be friends",
        section: "mutual",
        state: "incoming",
        avatarUrl: request.profile.avatar_url,
        real: true
      });
    }
    for (const person of friends.data ?? []) {
      rows.set(person.id, {
        id: person.id,
        name: person.display_name,
        handle: person.username,
        note: "Already in your crew",
        section: "mutual",
        state: "friend",
        avatarUrl: person.avatar_url,
        real: true
      });
    }
    for (const person of suggestions.data ?? []) {
      if (rows.has(person.id)) continue;
      rows.set(person.id, {
        id: person.id,
        name: person.display_name,
        handle: person.username,
        note: person.mutual_friends_count
          ? `${person.mutual_friends_count} mutual friend${person.mutual_friends_count === 1 ? "" : "s"}`
          : "Suggested for you",
        section: person.mutual_friends_count ? "mutual" : "suggested",
        state: "none",
        avatarUrl: person.avatar_url,
        real: true
      });
    }
    return [...rows.values()];
  }, [friends.data, requests.data, suggestions.data]);

  useEffect(() => {
    for (const person of realFindRows) relationships.seed(person.id, person.state);
  }, [realFindRows, relationships]);

  const query = search.trim().toLowerCase();
  const peopleSearch = useSearchPeople(search);
  const filteredRows = useMemo<FindRow[]>(() => {
    if (!query) {
      return realFindRows;
    }
    const matched = realFindRows.filter((person) =>
      `${person.name} ${person.handle}`.toLowerCase().includes(query)
    );
    const known = new Set(matched.map((person) => person.id));
    const discovered = (peopleSearch.data ?? [])
      .filter((profile) => !known.has(profile.id))
      .map<FindRow>((profile) => ({
        id: profile.id,
        name: profile.display_name,
        handle: profile.username,
        note: "On Spotted",
        section: "suggested",
        state: "none",
        avatarUrl: profile.avatar_url,
        real: true
      }));
    return [...matched, ...discovered];
  }, [peopleSearch.data, query, realFindRows]);

  const messageQuery = messageSearch.trim().toLowerCase();
  const messageMatches = useMemo(
    () =>
      messageQuery
        ? (friends.data ?? []).filter((friend) =>
            `${friend.display_name} ${friend.username}`.toLowerCase().includes(messageQuery)
          )
        : [],
    [friends.data, messageQuery]
  );

  // DM list: active conversations first, then every other friend as a
  // "Tap to start conversation" row (empty threads + friends with no thread).
  const dmThreads = useMemo(() => {
    return (inbox.data ?? []).filter((t) => !t.empty);
  }, [inbox.data]);
  const dmPlaceholders = useMemo(() => {
    const threaded = new Set(dmThreads.map((t) => t.profileId));
    const list: { profileId: string; name: string; avatarUrl: string | null }[] = [];
    for (const t of inbox.data ?? []) {
      if (t.empty && !threaded.has(t.profileId)) list.push({ profileId: t.profileId, name: t.name, avatarUrl: t.avatarUrl });
    }
    const known = new Set(list.map((p) => p.profileId));
    for (const f of friends.data ?? []) {
      if (!threaded.has(f.id) && !known.has(f.id)) list.push({ profileId: f.id, name: f.display_name, avatarUrl: f.avatar_url });
    }
    return list;
  }, [inbox.data, dmThreads, friends.data]);

  const openThread = (profileId: string) => {
    inboxActions.clearUnread(profileId);
    startedThreads.markStarted(profileId);
    router.push(`/chat/${profileId}`);
  };

  const runRelationshipAction = (person: FindRow) => {
    const from = relationships.stateFor(person.id, person.state);
    const transition = relationships.advance(person.id, person.name);
    if (!transition || !person.real) return;
    if (from === "none" && transition.to === "requested") {
      sendFriendRequest.mutate(person.id);
    } else if (from === "incoming" && transition.to === "friend") {
      respondToRequest.mutate({ requesterId: person.id, accept: true });
    }
  };

  // "Added Me" — pinned incoming requests.
  const addedMe = requests.data ?? [];
  const acceptRequest = (id: string) => {
    relationships.setRelationship(id, "friend");
    respondToRequest.mutate({ requesterId: id, accept: true });
  };
  const declineRequest = (id: string) => {
    respondToRequest.mutate({ requesterId: id, accept: false });
  };

  // Quick Add — suggestions to add, minus anyone dismissed / already actioned.
  const quickAdd = useMemo<FindRow[]>(
    () =>
      realFindRows.filter(
        (person) =>
          person.state === "none" &&
          !dismissed.has(person.id) &&
          relationships.stateFor(person.id, "none") === "none"
      ),
    [realFindRows, dismissed, relationships]
  );

  const addQuickAdd = (person: FindRow) => {
    relationships.setRelationship(person.id, "requested");
    sendFriendRequest.mutate(person.id);
    setDismissed((prev) => new Set(prev).add(person.id));
    // Pull fresh suggestions in so the Quick Add feed stays populated.
    void suggestions.refetch();
  };
  const dismissQuickAdd = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: NAV_H + insets.bottom + 12 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 18,
            paddingBottom: 4
          }}
        >
          <Text
            style={{
              fontFamily: "Geist_700Bold",
              fontSize: 22,
              letterSpacing: 22 * -0.02,
              color: colors.white
            }}
          >
            Friends
          </Text>
        </View>
        <Segmented options={["Messages", "Friends"]} value={tab} onChange={setTab} />

        {tab === "Messages" ? (
          <View>
            {/* Search by display name OR username (#3). */}
            <SearchBar
              value={messageSearch}
              onChangeText={setMessageSearch}
              placeholder="Search messages"
              containerStyle={{ marginHorizontal: 18, marginTop: 2, marginBottom: 8 }}
            />

            {!messageQuery ? (
              <>
                {/* Message requests entry (#15) */}
                {(messageRequests.data ?? []).length > 0 ? (
                  <Pressable onPress={() => router.push("/message-requests")}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 18 }}>
                      <View style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: colors.iron, alignItems: "center", justifyContent: "center" }}>
                        <Mail size={20} color={tokens.accent.gold} strokeWidth={2} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14.5, color: colors.white }}>Message requests</Text>
                        <Text style={{ marginTop: 2, fontSize: 12.5, color: colors.fog }}>
                          {`${messageRequests.data!.length} pending`}
                        </Text>
                      </View>
                      <ChevronRight size={18} color={colors.fog} />
                    </View>
                  </Pressable>
                ) : null}

              </>
            ) : null}

            {messageQuery ? (
              messageMatches.length ? (
                messageMatches.map((friend) => (
                  <ListRow
                    key={`msg-friend-${friend.id}`}
                    big
                    left={<Avatar name={friend.display_name} uri={friend.avatar_url} size={58} />}
                    name={friend.display_name}
                    sub={`@${friend.username}`}
                    onPress={() => router.push(`/chat/${friend.id}`)}
                  />
                ))
              ) : (
                <Text style={{ paddingTop: 36, textAlign: "center", fontSize: 13, color: colors.fog }}>
                  No friends match. Add them in Find Friends first.
                </Text>
              )
            ) : (
              <>
                {/* Inbox still loading with nothing cached yet — skeleton rows. */}
                {inbox.isLoading && dmThreads.length === 0 && dmPlaceholders.length === 0 ? (
                  <SkeletonRows count={5} />
                ) : null}
                {/* Active conversations */}
                {dmThreads.map((thread) => (
                  <ListRow
                    key={`real-${thread.profileId}`}
                    big
                    left={<Avatar name={thread.name} uri={thread.avatarUrl} size={58} />}
                    name={thread.muted ? `${thread.name} · muted` : thread.name}
                    sub={thread.preview}
                    subStrong={thread.unread}
                    time={thread.time}
                    unread={thread.unread}
                    onPress={() => openThread(thread.profileId)}
                  />
                ))}
                {/* Every other friend — tap to start a conversation. */}
                {dmPlaceholders.map((person) => {
                  const unread = !startedThreads.started.has(person.profileId);
                  return (
                    <ListRow
                      key={`ph-${person.profileId}`}
                      big
                      left={<Avatar name={person.name} uri={person.avatarUrl} size={58} />}
                      name={person.name}
                      sub="Tap to start conversation"
                      subStrong={unread}
                      unread={unread}
                      onPress={() => openThread(person.profileId)}
                    />
                  );
                })}
                {!inbox.isLoading && dmThreads.length === 0 && dmPlaceholders.length === 0 ? (
                  <View style={{ paddingTop: 48, alignItems: "center", paddingHorizontal: 32 }}>
                    <Text style={{ fontSize: 13, color: colors.fog, textAlign: "center" }}>
                      Add friends to start messaging.
                    </Text>
                  </View>
                ) : null}
              </>
            )}
          </View>
        ) : (
          <View>
            <View style={{ paddingHorizontal: 18, paddingBottom: 10 }}>
              <Segmented options={["My Friends", "Find Friends"]} value={friendsTab} onChange={setFriendsTab} />
            </View>
            {friendsTab === "My Friends" ? (
              <View>
                {(friends.data ?? []).length === 0 ? (
                  <Text style={{ paddingTop: 40, textAlign: "center", fontSize: 13, color: colors.fog, paddingHorizontal: 32 }}>
                    No friends yet. Find them in the Find Friends tab.
                  </Text>
                ) : (
                  (friends.data ?? []).map((friend) => {
                    const went = friendsPostedToday.data?.has(friend.id) ?? false;
                    const nudged = nudgedIds.has(friend.id);
                    return (
                      <ListRow
                        key={`friend-${friend.id}`}
                        big
                        left={<Avatar name={friend.display_name} uri={friend.avatar_url} size={58} />}
                        name={friend.display_name}
                        sub={`@${friend.username}`}
                        right={
                          went ? (
                            <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(232,180,76,0.14)", borderWidth: 1, borderColor: "rgba(232,180,76,0.45)" }}>
                              <Text style={{ fontSize: 11.5, fontFamily: "Geist_600SemiBold", color: tokens.accent.gold }}>Went today</Text>
                            </View>
                          ) : (
                            <Pressable
                              accessibilityLabel={`Nudge ${friend.display_name}`}
                              onPress={() => nudgeFriend(friend.id)}
                              disabled={nudged}
                              style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: nudged ? colors.iron : colors.slate }}
                            >
                              <Text style={{ fontSize: 12, fontFamily: "Geist_600SemiBold", color: nudged ? colors.fog : colors.white }}>
                                {nudged ? "Nudged" : "Nudge"}
                              </Text>
                            </Pressable>
                          )
                        }
                        onPress={() => router.push(`/user/${friend.username}`)}
                      />
                    );
                  })
                )}
              </View>
            ) : (
            <View>
            <SearchBar
              value={search}
              onChangeText={setSearch}
              placeholder="Search people"
              containerStyle={{ marginHorizontal: 18, marginTop: 2, marginBottom: 8 }}
            />
            {query ? (
              filteredRows.length === 0 ? (
                <Text style={{ paddingTop: 36, textAlign: "center", fontSize: 13, color: colors.fog, paddingHorizontal: 32 }}>
                  No one found. Try a different name.
                </Text>
              ) : (
                filteredRows.map((person) => (
                  <FindPersonRow
                    key={person.id}
                    person={person}
                    state={relationships.stateFor(person.id, person.state)}
                    onRelationship={() => runRelationshipAction(person)}
                    onOpen={() => router.push(`/user/${person.handle.replace(/^@/, "")}`)}
                  />
                ))
              )
            ) : (
              <>
                {/* Added Me — pinned above suggestions, with Accept / Decline. */}
                {addedMe.length ? (
                  <View>
                    <SectionLabel>Added Me</SectionLabel>
                    {addedMe.map((request) => (
                      <AddedMeRow
                        key={`req-${request.profile.id}`}
                        name={request.profile.display_name}
                        handle={request.profile.username}
                        avatarUrl={request.profile.avatar_url}
                        onAccept={() => acceptRequest(request.profile.id)}
                        onDecline={() => declineRequest(request.profile.id)}
                        onOpen={() => router.push(`/user/${request.profile.username}`)}
                      />
                    ))}
                  </View>
                ) : null}

                {/* Quick Add — always-populated suggestions. */}
                <SectionLabel>Quick Add</SectionLabel>
                {quickAdd.length ? (
                  quickAdd.map((person) => (
                    <QuickAddRow
                      key={person.id}
                      person={person}
                      onAdd={() => addQuickAdd(person)}
                      onDismiss={() => dismissQuickAdd(person.id)}
                      onOpen={() => router.push(`/user/${person.handle.replace(/^@/, "")}`)}
                    />
                  ))
                ) : suggestions.isLoading ? (
                  <SkeletonRows count={3} />
                ) : (
                  <Text style={{ paddingTop: 24, textAlign: "center", fontSize: 13, color: colors.fog, paddingHorizontal: 32 }}>
                    No suggestions right now. Search for friends by name or handle.
                  </Text>
                )}
              </>
            )}
            </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function FindPersonRow({
  person,
  state,
  onRelationship,
  onOpen
}: {
  person: FindRow;
  state: RelationshipState;
  onRelationship: () => void;
  onOpen: () => void;
}) {
  const button = relationshipButton(state);
  const handle = person.handle.startsWith("@") ? person.handle : `@${person.handle}`;
  return (
    <ListRow
      left={<Avatar name={person.name} uri={person.avatarUrl} size={46} />}
      name={person.name}
      sub={`${handle} \u00b7 ${person.note}`}
      right={
        <RelButton
          label={button.label}
          kind={button.kind}
          disabled={button.disabled}
          onPress={onRelationship}
        />
      }
      onPress={onOpen}
    />
  );
}

/** Pinned "Added Me" row — Accept / Decline an incoming request. */
function AddedMeRow({
  name,
  handle,
  avatarUrl,
  onAccept,
  onDecline,
  onOpen
}: {
  name: string;
  handle: string;
  avatarUrl: string | null;
  onAccept: () => void;
  onDecline: () => void;
  onOpen: () => void;
}) {
  return (
    <ListRow
      left={<Avatar name={name} uri={avatarUrl} size={46} />}
      name={name}
      sub={`@${handle} · added you`}
      right={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <RelButton label="Accept" kind="primary" onPress={onAccept} />
          <RelButton label="Decline" kind="quiet" onPress={onDecline} />
        </View>
      }
      onPress={onOpen}
    />
  );
}

/** Quick Add suggestion — Add + a dismiss (X). */
function QuickAddRow({
  person,
  onAdd,
  onDismiss,
  onOpen
}: {
  person: FindRow;
  onAdd: () => void;
  onDismiss: () => void;
  onOpen: () => void;
}) {
  const handle = person.handle.startsWith("@") ? person.handle : `@${person.handle}`;
  return (
    <ListRow
      left={<Avatar name={person.name} uri={person.avatarUrl} size={46} />}
      name={person.name}
      sub={`${handle} · ${person.note}`}
      right={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <RelButton label="Add" kind="primary" onPress={onAdd} />
          <Pressable onPress={onDismiss} accessibilityLabel={`Dismiss ${person.name}`} hitSlop={8}>
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                borderWidth: 1,
                borderColor: colors.iron,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <X size={14} color={colors.fog} strokeWidth={2.2} />
            </View>
          </Pressable>
        </View>
      }
      onPress={onOpen}
    />
  );
}


