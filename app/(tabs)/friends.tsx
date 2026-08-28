import { useRouter } from "expo-router";
import { BookUser, ChevronRight, Clock, Mail, SquarePen, UserPlus, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Keyboard, Platform, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScrollView as SheetScrollView } from "react-native-gesture-handler";

import { useInboxThreadActions, useInboxThreads } from "@/components/friends/useInboxThreads";
import { APP_STORE_URL } from "@/lib/share";
import { NewMessageSheet } from "@/components/friends/NewGroupSheet";
import { SwipeableThreadRow } from "@/components/friends/SwipeableThreadRow";
import { useLeaveGroup } from "@/hooks/queries/useMessages";
import { useDeleteConversation, useMessageRequests } from "@/hooks/queries/useMessagesExtras";
import { useQuery } from "@tanstack/react-query";
import { useMyTauntsToday, useSendTaunt } from "@/hooks/queries/useTaunts";
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
import { SheetSub, SheetTitle, useSheet } from "@/components/ui/Sheet";
import { type InvitableContact } from "@/hooks/useContacts";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useContactMatches, useContactsPermission } from "@/hooks/useContacts";
import { useMutualCounts } from "@/hooks/queries/useFollowing";
import { useMyProfile } from "@/hooks/queries/useProfile";
import { useCancelFriendRequest, useDismissSuggestion, useFriendSuggestions, useFriends, useFriendshipStates, useIncomingRequests, useOutgoingRequests, useResetSuggestions, useRespondToRequest, useSearchPeople, useSendFriendRequest } from "@/hooks/queries/useFriends";
import { relationshipButton, useRelationships } from "@/stores/relationships";
import { colors } from "@/theme/colors";
import type { FindPerson, RelationshipState } from "@/types/redesign";

const NAV_H = 84;

type FindRow = FindPerson & { avatarUrl?: string | null; real?: boolean };

/** How many Quick Add rows are shown at once. The fetched pool is far larger
 *  so dismissals backfill instantly rather than waiting on a refetch. */
const QUICK_ADD_VISIBLE = 12;

export default function FriendsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // One flat segmented control — Messages / Friends / Find (the old nested
  // pill-inside-pill read as convoluted).
  const [tab, setTab] = useState("Messages");
  const [search, setSearch] = useState("");
  // IG-style live search: debounce keystrokes so the server sees settled input.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const [messageSearch, setMessageSearch] = useState("");
  const messageRequests = useMessageRequests();
  const deleteConversation = useDeleteConversation();
  const leaveGroup = useLeaveGroup();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const inbox = useInboxThreads();
  const inboxActions = useInboxThreadActions();
  const friends = useFriends();
  const suggestions = useFriendSuggestions();
  const requests = useIncomingRequests();
  // Requests YOU sent that are still pending — previously invisible, so a sent
  // request looked like nothing happened and couldn't be taken back.
  const sentRequests = useOutgoingRequests();
  const sendFriendRequest = useSendFriendRequest();
  const cancelFriendRequest = useCancelFriendRequest();
  const dismissSuggestion = useDismissSuggestion();
  const resetSuggestions = useResetSuggestions();
  const sendTaunt = useSendTaunt();
  // Server truth for who I've already taunted today — survives tab switches
  // and app restarts (the local set only covers this render session).
  const myTauntsToday = useMyTauntsToday();
  const [nudgedIds, setNudgedIds] = useState<Set<string>>(new Set());
  // Swipe down to refresh — the Find tab needs it most (suggestions are
  // server-picked and were only refreshing on their own schedule).
  // Tab screens never unmount, so nothing refetched on tab switch — new
  // messages and friend requests only appeared after backgrounding the app.
  useRefreshOnFocus([
    "inbox-threads",
    "friends",
    "friend-requests",
    "friend-requests-sent",
    "friend-suggestions",
    "message-requests",
    "friendship-states"
  ]);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void Promise.allSettled([
      suggestions.refetch(),
      requests.refetch(),
      friends.refetch(),
      inbox.refetch()
    ]).finally(() => setRefreshing(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
  const tauntFriend = (friendId: string) => {
    if (nudgedIds.has(friendId) || myTauntsToday.data?.targets.has(friendId) || sendTaunt.isPending) return;
    // Optimistic: flip to "Taunted" at tap time so rapid taps can't double-send.
    setNudgedIds((prev) => new Set(prev).add(friendId));
    const line = randomTauntLine();
    sendTaunt.mutate(
      { targetId: friendId, lineId: line.id, lineText: line.text },
      {
        onSuccess: () => showToast("Taunt sent"),
        // Roll back the optimistic "Taunted" state; the error toast itself
        // comes from useSendTaunt (toasting here too showed it twice).
        onError: () => {
          setNudgedIds((prev) => {
            const next = new Set(prev);
            next.delete(friendId);
            return next;
          });
        }
      }
    );
  };
  const respondToRequest = useRespondToRequest();
  const relationships = useRelationships();
  const myProfile = useMyProfile();
  const sheet = useSheet();
  // Contacts matching — only spins up on the Find tab, after consent.
  const contactsPerm = useContactsPermission();
  const contactMatches = useContactMatches(contactsPerm.granted && tab === "Add Friends");

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
        // Ranked server-side (mutuals > same gym > shared crews > interactions
        // > recency); the reason string says WHY this person surfaced.
        note: person.mutual_friends_count
          ? `${person.mutual_friends_count} mutual friend${person.mutual_friends_count === 1 ? "" : "s"}`
          : person.reason ?? "Suggested for you",
        section: person.mutual_friends_count ? "mutual" : "suggested",
        state: "none",
        avatarUrl: person.avatar_url,
        real: true
      });
    }
    return [...rows.values()];
  }, [friends.data, requests.data, suggestions.data]);

  // Contacts already on Spotted (server excludes existing friends + blocked).
  const contactRows = useMemo<FindRow[]>(
    () =>
      (contactMatches.data?.matches ?? [])
        .filter((m) => !dismissed.has(m.id))
        .map((m) => ({
          id: m.id,
          name: m.display_name,
          handle: m.username,
          note: m.mutual_friends_count
            ? `${m.mutual_friends_count} mutual friend${m.mutual_friends_count === 1 ? "" : "s"} · in your contacts`
            : "In your contacts",
          section: "contacts",
          state: "none",
          avatarUrl: m.avatar_url,
          real: true
        })),
    [contactMatches.data, dismissed]
  );

  useEffect(() => {
    for (const person of realFindRows) relationships.seed(person.id, person.state);
    for (const person of contactRows) relationships.seed(person.id, person.state);
  }, [realFindRows, contactRows, relationships]);

  const query = search.trim().toLowerCase();
  const peopleSearch = useSearchPeople(debouncedSearch);
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

  // Real relationship state for search results. Discovered rows are built with
  // state "none" (the search RPC returns bare profiles), so without this a
  // person you'd ALREADY requested came back showing "Add" again — and tapping
  // it fired a duplicate request. One batched lookup keyed on what's on screen.
  const searchResultIds = useMemo(
    () => (query ? filteredRows.map((person) => person.id) : []),
    [query, filteredRows]
  );
  const searchStates = useFriendshipStates(searchResultIds);

  // Batch mutual-friend counts for whatever people rows are on screen — one
  // round-trip; the count renders under the username.
  const mutualCountIds = useMemo(() => {
    const ids = new Set<string>();
    for (const request of requests.data ?? []) ids.add(request.profile.id);
    if (query) for (const person of filteredRows) ids.add(person.id);
    for (const person of contactRows) ids.add(person.id);
    return [...ids];
  }, [requests.data, filteredRows, contactRows, query]);
  const mutualCounts = useMutualCounts(mutualCountIds);
  const mutualsFor = (id: string) => mutualCounts.data?.[id] ?? 0;
  /** Swap a generic note for the mutual count when we know one. */
  const withMutuals = (person: FindRow): FindRow => {
    const count = mutualsFor(person.id);
    if (count > 0 && person.state === "none") {
      return { ...person, note: `${count} mutual friend${count === 1 ? "" : "s"}` };
    }
    return person;
  };

  const inviteContact = (name: string) => {
    const handle = myProfile.data?.username;
    const message = `Hey ${name.split(" ")[0]} — join me on Spotted, the daily gym check-in app. ${handle ? `Add me when you're in: @${handle}` : "See you in there!"}`;
    // Link rides IN the text — some iOS share targets drop the separate `url`
    // field, which delivered link-less invites to testers.
    void Share.share({ message: `${message}\n${APP_STORE_URL}` });
  };

  // Friends-tab filter (same search-bar format as Messages).
  const [friendSearch, setFriendSearch] = useState("");
  const friendQuery = friendSearch.trim().toLowerCase();
  const filteredFriendRows = useMemo(
    () =>
      friendQuery
        ? (friends.data ?? []).filter((friend) =>
            `${friend.display_name} ${friend.username}`.toLowerCase().includes(friendQuery)
          )
        : friends.data ?? [],
    [friends.data, friendQuery]
  );

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

  // DM list: real conversations only (groups always list, even before the
  // first message). No placeholder rows for friends without a thread.
  const dmThreads = useMemo(() => {
    return (inbox.data ?? []).filter((t) => t.isGroup || !t.empty);
  }, [inbox.data]);

  const openThread = (profileId: string) => {
    inboxActions.clearUnread(profileId);
    router.push(`/chat/${profileId}`);
  };

  const openGroupThread = (conversationId: string) => {
    inboxActions.clearUnread(conversationId);
    router.push(`/chat/${conversationId}?group=1`);
  };

  const runRelationshipAction = (person: FindRow) => {
    const from = relationships.stateFor(person.id, person.state);
    const transition = relationships.advance(person.id, person.name);
    if (!transition || !person.real) return;
    if (from === "none" && transition.to === "requested") {
      sendFriendRequest.mutate(person.id);
    } else if (from === "incoming" && transition.to === "friend") {
      respondToRequest.mutate({ requesterId: person.id, accept: true });
    } else if (from === "requested" && transition.to === "none") {
      cancelFriendRequest.mutate(person.id);
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

  // Quick Add — suggestions to add, minus anyone dismissed / already actioned /
  // already surfaced in the contacts section. People with a REAL signal
  // (mutuals, same gym, crews, interactions) lead; pure cold suggestions trail.
  //
  // The pool fetched from the server is deliberately much larger than what is
  // shown (see useFriendSuggestions), so dismissing someone backfills the slot
  // INSTANTLY from memory instead of waiting on a refetch. Cold suggestions
  // used to be hard-capped at 3, which in a small user base — where almost
  // nobody has mutuals yet — meant the list ran dry after a couple of X's.
  // One display cap over the whole ranked list replaces that.
  const { quickAdd, cycledThrough } = useMemo(() => {
    const contactIds = new Set(contactRows.map((person) => person.id));
    // Everyone the server is willing to suggest, ignoring your X's.
    const pool = realFindRows.filter(
      (person) =>
        person.state === "none" &&
        !contactIds.has(person.id) &&
        relationships.stateFor(person.id, "none") === "none"
    );
    const eligible = pool.filter((person) => !dismissed.has(person.id));
    const withSignal = eligible.filter((person) => person.note !== "Suggested for you");
    const cold = eligible.filter((person) => person.note === "Suggested for you");
    return {
      quickAdd: [...withSignal, ...cold].slice(0, QUICK_ADD_VISIBLE),
      // Empty because you X'd your way through everyone — NOT because there was
      // nobody to suggest. Those two need different copy: one is an
      // accomplishment with an undo, the other is an empty app.
      cycledThrough: eligible.length === 0 && pool.length > 0
    };
  }, [realFindRows, contactRows, dismissed, relationships]);

  const addQuickAdd = (person: FindRow) => {
    relationships.setRelationship(person.id, "requested");
    sendFriendRequest.mutate(person.id);
    setDismissed((prev) => new Set(prev).add(person.id));
    // Pull fresh suggestions in so the Quick Add feed stays populated.
    void suggestions.refetch();
  };
  const dismissQuickAdd = (id: string) => {
    // Instant local hide + persisted 7-day cooldown; the settle-refetch pulls
    // a fresh suggestion in to backfill the slot.
    setDismissed((prev) => new Set(prev).add(id));
    dismissSuggestion.mutate(id);
  };
  /**
   * "Start over" on the cycled-through empty state: drop the server-side
   * dismissals and un-hide locally. Only ids currently in the suggestion pool
   * are un-hidden — people you ADDED are also in `dismissed`, and they stay
   * filtered out by their "requested" relationship state regardless.
   */
  const restartSuggestions = () => {
    const poolIds = new Set((suggestions.data ?? []).map((person) => person.id));
    setDismissed((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (!poolIds.has(id)) next.add(id);
      }
      return next;
    });
    resetSuggestions.mutate();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: NAV_H + insets.bottom + 12 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.fog}
            colors={[colors.white]}
          />
        }
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
          {/* Compose (IG-style pencil): one friend → 1:1 chat, several → group. */}
          {tab === "Messages" ? (
            <Pressable
              onPress={() => sheet.open(<NewMessageSheet />)}
              accessibilityLabel="New message"
              hitSlop={8}
              style={{ width: 40, height: 40, alignItems: "flex-end", justifyContent: "center" }}
            >
              <SquarePen size={22} color={colors.white} strokeWidth={2} />
            </Pressable>
          ) : null}
        </View>
        <Segmented
          options={["Messages", "Friends", "Add Friends"]}
          value={tab}
          onChange={(next) => {
            Keyboard.dismiss();
            setTab(next);
          }}
        />

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
                  No friends match. Add them in Add Friends first.
                </Text>
              )
            ) : (
              <>
                {/* Inbox still loading with nothing cached yet — skeleton rows. */}
                {inbox.isLoading && dmThreads.length === 0 ? (
                  <SkeletonRows count={5} />
                ) : null}
                {/* Active conversations — swipe left to delete (for you only).
                    Soft inset hairlines separate rows, iMessage-style. */}
                {dmThreads.map((thread, index) => (
                  <View key={`real-${thread.conversationId}`}>
                    {index > 0 ? <View style={styles.threadDivider} /> : null}
                    <SwipeableThreadRow
                      name={thread.name}
                      // Swiping a group away = LEAVE it (deleting would nuke it
                      // for every member; only 1:1 threads hard-delete).
                      onDelete={() =>
                        thread.isGroup
                          ? leaveGroup.mutate(thread.conversationId)
                          : deleteConversation.mutate(thread.conversationId)
                      }
                    >
                      <ListRow
                        big
                        left={<Avatar name={thread.name} uri={thread.avatarUrl} size={58} />}
                        name={thread.muted ? `${thread.name} · muted` : thread.name}
                        sub={thread.preview}
                        subStrong={thread.unread}
                        time={thread.time}
                        unread={thread.unread}
                        onPress={() => (thread.isGroup ? openGroupThread(thread.conversationId) : openThread(thread.profileId))}
                      />
                    </SwipeableThreadRow>
                  </View>
                ))}
                {!inbox.isLoading && dmThreads.length === 0 ? (
                  <View style={{ paddingTop: 48, alignItems: "center", paddingHorizontal: 32 }}>
                    <Text style={{ fontSize: 13, color: colors.fog, textAlign: "center" }}>
                      No messages yet. Open a friend&apos;s profile and tap Message.
                    </Text>
                  </View>
                ) : null}
              </>
            )}
          </View>
        ) : tab === "Friends" ? (
              <View>
                {/* Same format as the Messages tab (search bar first, hairline
                    dividers) so switching tabs doesn't shift the list. */}
                <SearchBar
                  value={friendSearch}
                  onChangeText={setFriendSearch}
                  placeholder="Search friends"
                  containerStyle={{ marginHorizontal: 18, marginTop: 2, marginBottom: 8 }}
                />
                {(friends.data ?? []).length === 0 ? (
                  <Text style={{ paddingTop: 40, textAlign: "center", fontSize: 13, color: colors.fog, paddingHorizontal: 32 }}>
                    No friends yet. Add them in the Add Friends tab.
                  </Text>
                ) : filteredFriendRows.length === 0 ? (
                  <Text style={{ paddingTop: 36, textAlign: "center", fontSize: 13, color: colors.fog, paddingHorizontal: 32 }}>
                    No friends match.
                  </Text>
                ) : (
                  filteredFriendRows.map((friend, index) => {
                    const went = friendsPostedToday.data?.has(friend.id) ?? false;
                    const taunted = nudgedIds.has(friend.id) || (myTauntsToday.data?.targets.has(friend.id) ?? false);
                    return (
                      <View key={`friend-${friend.id}`}>
                      {index > 0 ? <View style={styles.threadDivider} /> : null}
                      <ListRow
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
                              accessibilityLabel={taunted ? `Taunted ${friend.display_name}` : `Taunt ${friend.display_name}`}
                              accessibilityState={{ disabled: taunted }}
                              onPress={() => tauntFriend(friend.id)}
                              disabled={taunted}
                              style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: taunted ? colors.iron : colors.slate }}
                            >
                              <Text style={{ fontSize: 12, fontFamily: "Geist_600SemiBold", color: taunted ? colors.fog : colors.white }}>
                                {taunted ? "Taunted" : "Taunt"}
                              </Text>
                            </Pressable>
                          )
                        }
                        onPress={() => router.push(`/user/${friend.username}`)}
                      />
                      </View>
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
                peopleSearch.isFetching ? (
                  <SkeletonRows count={4} />
                ) : (
                  <Text style={{ paddingTop: 36, textAlign: "center", fontSize: 13, color: colors.fog, paddingHorizontal: 32 }}>
                    No one found. Try a different name.
                  </Text>
                )
              ) : (
                filteredRows.map((person) => (
                  <SearchResultRow
                    key={person.id}
                    person={withMutuals(person)}
                    state={relationships.stateFor(
                      person.id,
                      searchStates.data?.get(person.id) ?? person.state
                    )}
                    onRelationship={() => {
                      // keyboardShouldPersistTaps lets this tap through, but the
                      // keyboard has to go once the user acts on a result.
                      Keyboard.dismiss();
                      runRelationshipAction(person);
                    }}
                    onOpen={() => {
                      Keyboard.dismiss();
                      router.push(`/user/${person.handle.replace(/^@/, "")}`);
                    }}
                  />
                ))
              )
            ) : (
              <>
                {/* Added Me — pinned above suggestions, with Accept / Decline. */}
                {addedMe.length ? (
                  <View>
                    <SectionLabel>Added Me</SectionLabel>
                    <View style={styles.sectionCard}>
                      {addedMe.map((request) => (
                        <AddedMeRow
                          key={`req-${request.profile.id}`}
                          name={request.profile.display_name}
                          handle={request.profile.username}
                          avatarUrl={request.profile.avatar_url}
                          mutuals={mutualsFor(request.profile.id)}
                          onAccept={() => acceptRequest(request.profile.id)}
                          onDecline={() => declineRequest(request.profile.id)}
                          onOpen={() => router.push(`/user/${request.profile.username}`)}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}

                {/* Pending — requests you SENT. A button rather than an
                    expanded list: once you've added a few people the inline
                    version pushed suggestions off-screen. Cancelling lives on
                    the dedicated screen, Snapchat-style. */}
                {(sentRequests.data ?? []).length ? (
                  <Pressable
                    onPress={() => router.push("/pending-requests")}
                    accessibilityLabel={`Pending sent requests, ${(sentRequests.data ?? []).length}`}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        marginHorizontal: 16,
                        marginBottom: 14,
                        paddingVertical: 13,
                        paddingHorizontal: 14,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: colors.iron,
                        backgroundColor: colors.graphite
                      }}
                    >
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 17,
                          borderWidth: 1,
                          borderColor: colors.iron,
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                      >
                        <Clock size={16} color={colors.mist} strokeWidth={2.2} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.white }}>
                          Pending requests
                        </Text>
                        <Text style={{ marginTop: 1, fontSize: 11.5, color: colors.fog }}>
                          {`${(sentRequests.data ?? []).length} waiting · tap to cancel`}
                        </Text>
                      </View>
                      <ChevronRight size={18} color={colors.fog} strokeWidth={2} />
                    </View>
                  </Pressable>
                ) : null}

                {/* Friends on Spotted — contact MATCHES only. Inviting moved
                    to its own searchable sheet (the old inline list just
                    showed whoever sorted first alphabetically). */}
                {contactsPerm.available ? (
                  <>
                    <SectionLabel>Friends on Spotted</SectionLabel>
                    <View style={styles.sectionCard}>
                      {!contactsPerm.granted ? (
                        <Pressable
                          onPress={() => {
                            if (contactsPerm.canAskAgain) contactsPerm.request.mutate();
                            else showToast("Allow contacts access in Settings to find friends");
                          }}
                          accessibilityLabel="Find friends from contacts"
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 14 }}>
                            <View style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: colors.iron, alignItems: "center", justifyContent: "center" }}>
                              <BookUser size={20} color={tokens.accent.gold} strokeWidth={2} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14.5, color: colors.white }}>
                                Find friends from contacts
                              </Text>
                              <Text style={{ marginTop: 2, fontSize: 12.5, color: colors.fog }}>
                                See who's already on Spotted. Contacts stay on your device.
                              </Text>
                            </View>
                            <ChevronRight size={18} color={colors.fog} />
                          </View>
                        </Pressable>
                      ) : contactMatches.isLoading ? (
                        <SkeletonRows count={2} />
                      ) : (
                        <>
                          {contactRows
                            .filter((person) => relationships.stateFor(person.id, "none") === "none")
                            .map((person) => (
                              <QuickAddRow
                                key={`contact-${person.id}`}
                                person={person}
                                onAdd={() => addQuickAdd(person)}
                                onDismiss={() => dismissQuickAdd(person.id)}
                                onOpen={() => router.push(`/user/${person.handle.replace(/^@/, "")}`)}
                              />
                            ))}
                          {contactRows.length === 0 ? (
                            <Text style={{ paddingTop: 12, paddingHorizontal: 14, fontSize: 12.5, color: colors.fog }}>
                              None of your contacts are on Spotted yet.
                            </Text>
                          ) : null}
                          {/* Invite lives behind one clear row → searchable sheet. */}
                          <Pressable
                            onPress={() =>
                              sheet.open(
                                <InviteContactsSheet
                                  contacts={contactMatches.data?.invitable ?? []}
                                  onInvite={inviteContact}
                                />
                              )
                            }
                            accessibilityLabel="Invite friends to Spotted"
                          >
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 14 }}>
                              <View style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: "rgba(232,180,76,0.45)", backgroundColor: "rgba(232,180,76,0.10)", alignItems: "center", justifyContent: "center" }}>
                                <UserPlus size={20} color={tokens.accent.gold} strokeWidth={2} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14.5, color: colors.white }}>Invite friends</Text>
                                <Text style={{ marginTop: 2, fontSize: 12.5, color: colors.fog }}>
                                  Search your contacts and send an invite
                                </Text>
                              </View>
                              <ChevronRight size={18} color={colors.fog} />
                            </View>
                          </Pressable>
                        </>
                      )}
                    </View>
                  </>
                ) : null}

                {/* Suggested — signal-ranked (mutuals, your gym, crews,
                    interactions); each row says why it's here. */}
                <SectionLabel>Suggested</SectionLabel>
                <View style={styles.sectionCard}>
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
                  ) : cycledThrough ? (
                    // You reached the end of the list rather than finding it
                    // empty — say so, and offer the way back.
                    <View style={{ paddingVertical: 18, paddingHorizontal: 24, alignItems: "center", gap: 12 }}>
                      <Text style={{ textAlign: "center", fontSize: 13, color: colors.fog, lineHeight: 19 }}>
                        {"That's everyone for now. More show up as people join."}
                      </Text>
                      <Pressable
                        onPress={restartSuggestions}
                        accessibilityLabel="Show dismissed suggestions again"
                        hitSlop={6}
                      >
                        <View
                          style={{
                            paddingVertical: 8,
                            paddingHorizontal: 18,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: colors.iron,
                            opacity: resetSuggestions.isPending ? 0.5 : 1
                          }}
                        >
                          <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 12.5, color: colors.white }}>
                            {resetSuggestions.isPending ? "…" : "Start over"}
                          </Text>
                        </View>
                      </Pressable>
                    </View>
                  ) : (
                    <Text style={{ paddingVertical: 16, textAlign: "center", fontSize: 13, color: colors.fog, paddingHorizontal: 24 }}>
                      No suggestions right now. Search for friends by name or handle.
                    </Text>
                  )}
                </View>
              </>
            )}
            </View>
        )}
      </ScrollView>
    </View>
  );
}

/** Instagram-style account search row: bold username first, real name + why
 *  underneath in gray, big avatar, whole row opens the profile. */
function SearchResultRow({
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
  const handle = person.handle.replace(/^@/, "");
  const secondary = [person.name, person.note].filter(Boolean).join(" \u00b7 ");
  return (
    <Pressable onPress={onOpen} accessibilityLabel={`Open ${handle}'s profile`}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 8 }}>
        <Avatar name={person.name} uri={person.avatarUrl} size={54} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontFamily: "Geist_700Bold", fontSize: 14.5, color: colors.white }}>
            {handle}
          </Text>
          <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 13, color: colors.fog }}>
            {secondary}
          </Text>
        </View>
        <RelButton label={button.label} kind={button.kind} disabled={button.disabled} onPress={onRelationship} />
      </View>
    </Pressable>
  );
}

/** Pinned "Added Me" row — Accept / Decline an incoming request. */
function AddedMeRow({
  name,
  handle,
  avatarUrl,
  mutuals = 0,
  onAccept,
  onDecline,
  onOpen
}: {
  name: string;
  handle: string;
  avatarUrl: string | null;
  mutuals?: number;
  onAccept: () => void;
  onDecline: () => void;
  onOpen: () => void;
}) {
  return (
    <ListRow
      left={<Avatar name={name} uri={avatarUrl} size={46} />}
      name={name}
      sub={`@${handle} · added you${mutuals > 0 ? ` · ${mutuals} mutual${mutuals === 1 ? "" : "s"}` : ""}`}
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



/** Searchable full-contact-list invite sheet — replaces the old inline list
 *  that just showed whoever sorted first alphabetically. */
function InviteContactsSheet({
  contacts,
  onInvite
}: {
  contacts: InvitableContact[];
  onInvite: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const rows = q ? contacts.filter((c) => c.name.toLowerCase().includes(q)) : contacts;
  return (
    <View>
      <SheetTitle>Invite friends</SheetTitle>
      <SheetSub>Spotted&apos;s better with your crew — send an invite by text.</SheetSub>
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search contacts" />
      </View>
      {/* Gesture-handler ScrollView: RN's own ScrollView inside the bottom
          sheet fights the sheet's pan for the gesture — the reported
          crash-on-scroll in this list. */}
      <SheetScrollView style={{ maxHeight: 400 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
        {rows.slice(0, 60).map((contact) => (
          <ListRow
            key={contact.key}
            left={<Avatar name={contact.name} size={44} />}
            name={contact.name}
            sub={contact.phone}
            right={<RelButton label="Invite" kind="quiet" onPress={() => onInvite(contact.name)} />}
          />
        ))}
        {rows.length === 0 ? (
          <Text style={{ paddingVertical: 20, textAlign: "center", fontSize: 12.5, color: colors.fog }}>
            No contacts match.
          </Text>
        ) : null}
      </SheetScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Soft inset hairline between conversation rows (starts past the avatar). */
  threadDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.graphite,
    marginLeft: 88,
    marginRight: 18
  },
  /** Raised section surface — breaks up the wall of black on the Find tab. */
  sectionCard: {
    marginHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.ink,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    overflow: "hidden",
    paddingVertical: 4
  }
});
