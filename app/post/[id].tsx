import { useLocalSearchParams } from "expo-router";

import { Screen } from "@/components/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { ViewerList } from "@/components/ViewerList";
import { usePostViewers } from "@/hooks/queries/usePostViewers";

export default function PostDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const viewers = usePostViewers(params.id ?? "");

  return (
    <Screen>
      <Text variant="display-sm">VIEWERS</Text>
      <Text variant="caption" className="mt-2 italic">
        No timestamps. That gets weird.
      </Text>
      <Sheet className="mt-8">
        {viewers.data ? (
          <ViewerList data={viewers.data} />
        ) : (
          <SkeletonRows count={4} avatar={34} />
        )}
      </Sheet>
    </Screen>
  );
}
