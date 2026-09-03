import { Users } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import { IconTile } from "@/components/camera/ComposeChrome";
import { Button } from "@/components/ui/Button";
import { ChoiceRow } from "@/components/ui/ChoiceRow";
import { SheetSub, SheetTitle, useSheet } from "@/components/ui/Sheet";
import { Text } from "@/components/ui/Text";
import { useMyCommunities, type CommunitySummary } from "@/hooks/queries/useCommunities";
import { colors } from "@/theme/colors";
import { icon, space } from "@/theme/tokens";

/** Post to communities — gym communities require the post to be tagged at that gym. */
export function CommunitySheet({
  chosenGymId,
  initial,
  onDone
}: {
  chosenGymId: string | null;
  initial: string[];
  onDone: (ids: string[]) => void;
}) {
  const sheet = useSheet();
  const communities = useMyCommunities();
  const [selected, setSelected] = useState(initial);

  const eligible = (community: CommunitySummary) => community.type !== "gym" || community.gym_id === chosenGymId;

  const toggle = (community: CommunitySummary) => {
    if (!eligible(community)) return;
    setSelected((ids) =>
      ids.includes(community.id) ? ids.filter((id) => id !== community.id) : [...ids, community.id]
    );
  };

  return (
    <View>
      <SheetTitle>Post to a community</SheetTitle>
      <SheetSub>Gym communities need this post tagged at that gym. Your other communities are always open.</SheetSub>
      {(communities.data ?? []).length === 0 && !communities.isLoading ? (
        <Text variant="meta" className="px-6 py-3">
          You&apos;re not in any communities yet. Join one from the Communities tab first.
        </Text>
      ) : null}
      {(communities.data ?? []).map((community) => {
        const disabled = !eligible(community);
        const sub = disabled
          ? "Tag this gym on the post to share here"
          : `${community.type[0].toUpperCase()}${community.type.slice(1)} · ${community.memberCount} member${community.memberCount === 1 ? "" : "s"}`;
        return (
          <ChoiceRow
            key={community.id}
            title={community.name}
            sub={sub}
            selected={selected.includes(community.id)}
            disabled={disabled}
            left={
              <IconTile>
                <Users size={icon.size.xs} color={colors.mist} strokeWidth={icon.stroke.regular} />
              </IconTile>
            }
            onPress={() => toggle(community)}
          />
        );
      })}
      <View style={{ paddingHorizontal: space[4] + 4, paddingTop: space[3] }}>
        <Button
          onPress={() => {
            onDone(selected);
            sheet.close();
          }}
        >
          Done
        </Button>
      </View>
    </View>
  );
}
