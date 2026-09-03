import { Lock, Pencil, Plus } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { appAlert } from "@/components/ui/AppDialog";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ChoiceRow } from "@/components/ui/ChoiceRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListRow } from "@/components/ui/ListRow";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { SearchBar } from "@/components/ui/SearchBar";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { TextField } from "@/components/ui/TextField";
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
import { icon, radius, space, tokens } from "@/theme/tokens";

type Draft = { id: string | null; name: string; memberIds: string[] };

/**
 * Settings → Stories: manage private stories — see who's in each, rename,
 * change members, delete, or create a new one. (Posting happens from the
 * camera's "Share to" picker; this is the standalone management surface.)
 */
export default function StoriesSettingsScreen() {
  const insets = useSafeAreaInsets();
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

  const rows = lists.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title="Stories" sub="Private stories" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: insets.bottom + space[10] }}
      >
        <Text variant="meta" className="pb-3">
          Private stories only show to the friends you put in them. Post to one from the camera&apos;s &ldquo;Share
          to&rdquo; picker.
        </Text>

        {lists.isLoading ? <SkeletonRows count={3} /> : null}

        {!lists.isLoading && rows.length === 0 ? (
          <EmptyState
            icon={<Lock size={icon.size.sm + 2} color={colors.silver} strokeWidth={icon.stroke.regular} />}
            title="No private stories yet"
            body="Make one for your inner circle — only the friends you pick can see what you post to it."
            paddingTop={space[6]}
          />
        ) : null}

        {rows.map((list) => (
          <StoryRow
            key={list.id}
            list={list}
            onEdit={() => setDraft({ id: list.id, name: list.name, memberIds: list.members.map((m) => m.userId) })}
          />
        ))}

        <View style={{ paddingTop: space[4] }}>
          <Button
            icon={<Plus size={icon.size.xs} color={colors.black} strokeWidth={icon.stroke.bold} />}
            onPress={() => setDraft({ id: null, name: "", memberIds: [] })}
          >
            New private story
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

/** One private story: lock tile · name · member count · avatar strip · edit glyph. */
function StoryRow({ list, onEdit }: { list: PrivateStory; onEdit: () => void }) {
  const shown = list.members.slice(0, 5);
  return (
    <ListRow
      name={list.name}
      sub={`${list.members.length} ${list.members.length === 1 ? "person" : "people"}`}
      onPress={onEdit}
      left={
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.pill,
            backgroundColor: tokens.bg.subtle,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Lock size={icon.size.xs + 1} color={colors.white} strokeWidth={icon.stroke.regular} />
        </View>
      }
      right={
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] + 2 }}>
          {shown.length > 0 ? (
            <View style={{ flexDirection: "row" }}>
              {shown.map((m, i) => (
                <View key={m.userId} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                  <Avatar name={m.displayName} uri={m.avatarUrl} size={24} borderColor={colors.black} borderWidth={2} />
                </View>
              ))}
            </View>
          ) : null}
          <Pencil size={icon.size.xs} color={tokens.text.tertiary} strokeWidth={icon.stroke.regular} />
        </View>
      }
    />
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
  const insets = useSafeAreaInsets();
  const friends = useFriends();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const rows = (friends.data ?? []).filter(
    (friend) => !q || `${friend.display_name} ${friend.username}`.toLowerCase().includes(q)
  );
  const toggle = (id: string) =>
    setDraft({
      ...draft,
      memberIds: draft.memberIds.includes(id) ? draft.memberIds.filter((m) => m !== id) : [...draft.memberIds, id]
    });

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      {/* Back returns to the list view, not the settings hub. */}
      <PanelHeader title={draft.id ? "Edit story" : "New story"} onBack={() => setDraft(null)} />
      <View style={{ flex: 1, paddingHorizontal: space[4] }}>
        <Text variant="micro" className="mb-2">
          Name
        </Text>
        <TextField
          value={draft.name}
          onChangeText={(name) => setDraft({ ...draft, name })}
          placeholder="e.g. Gym Rats"
          maxLength={40}
          accessibilityLabel="Story name"
        />

        <View
          style={{
            marginTop: space[4] + 4,
            marginBottom: space[2],
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <Text variant="micro">Who can see it</Text>
          <Text variant="mono">{`${draft.memberIds.length} selected`}</Text>
        </View>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search friends" />

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1, marginTop: space[2] }}
          contentContainerStyle={{ paddingBottom: space[3] }}
        >
          {friends.isLoading ? (
            <SkeletonRows count={5} />
          ) : rows.length === 0 ? (
            <Text variant="meta" className="pt-6 text-center">
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

        <View style={{ paddingBottom: insets.bottom + space[3], gap: space[2] }}>
          <Button onPress={onSave} loading={saving} disabled={saving || !draft.name.trim()}>
            {draft.id ? "Save changes" : "Create private story"}
          </Button>
          {onDelete ? (
            <Button variant="danger" onPress={onDelete}>
              Delete private story
            </Button>
          ) : null}
        </View>
      </View>
    </View>
  );
}
