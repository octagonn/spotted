import { Lock, Pencil, Plus } from "lucide-react-native";
import { appAlert } from "@/components/ui/AppDialog";
import { useState } from "react";
import { ScrollView, TextInput, View } from "react-native";

import { Screen } from "@/components/Screen";
import { Avatar } from "@/components/ui/Avatar";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { ChoiceRow } from "@/components/ui/ChoiceRow";
import { Pressable } from "@/components/ui/Pressable";
import { SearchBar } from "@/components/ui/SearchBar";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
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

type Draft = { id: string | null; name: string; memberIds: string[] };

/**
 * Settings → Stories: manage private stories — see who's in each, rename,
 * change members, delete, or create a new one. (Posting happens from the
 * camera's "Share to" picker; this is the standalone management surface.)
 */
export default function StoriesSettingsScreen() {
  const lists = useMyPrivateStories();
  const createStory = useCreatePrivateStory();
  const updateStory = useUpdatePrivateStory();
  const deleteStory = useDeletePrivateStory();

  /** null = list view; otherwise the create/edit form. */
  const [draft, setDraft] = useState<Draft | null>(null);

  const confirmDelete = (list: { id: string; name: string }) => {
    appAlert("Delete private story?", `"${list.name}" and everything posted to it disappear for everyone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          deleteStory.mutate(list.id, {
            onSuccess: () => {
              setDraft(null);
              showToast("Private story deleted");
            },
            onError: () => showToast("Couldn't delete — try again")
          })
      }
    ]);
  };

  const save = () => {
    if (!draft || !draft.name.trim()) return;
    if (draft.memberIds.length === 0) {
      showToast("Pick at least one friend");
      return;
    }
    const done = (msg: string) => {
      setDraft(null);
      showToast(msg);
    };
    if (draft.id) {
      updateStory.mutate(
        { id: draft.id, name: draft.name, memberIds: draft.memberIds },
        { onSuccess: () => done("Private story updated"), onError: () => showToast("Couldn't save — try again") }
      );
    } else {
      createStory.mutate(
        { name: draft.name, memberIds: draft.memberIds },
        { onSuccess: () => done("Private story created"), onError: () => showToast("Couldn't create — try again") }
      );
    }
  };

  if (draft) {
    return (
      <EditorView
        draft={draft}
        setDraft={setDraft}
        onSave={save}
        saving={createStory.isPending || updateStory.isPending}
        onDelete={draft.id ? () => confirmDelete({ id: draft.id as string, name: draft.name }) : undefined}
      />
    );
  }

  return (
    <Screen scroll={false}>
      <View className="px-4" style={{ flex: 1 }}>
        <BackButton fallback="/settings" style={{ marginBottom: 18 }} />
        <Text variant="display-sm">STORIES</Text>
        <Text variant="caption" className="mt-2 text-mist">
          Private stories only show to the friends you put in them. Post to one from the camera&apos;s
          &ldquo;Share to&rdquo; picker.
        </Text>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }}>
          {lists.isLoading ? <SkeletonRows count={3} /> : null}

          {!lists.isLoading && (lists.data ?? []).length === 0 ? (
            <View className="items-center rounded-card border border-hairline-strong bg-ink p-6">
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: radius.pill,
                  backgroundColor: tokens.bg.subtle,
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Lock size={22} color={colors.white} strokeWidth={1.9} />
              </View>
              <Text variant="body-strong" className="mt-4 text-white">
                No private stories yet
              </Text>
              <Text variant="caption" className="mt-1 text-center text-fog">
                Make one for your inner circle — only the friends you pick can see what you post to it.
              </Text>
            </View>
          ) : null}

          {(lists.data ?? []).map((list) => (
            <StoryCard
              key={list.id}
              list={list}
              onEdit={() => setDraft({ id: list.id, name: list.name, memberIds: list.members.map((m) => m.userId) })}
            />
          ))}

          <Button
            className="mt-4"
            icon={<Plus size={16} color={colors.black} />}
            onPress={() => setDraft({ id: null, name: "", memberIds: [] })}
          >
            New private story
          </Button>
        </ScrollView>
      </View>
    </Screen>
  );
}

/** One private story: name, member count, avatar strip, edit affordance. */
function StoryCard({ list, onEdit }: { list: PrivateStory; onEdit: () => void }) {
  const shown = list.members.slice(0, 5);
  return (
    <Pressable onPress={onEdit} accessibilityLabel={`Edit ${list.name}`}>
      <View className="mb-3 rounded-card border border-hairline-strong bg-ink p-4">
        <View className="flex-row items-center gap-3">
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
          <View className="flex-1">
            <Text variant="body-strong" className="text-white">
              {list.name}
            </Text>
            <Text variant="caption" className="mt-0.5 text-fog">
              {list.members.length} {list.members.length === 1 ? "person" : "people"}
            </Text>
          </View>
          <Pencil size={16} color={colors.fog} strokeWidth={2} />
        </View>
        {shown.length > 0 ? (
          <View className="mt-3 flex-row items-center">
            {shown.map((m, i) => (
              <View key={m.userId} style={{ marginLeft: i === 0 ? 0 : -10 }}>
                <View style={{ borderWidth: 2, borderColor: colors.black, borderRadius: radius.pill }}>
                  <Avatar name={m.displayName} uri={m.avatarUrl} size={30} />
                </View>
              </View>
            ))}
            {list.members.length > shown.length ? (
              <Text variant="caption" className="ml-2 text-fog">
                +{list.members.length - shown.length} more
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Full-screen create/edit: name + friend checklist + save/delete. */
function EditorView({
  draft,
  setDraft,
  onSave,
  saving,
  onDelete
}: {
  draft: Draft;
  setDraft: (d: Draft | null) => void;
  onSave: () => void;
  saving: boolean;
  onDelete?: () => void;
}) {
  const friends = useFriends();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const rows = (friends.data ?? []).filter(
    (friend) => !q || `${friend.display_name} ${friend.username}`.toLowerCase().includes(q)
  );
  const toggle = (id: string) =>
    setDraft({
      ...draft,
      memberIds: draft.memberIds.includes(id)
        ? draft.memberIds.filter((m) => m !== id)
        : [...draft.memberIds, id]
    });

  return (
    <Screen scroll={false}>
      <View className="px-4" style={{ flex: 1 }}>
        {/* Back returns to the list view, not the settings hub. */}
        <Pressable
          accessibilityLabel="Back to stories"
          onPress={() => setDraft(null)}
          style={{ alignSelf: "flex-start", marginBottom: 18 }}
        >
          <View className="flex-row items-center gap-2 rounded-pill border border-hairline-strong bg-glass-strong px-3 py-1.5">
            <Text variant="micro" className="text-mist">
              BACK
            </Text>
          </View>
        </Pressable>
        <Text variant="display-sm">{draft.id ? "EDIT STORY" : "NEW STORY"}</Text>

        <View className="mt-5">
          <Text variant="micro" className="mb-2 text-mist">
            NAME
          </Text>
          <TextInput
            value={draft.name}
            onChangeText={(name) => setDraft({ ...draft, name })}
            placeholder="e.g. Gym Rats"
            placeholderTextColor={colors.fog}
            maxLength={40}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: radius.sm,
              backgroundColor: tokens.bg.raised,
              borderWidth: 1,
              borderColor: tokens.border.default,
              fontFamily: "Geist_400Regular",
              fontSize: 15,
              color: colors.white
            }}
          />
        </View>

        <View className="mt-5 mb-2 flex-row items-center justify-between">
          <Text variant="micro" className="text-mist">
            WHO CAN SEE IT
          </Text>
          <Text variant="micro" className="text-fog">
            {draft.memberIds.length} SELECTED
          </Text>
        </View>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search friends" />

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1, marginTop: 8 }}
          contentContainerStyle={{ paddingBottom: 12 }}
        >
          {friends.isLoading ? (
            <SkeletonRows count={5} />
          ) : rows.length === 0 ? (
            <Text variant="caption" className="pt-6 text-center text-fog">
              {q ? "No friends match that name." : "No friends yet — add your crew first."}
            </Text>
          ) : (
            rows.map((friend) => (
              <ChoiceRow
                key={friend.id}
                title={friend.display_name}
                sub={`@${friend.username}`}
                selected={draft.memberIds.includes(friend.id)}
                left={<Avatar name={friend.display_name} uri={friend.avatar_url} size={40} />}
                onPress={() => toggle(friend.id)}
              />
            ))
          )}
        </ScrollView>

        <View style={{ paddingBottom: 24, gap: 8 }}>
          <Button onPress={onSave} loading={saving} disabled={saving || !draft.name.trim()}>
            {draft.id ? "Save changes" : "Create private story"}
          </Button>
          {onDelete ? (
            <Pressable accessibilityLabel="Delete private story" onPress={onDelete} style={{ alignItems: "center", paddingVertical: 8 }}>
              <Text variant="caption" className="text-[#E5484D]">
                Delete private story
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
