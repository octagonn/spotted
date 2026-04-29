import { View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import type { ViewerPreview } from "@/types/domain";

type ViewerListProps = {
  data: ViewerPreview;
  onUpgrade?: () => void;
};

export function ViewerList({ data, onUpgrade }: ViewerListProps) {
  if (data.tier === "free") {
    const hidden = Math.max(data.total_count - data.viewers.length, 0);
    return (
      <View className="gap-4 p-5">
        <Text variant="title">WATCHING</Text>
        <View className="gap-3">
          {data.viewers.map((viewer, index) => (
            <View
              key={`${viewer.avatar_blurred_url ?? "viewer"}-${index}`}
              className="flex-row items-center gap-3 border-t border-iron pt-3"
            >
              <Avatar uri={viewer.avatar_blurred_url} muted />
              <View className="flex-1">
                <View className="h-3 w-28 bg-slate" />
                <View className="mt-2 h-2 w-16 bg-ash" />
              </View>
            </View>
          ))}
        </View>
        <View className="border border-iron bg-ink p-4">
          <Text variant="display-sm">+{hidden}</Text>
          <Text variant="caption" className="mt-2 italic">
            See who's been watching.
          </Text>
          <Button className="mt-4" onPress={onUpgrade}>
            Spotted+
          </Button>
        </View>
      </View>
    );
  }
  return (
    <View className="gap-4 p-5">
      <Text variant="title">WATCHING</Text>
      {data.viewers.map((viewer) => (
        <View key={viewer.id} className="flex-row items-center gap-3 border-t border-iron pt-3">
          <Avatar uri={viewer.avatar_url} />
          <View>
            <Text variant="body-strong">{viewer.display_name}</Text>
            <Text variant="micro">@{viewer.username}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
