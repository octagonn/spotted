import { ChevronLeft, Lock, Pencil, Plus, Users } from "lucide-react-native";
import { appAlert } from "@/components/ui/AppDialog";
import { useState } from "react";
import { Text, TextInput, useWindowDimensions, View } from "react-native";
import { ScrollView as SheetScrollView } from "react-native-gesture-handler";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ChoiceRow } from "@/components/ui/ChoiceRow";
import { Pressable } from "@/components/ui/Pressable";
import { SearchBar } from "@/components/ui/SearchBar";
import { useSheet, SheetTitle } from "@/components/ui/Sheet";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useFriends } from "@/hooks/queries/useFriends";
import {
  useCreatePrivateStory,
  useDeletePrivateStory,
  useMyPrivateStories,
  useUpdatePrivateStory,
  type PrivateStory
} from "@/hooks/queries/usePrivateStories";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { radius, tokens } from "@/theme/tokens";

export type StoryDestination = { id: string | null; name: string };

/**
 * Share-destination picker for stories: "My Story" (friends) or one of your
 * PRIVATE stories (audience-limited lists). Creating, renaming, re-listing and
 * deleting private stories all happens here — right where you use them.
 */
export function StoryDestinationSheet({
  selected,
  onSelect
}: {
  selected: StoryDestination;
  onSelect: (dest: StoryDestination) => void;
}) {
  const sheet = useSheet();
  const lists = useMyPrivateStories();
  const createStory = useCreatePrivateStory();
  const updateStory = useUpdatePrivateStory();
  const deleteStory = useDeletePrivateStory();
  const { height: windowHeight } = useWindowDimensions();
  const listHeight = Math.min(320, Math.round(windowHeight * 0.36));

  /** null = destination list; otherwise the create/edit form. */
  const [editing, setEditing] = useState<null | { id: string | null; name: string; memberIds: string[] }>(null);

  const pick = (dest: StoryDestination) => {
    onSelect(dest);
    sheet.close();
  };

  const saveForm = () => {
    if (!editing || !editing.name.trim()) return;
    if (editing.memberIds.length === 0) {
      showToast("Pick at least one friend");
      return;
    }
    if (editing.id) {
      updateStory.mutate(
        { id: editing.id, name: editing.name, memberIds: editing.memberIds },
        {
          onSuccess: () => {
            // Keep the selected chip's label fresh if this list is the target.
            if (selected.id === editing.id) onSelect({ id: editing.id, name: editing.name.trim() });
            setEditing(null);
            showToast("Private story updated");
          },
          onError: () => showToast("Couldn't save — try again")
        }
      );
    } else {
      createStory.mutate(
        { name: editing.name, memberIds: editing.memberIds },
        {
          onSuccess: (id) => {
            // A brand-new list becomes the share target immediately.
            onSelect({ id, name: editing.name.trim() });
            sheet.close();
          },
          onError: () => showToast("Couldn't create — try again")
        }
      );
    }
  };

  const confirmDelete = (list: PrivateStory) => {
    appAlert("Delete private story?", `"${list.name}" and everything posted to it disappear for everyone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          deleteStory.mutate(list.id, {
            onSuccess: () => {
              if (selected.id === list.id) onSelect({ id: null, name: "My Story" });
              setEditing(null);
              showToast("Private story deleted");
            },
            onError: () => showToast("Couldn't delete — try again")
          })
      }
    ]);
  };

  if (editing) {
    return (
      <MemberForm
        editing={editing}
        setEditing={setEditing}
        onSave={saveForm}
        saving={createStory.isPending || updateStory.isPending}
        onDelete={
          editing.id
            ? () => {
                const list = (lists.data ?? []).find((l) => l.id === editing.id);
                if (list) confirmDelete(list);
              }
            : undefined
        }
      />
    );
  }

  return (
    <View>
      <SheetTitle>Share to</SheetTitle>
      <View style={{ height: listHeight }}>
        <SheetScrollView nestedScrollEnabled>
          <ChoiceRow
            title="My Story"
            sub="All your friends can see it"
            selected={selected.id === null}
            left={
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.pill,
                  backgroundColor: tokens.bg.subtle,
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Users size={18} color={colors.white} strokeWidth={1.9} />
              </View>
            }
            onPress={() => pick({ id: null, name: "My Story" })}
          />
          {lists.isLoading ? <SkeletonRows count={2} style={{ paddingTop: 6 }} /> : null}
          {(lists.data ?? []).map((list) => (
            <View key={list.id} style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <ChoiceRow
                  title={list.name}
                  sub={`${list.members.length} ${list.members.length === 1 ? "person" : "people"} · private`}
                  selected={selected.id === list.id}
                  left={
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: radius.pill,
                        backgroundColor: tokens.bg.subtle,
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      <Lock size={17} color={colors.white} strokeWidth={1.9} />
                    </View>
                  }
                  onPress={() => pick({ id: list.id, name: list.name })}
                />
              </View>
              <Pressable
                accessibilityLabel={`Edit ${list.name}`}
                onPress={() =>
                  setEditing({ id: list.id, name: list.name, memberIds: list.members.map((m) => m.userId) })
                }
                hitSlop={8}
                style={{ paddingHorizontal: 16, paddingVertical: 12 }}
              >
                <Pencil size={16} color={colors.fog} strokeWidth={2} />
              </Pressable>
            </View>
          ))}
          {/* new private story */}
          <Pressable
            accessibilityLabel="New private story"
            onPress={() => setEditing({ id: null, name: "", memberIds: [] })}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 20,
              paddingVertical: 12
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.pill,
                borderWidth: 1.5,
                borderColor: tokens.border.strong,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Plus size={18} color={colors.white} strokeWidth={2.2} />
            </View>
            <View>
              <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 15, color: colors.white }}>
                New private story
              </Text>
              <Text style={{ marginTop: 1, fontSize: 12.5, color: colors.fog }}>
                Only the friends you pick can see it
              </Text>
            </View>
          </Pressable>
        </SheetScrollView>
      </View>
    </View>
  );
}

/** Create/edit form: name + friend multi-select (+ delete when editing). */
function MemberForm({
  editing,
  setEditing,
  onSave,
  saving,
  onDelete
}: {
  editing: { id: string | null; name: string; memberIds: string[] };
  setEditing: (v: null | { id: string | null; name: string; memberIds: string[] }) => void;
  onSave: () => void;
  saving: boolean;
  onDelete?: () => void;
}) {
  const friends = useFriends();
  const { height: windowHeight } = useWindowDimensions();
  const listHeight = Math.min(260, Math.round(windowHeight * 0.28));
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const rows = (friends.data ?? []).filter(
    (friend) => !q || `${friend.display_name} ${friend.username}`.toLowerCase().includes(q)
  );
  const toggle = (id: string) =>
    setEditing({
      ...editing,
      memberIds: editing.memberIds.includes(id) ? editing.memberIds.filter((m) => m !== id) : [...editing.memberIds, id]
    });

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20 }}>
        <Pressable accessibilityLabel="Back to destinations" onPress={() => setEditing(null)} hitSlop={8}>
          <ChevronLeft size={20} color={colors.fog} />
        </Pressable>
        <Text style={{ flex: 1, fontFamily: "Geist_700Bold", fontSize: 18, color: colors.white, marginLeft: 8 }}>
          {editing.id ? "Edit private story" : "New private story"}
        </Text>
      </View>

      <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
        <TextInput
          value={editing.name}
          onChangeText={(name) => setEditing({ ...editing, name })}
          placeholder="Name it — e.g. Gym Rats"
          placeholderTextColor={colors.fog}
          maxLength={40}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: radius.sm,
            backgroundColor: tokens.bg.subtle,
            borderWidth: 1,
            borderColor: tokens.border.default,
            fontFamily: "Geist_400Regular",
            fontSize: 15,
            color: colors.white
          }}
        />
      </View>

      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search friends" />
      </View>
      <View style={{ height: listHeight }}>
        {friends.isLoading ? (
          <SkeletonRows count={4} style={{ paddingTop: 6 }} />
        ) : rows.length === 0 ? (
          <Text style={{ paddingTop: 24, textAlign: "center", fontSize: 12.5, color: colors.fog }}>
            {q ? "No friends match that name." : "No friends yet — add your crew first."}
          </Text>
        ) : (
          <SheetScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {rows.map((friend) => (
              <ChoiceRow
                key={friend.id}
                title={friend.display_name}
                sub={`@${friend.username}`}
                selected={editing.memberIds.includes(friend.id)}
                left={<Avatar name={friend.display_name} uri={friend.avatar_url} size={40} />}
                onPress={() => toggle(friend.id)}
              />
            ))}
          </SheetScrollView>
        )}
      </View>

      <View style={{ paddingHorizontal: 20, paddingTop: 12, gap: 8 }}>
        <Button onPress={onSave} loading={saving} disabled={saving || !editing.name.trim()}>
          {editing.id ? "Save changes" : `Create${editing.memberIds.length ? ` (${editing.memberIds.length})` : ""}`}
        </Button>
        {onDelete ? (
          <Pressable
            accessibilityLabel="Delete private story"
            onPress={onDelete}
            style={{ alignItems: "center", paddingVertical: 8 }}
          >
            <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 13.5, color: tokens.status.danger }}>
              Delete private story
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
