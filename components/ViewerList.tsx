import { View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { Text } from "@/components/ui/Text";
import type { ViewerPreview } from "@/types/domain";

type ViewerListProps = {
  data: ViewerPreview;
};

export function ViewerList({ data }: ViewerListProps) {
  return (
    <View className="gap-4 p-5">
      <Text variant="title">WATCHING</Text>
      {data.viewers.map((viewer) => (
        <View key={viewer.id} className="flex-row items-center gap-3 border-t border-hairline-strong pt-3">
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
