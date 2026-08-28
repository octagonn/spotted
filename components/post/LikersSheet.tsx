import { useRouter } from "expo-router";
import { Heart } from "lucide-react-native";
import { ScrollView, Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { ListRow } from "@/components/ui/ListRow";
import { SheetSub, SheetTitle, useSheet } from "@/components/ui/Sheet";
import { usePostLikers } from "@/hooks/queries/usePostReactions";
import { useAuthStore } from "@/stores/auth";
import { colors } from "@/theme/colors";

/** Bottom-sheet list of everyone who liked a post — tap a row to open a profile. */
export function LikersSheet({ postId }: { postId: string }) {
  const router = useRouter();
  const sheet = useSheet();
  const myId = useAuthStore((state) => state.userId);
  const likers = usePostLikers(postId);
  const rows = likers.data ?? [];

  return (
    <View>
      <SheetTitle>Likes</SheetTitle>
      <SheetSub>{`${rows.length} ${rows.length === 1 ? "person likes" : "people like"} this post`}</SheetSub>
      {likers.isLoading ? (
        <Text style={{ paddingHorizontal: 20, paddingVertical: 16, fontSize: 12.5, color: colors.fog }}>Loading…</Text>
      ) : rows.length === 0 ? (
        <Text style={{ paddingHorizontal: 20, paddingVertical: 16, fontSize: 12.5, color: colors.fog }}>
          No likes yet.
        </Text>
      ) : (
        <ScrollView style={{ maxHeight: 420 }}>
          {rows.map((liker) => {
            const mine = liker.userId === myId;
            return (
              <ListRow
                key={liker.userId}
                left={<Avatar name={liker.displayName} uri={liker.avatarUrl} size={46} />}
                name={mine ? `${liker.displayName} (you)` : liker.displayName}
                sub={liker.username ? `@${liker.username}` : undefined}
                right={<Heart size={16} color="#FF2D55" fill="#FF2D55" strokeWidth={2} />}
                onPress={
                  mine || !liker.username
                    ? undefined
                    : () => {
                        sheet.close();
                        router.push(`/user/${liker.username}`);
                      }
                }
              />
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
