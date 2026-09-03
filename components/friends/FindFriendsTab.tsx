import { useRouter } from "expo-router";
import { BookUser, Clock, UserPlus, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Keyboard, Share, View } from "react-native";
import { ScrollView as SheetScrollView } from "react-native-gesture-handler";

import { RelButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pressable } from "@/components/ui/Pressable";
import { SearchBar } from "@/components/ui/SearchBar";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { SettingNavRow } from "@/components/ui/SettingRow";
import { SheetSub, SheetTitle, useSheet } from "@/components/ui/Sheet";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { UserRow } from "@/components/ui/UserRow";
import { useMutualCounts } from "@/hooks/queries/useFollowing";
import {
  useCancelFriendRequest,
  useDismissSuggestion,
  useFriendSuggestions,
  useFriends,
  useFriendshipStates,
  useIncomingRequests,
  useOutgoingRequests,
  useResetSuggestions,
  useRespondToRequest,
  useSearchPeople,
  useSendFriendRequest
} from "@/hooks/queries/useFriends";
import { useMyProfile } from "@/hooks/queries/useProfile";
import { useContactMatches, useContactsPermission, type InvitableContact } from "@/hooks/useContacts";
import { APP_STORE_URL } from "@/lib/share";
import { relationshipButton, useRelationships } from "@/stores/relationships";
import { showToast } from "@/stores/ui";
import { icon, radius, space, tokens } from "@/theme/tokens";
import type { FindPerson, RelationshipState } from "@/types/redesign";

type FindRow = FindPerson & { avatarUrl?: string | null; real?: boolean };

/** How many Quick Add rows are shown at once. The fetched pool is far larger
 *  so dismissals backfill instantly rather than waiting on a refetch. */
const QUICK_ADD_VISIBLE = 12;

const bareHandle = (handle: string) => handle.replace(/^@/, "");

/** Search result: handle first, name + reason underneath, relationship button. */
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
  return (
    <UserRow
      name={bareHandle(person.handle)}
      avatarUrl={person.avatarUrl}
      sub={[person.name, person.note].filter(Boolean).join(" · ")}
      right={<RelButton label={button.label} kind={button.kind} disabled={button.disabled} onPress={onRelationship} />}
      onPress={onOpen}
    />
  );
}

/** Incoming request — Accept / Decline. */
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
    <UserRow
      name={name}
      avatarUrl={avatarUrl}
      sub={`@${handle} · added you${mutuals > 0 ? ` · ${mutuals} mutual${mutuals === 1 ? "" : "s"}` : ""}`}
      right={
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <RelButton label="Accept" kind="primary" onPress={onAccept} />
          <RelButton label="Decline" kind="quiet" onPress={onDecline} />
        </View>
      }
      onPress={onOpen}
    />
  );
}

/** Suggestion — Add + dismiss. */
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
  return (
    <UserRow
      name={person.name}
      avatarUrl={person.avatarUrl}
      sub={`@${bareHandle(person.handle)} · ${person.note}`}
      right={
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <RelButton label="Add" kind="primary" onPress={onAdd} />
          <Pressable onPress={onDismiss} haptic="none" accessibilityLabel={`Dismiss ${person.name}`} hitSlop={8}>
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: tokens.border.default,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <X size={14} color={tokens.text.tertiary} strokeWidth={icon.stroke.bold} />
            </View>
          </Pressable>
        </View>
      }
      onPress={onOpen}
    />
  );
}

/** Searchable full-contact-list invite sheet. */
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
      <View style={{ paddingHorizontal: space[4] + 4, paddingBottom: space[2] }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search contacts" />
      </View>
      {/* Gesture-handler ScrollView: RN's own ScrollView inside the bottom
          sheet fights the sheet's pan for the gesture. */}
      <SheetScrollView style={{ maxHeight: 400 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
        {rows.slice(0, 60).map((contact) => (
          <UserRow
            key={contact.key}
            name={contact.name}
            sub={contact.phone}
            right={<RelButton label="Invite" kind="ghost" onPress={() => onInvite(contact.name)} />}
          />
        ))}
        {rows.length === 0 ? (
          <View style={{ paddingVertical: space[6], alignItems: "center" }}>
            <Text variant="meta">No contacts match.</Text>
          </View>
        ) : null}
      </SheetScrollView>
    </View>
  );
}

/** Add Friends tab: search · Added Me · Pending · Contacts · Suggested. */
export function FindFriendsTab() {
  const router = useRouter();
  const sheet = useSheet();
  const [search, setSearch] = useState("");
  // IG-style live search: debounce keystrokes so the server sees settled input.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const friends = useFriends();
  const suggestions = useFriendSuggestions();
  const requests = useIncomingRequests();
  // Requests YOU sent that are still pending.
  const sentRequests = useOutgoingRequests();
  const sendFriendRequest = useSendFriendRequest();
  const cancelFriendRequest = useCancelFriendRequest();
  const dismissSuggestion = useDismissSuggestion();
  const resetSuggestions = useResetSuggestions();
  const respondToRequest = useRespondToRequest();
  const relationships = useRelationships();
  const myProfile = useMyProfile();
  // Contacts matching — only after consent.
  const contactsPerm = useContactsPermission();
  const contactMatches = useContactMatches(contactsPerm.granted);

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
        // Ranked server-side; the reason string says WHY this person surfaced.
        note: person.mutual_friends_count
          ? `${person.mutual_friends_count} mutual friend${person.mutual_friends_count === 1 ? "" : "s"}`
          : (person.reason ?? "Suggested for you"),
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
    if (!query) return realFindRows;
    const matched = realFindRows.filter((person) => `${person.name} ${person.handle}`.toLowerCase().includes(query));
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

  // Real relationship state for search results (the search RPC returns bare
  // profiles) — otherwise someone already requested shows "Add" again.
  const searchResultIds = useMemo(() => (query ? filteredRows.map((person) => person.id) : []), [query, filteredRows]);
  const searchStates = useFriendshipStates(searchResultIds);

  // Batch mutual-friend counts for whatever people rows are on screen.
  const mutualCountIds = useMemo(() => {
    const ids = new Set<string>();
    for (const request of requests.data ?? []) ids.add(request.profile.id);
    if (query) for (const person of filteredRows) ids.add(person.id);
    for (const person of contactRows) ids.add(person.id);
    return [...ids];
  }, [requests.data, filteredRows, contactRows, query]);
  const mutualCounts = useMutualCounts(mutualCountIds);
  const mutualsFor = (id: string) => mutualCounts.data?.[id] ?? 0;
  const withMutuals = (person: FindRow): FindRow => {
    const count = mutualsFor(person.id);
    return count > 0 && person.state === "none"
      ? { ...person, note: `${count} mutual friend${count === 1 ? "" : "s"}` }
      : person;
  };

  const inviteContact = (name: string) => {
    const handle = myProfile.data?.username;
    const message = `Hey ${name.split(" ")[0]} — join me on Spotted, the daily gym check-in app. ${handle ? `Add me when you're in: @${handle}` : "See you in there!"}`;
    // Link rides IN the text — some iOS share targets drop the separate `url`.
    void Share.share({ message: `${message}\n${APP_STORE_URL}` });
  };

  const runRelationshipAction = (person: FindRow) => {
    const from = relationships.stateFor(person.id, person.state);
    const transition = relationships.advance(person.id, person.name);
    if (!transition || !person.real) return;
    if (from === "none" && transition.to === "requested") sendFriendRequest.mutate(person.id);
    else if (from === "incoming" && transition.to === "friend")
      respondToRequest.mutate({ requesterId: person.id, accept: true });
    else if (from === "requested" && transition.to === "none") cancelFriendRequest.mutate(person.id);
  };

  const addedMe = requests.data ?? [];
  const acceptRequest = (id: string) => {
    relationships.setRelationship(id, "friend");
    respondToRequest.mutate({ requesterId: id, accept: true });
  };
  const declineRequest = (id: string) => respondToRequest.mutate({ requesterId: id, accept: false });

  // Quick Add — suggestions minus anyone dismissed / actioned / in contacts.
  // People with a REAL signal lead; cold suggestions trail. The pool is much
  // larger than what's shown so dismissals backfill instantly.
  const { quickAdd, cycledThrough } = useMemo(() => {
    const contactIds = new Set(contactRows.map((person) => person.id));
    const pool = realFindRows.filter(
      (person) =>
        person.state === "none" && !contactIds.has(person.id) && relationships.stateFor(person.id, "none") === "none"
    );
    const eligible = pool.filter((person) => !dismissed.has(person.id));
    const withSignal = eligible.filter((person) => person.note !== "Suggested for you");
    const cold = eligible.filter((person) => person.note === "Suggested for you");
    return {
      quickAdd: [...withSignal, ...cold].slice(0, QUICK_ADD_VISIBLE),
      // Empty because you X'd through everyone — not because nobody exists.
      cycledThrough: eligible.length === 0 && pool.length > 0
    };
  }, [realFindRows, contactRows, dismissed, relationships]);

  const addQuickAdd = (person: FindRow) => {
    relationships.setRelationship(person.id, "requested");
    sendFriendRequest.mutate(person.id);
    setDismissed((prev) => new Set(prev).add(person.id));
    void suggestions.refetch();
  };
  const dismissQuickAdd = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
    dismissSuggestion.mutate(id);
  };
  /** Drop server-side dismissals and un-hide locally (only current pool ids —
   *  people you ADDED stay filtered by their "requested" state). */
  const restartSuggestions = () => {
    const poolIds = new Set((suggestions.data ?? []).map((person) => person.id));
    setDismissed((prev) => {
      const next = new Set<string>();
      for (const id of prev) if (!poolIds.has(id)) next.add(id);
      return next;
    });
    resetSuggestions.mutate();
  };

  const openProfile = (handle: string) => {
    Keyboard.dismiss();
    router.push(`/user/${bareHandle(handle)}`);
  };

  const pendingSent = sentRequests.data?.length ?? 0;

  return (
    <View>
      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder="Search people"
        containerStyle={{ marginHorizontal: space[4], marginBottom: space[2] }}
      />
      {query ? (
        filteredRows.length === 0 ? (
          peopleSearch.isFetching ? (
            <SkeletonRows count={4} />
          ) : (
            <EmptyState title="No one found" body="Try a different name." center paddingTop={space[8]} />
          )
        ) : (
          filteredRows.map((person) => (
            <SearchResultRow
              key={person.id}
              person={withMutuals(person)}
              state={relationships.stateFor(person.id, searchStates.data?.get(person.id) ?? person.state)}
              onRelationship={() => {
                Keyboard.dismiss();
                runRelationshipAction(person);
              }}
              onOpen={() => openProfile(person.handle)}
            />
          ))
        )
      ) : (
        <>
          {addedMe.length ? (
            <View style={{ paddingTop: space[2] }}>
              <SectionLabel style={{ paddingHorizontal: space[4] }}>Added me</SectionLabel>
              {addedMe.map((request) => (
                <AddedMeRow
                  key={`req-${request.profile.id}`}
                  name={request.profile.display_name}
                  handle={request.profile.username}
                  avatarUrl={request.profile.avatar_url}
                  mutuals={mutualsFor(request.profile.id)}
                  onAccept={() => acceptRequest(request.profile.id)}
                  onDecline={() => declineRequest(request.profile.id)}
                  onOpen={() => openProfile(request.profile.username)}
                />
              ))}
            </View>
          ) : null}

          {pendingSent > 0 ? (
            <View style={{ paddingHorizontal: space[4] }}>
              <SettingNavRow
                icon={<Clock size={icon.size.sm} color={tokens.text.primary} strokeWidth={icon.stroke.regular} />}
                title="Pending requests"
                sub={`${pendingSent} waiting · tap to cancel`}
                onPress={() => router.push("/pending-requests")}
              />
            </View>
          ) : null}

          {contactsPerm.available ? (
            <View style={{ paddingTop: space[4] }}>
              <SectionLabel style={{ paddingHorizontal: space[4] }}>Friends on Spotted</SectionLabel>
              {!contactsPerm.granted ? (
                <View style={{ paddingHorizontal: space[4] }}>
                  <SettingNavRow
                    icon={
                      <BookUser size={icon.size.sm} color={tokens.text.primary} strokeWidth={icon.stroke.regular} />
                    }
                    title="Find friends from contacts"
                    sub="See who's already on Spotted. Contacts stay on your device."
                    onPress={() => {
                      if (contactsPerm.canAskAgain) contactsPerm.request.mutate();
                      else showToast("Allow contacts access in Settings to find friends");
                    }}
                  />
                </View>
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
                        onOpen={() => openProfile(person.handle)}
                      />
                    ))}
                  {contactRows.length === 0 ? (
                    <View style={{ paddingHorizontal: space[4], paddingVertical: space[2] }}>
                      <Text variant="meta">None of your contacts are on Spotted yet.</Text>
                    </View>
                  ) : null}
                  <View style={{ paddingHorizontal: space[4] }}>
                    <SettingNavRow
                      icon={
                        <UserPlus size={icon.size.sm} color={tokens.text.primary} strokeWidth={icon.stroke.regular} />
                      }
                      title="Invite friends"
                      sub="Search your contacts and send an invite"
                      onPress={() =>
                        sheet.open(
                          <InviteContactsSheet
                            contacts={contactMatches.data?.invitable ?? []}
                            onInvite={inviteContact}
                          />
                        )
                      }
                    />
                  </View>
                </>
              )}
            </View>
          ) : null}

          <View style={{ paddingTop: space[4] }}>
            <SectionLabel style={{ paddingHorizontal: space[4] }}>Suggested</SectionLabel>
            {quickAdd.length ? (
              quickAdd.map((person) => (
                <QuickAddRow
                  key={person.id}
                  person={person}
                  onAdd={() => addQuickAdd(person)}
                  onDismiss={() => dismissQuickAdd(person.id)}
                  onOpen={() => openProfile(person.handle)}
                />
              ))
            ) : suggestions.isLoading ? (
              <SkeletonRows count={3} />
            ) : cycledThrough ? (
              <EmptyState
                title="That's everyone for now"
                body="More show up as people join."
                center
                paddingTop={space[4]}
              >
                <RelButton
                  label={resetSuggestions.isPending ? "…" : "Start over"}
                  kind="ghost"
                  disabled={resetSuggestions.isPending}
                  onPress={restartSuggestions}
                />
              </EmptyState>
            ) : (
              <EmptyState
                title="No suggestions right now"
                body="Search for friends by name or handle."
                center
                paddingTop={space[4]}
              />
            )}
          </View>
        </>
      )}
    </View>
  );
}
