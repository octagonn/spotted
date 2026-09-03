import { router } from "expo-router";
import { BookUser } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OnboardingHeader } from "@/components/auth/OnboardingHeader";
import { Button, RelButton } from "@/components/ui/Button";
import { SettingNavRow } from "@/components/ui/SettingRow";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { UserRow } from "@/components/ui/UserRow";
import { useFriendSuggestions, useSendFriendRequest } from "@/hooks/queries/useFriends";
import { useContactMatches, useContactsPermission } from "@/hooks/useContacts";
import { usePageFade } from "@/hooks/usePageFade";
import { advanceOnboarding } from "@/lib/onboarding";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";
import { icon, space, tokens } from "@/theme/tokens";

/** How many suggestion rows onboarding shows — a taste, not the full firehose. */
const SUGGESTIONS_SHOWN = 8;

/**
 * Final onboarding step: add friends BEFORE first landing on the feed. With a
 * home gym set (previous step, mandatory), having friends moves check-in rate
 * from 6% to 47% — so contacts sync and same-gym suggestions are surfaced
 * here instead of living only in the discoverable-later Find Friends tab.
 * Adding is encouraged, not gated: Continue always works.
 */
export default function OnboardingFriendsScreen() {
  const insets = useSafeAreaInsets();
  const { fadeStyle, fadeNavigate } = usePageFade();
  const userId = useAuthStore((state) => state.userId);

  const suggestions = useFriendSuggestions();
  const sendFriendRequest = useSendFriendRequest();
  const contactsPerm = useContactsPermission();
  const contactMatches = useContactMatches(contactsPerm.granted);

  // Local per-screen state is enough here: the Find Friends tab re-derives
  // real relationship state the first time it mounts after onboarding.
  const [requested, setRequested] = useState<Set<string>>(new Set());

  const addPerson = (id: string) => {
    setRequested((prev) => new Set(prev).add(id));
    sendFriendRequest.mutate(id, {
      onError: () => {
        // Roll the optimistic "Requested" back so the button is tappable again
        // — otherwise a failed send reads as sent and the request never exists.
        setRequested((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        showToast("Couldn't send that request — try again");
      }
    });
  };

  const contactRows = useMemo(() => contactMatches.data?.matches ?? [], [contactMatches.data]);
  const contactIds = useMemo(() => new Set(contactRows.map((m) => m.id)), [contactRows]);
  const suggestionRows = useMemo(
    () => (suggestions.data ?? []).filter((s) => !contactIds.has(s.id)).slice(0, SUGGESTIONS_SHOWN),
    [suggestions.data, contactIds]
  );

  const finish = () => {
    void advanceOnboarding(userId, "complete");
    fadeNavigate(() => router.replace("/feed"));
  };

  return (
    <Animated.View className="flex-1 px-4" style={[{ paddingTop: insets.top + 16 }, fadeStyle]}>
      <OnboardingHeader
        step={8}
        title="FIND YOUR CREW."
        body="Friends are why check-ins stick. Add a few now — your gym's regulars are up top."
      />

      <ScrollView
        className="mt-6 flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: space[4] }}
      >
        {contactsPerm.available && !contactsPerm.granted ? (
          <SettingNavRow
            icon={<BookUser size={icon.size.sm} color={tokens.text.primary} strokeWidth={icon.stroke.regular} />}
            title="Find friends from contacts"
            sub="See who's already on Spotted. Contacts stay on your device."
            onPress={() => {
              if (contactsPerm.canAskAgain) contactsPerm.request.mutate();
              else showToast("Allow contacts access in Settings to find friends");
            }}
          />
        ) : null}

        {contactsPerm.granted && contactMatches.isLoading ? <SkeletonRows count={2} /> : null}
        {contactRows.map((match) => (
          <UserRow
            key={`contact-${match.id}`}
            name={match.display_name}
            avatarUrl={match.avatar_url}
            sub={`@${match.username} · in your contacts`}
            right={
              <RelButton
                label={requested.has(match.id) ? "Requested" : "Add"}
                kind={requested.has(match.id) ? "quiet" : "primary"}
                disabled={requested.has(match.id)}
                onPress={() => addPerson(match.id)}
              />
            }
          />
        ))}

        {suggestions.isLoading ? (
          <SkeletonRows count={4} />
        ) : (
          suggestionRows.map((person) => (
            <UserRow
              key={person.id}
              name={person.display_name}
              avatarUrl={person.avatar_url}
              sub={
                person.mutual_friends_count
                  ? `@${person.username} · ${person.mutual_friends_count} mutual friend${person.mutual_friends_count === 1 ? "" : "s"}`
                  : `@${person.username} · ${person.reason ?? "Suggested for you"}`
              }
              right={
                <RelButton
                  label={requested.has(person.id) ? "Requested" : "Add"}
                  kind={requested.has(person.id) ? "quiet" : "primary"}
                  disabled={requested.has(person.id)}
                  onPress={() => addPerson(person.id)}
                />
              }
            />
          ))
        )}

        {!suggestions.isLoading && suggestionRows.length === 0 && contactRows.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: space[8] }}>
            <Text variant="caption" className="text-mist">
              No one to suggest yet — you can find friends any time from the feed.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={{ paddingBottom: insets.bottom + 12 }}>
        <Button className="mt-2" onPress={finish}>
          {requested.size > 0
            ? `Continue with ${requested.size} request${requested.size === 1 ? "" : "s"} sent`
            : "Continue"}
        </Button>
      </View>
    </Animated.View>
  );
}
