import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Camera } from "lucide-react-native";
import { Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { ListRow } from "@/components/ui/ListRow";
import { SheetSub, SheetTitle, useSheet } from "@/components/ui/Sheet";
import { type ReactionSelfie } from "@/hooks/queries/usePostReactionSelfies";
import { colors } from "@/theme/colors";

/** Bottom-sheet list of everyone who live-reacted to a post — tap to open a profile. */
export function ReactionsSheet({ reactors }: { reactors: ReactionSelfie[] }) {
  const router = useRouter();
  const sheet = useSheet();
  return (
    <View>
      <SheetTitle>Reactions</SheetTitle>
      <SheetSub>{`${reactors.length} ${reactors.length === 1 ? "person" : "people"} reacted`}</SheetSub>
      {reactors.length === 0 ? (
        <Text style={{ paddingHorizontal: 20, paddingVertical: 16, fontSize: 12.5, color: colors.fog }}>
          No reactions yet.
        </Text>
      ) : (
        reactors.map((r) => (
          <ListRow
            key={r.userId}
            left={
              r.mediaUrl ? (
                <Image source={{ uri: r.mediaUrl }} style={{ width: 46, height: 46, borderRadius: 23 }} contentFit="cover" />
              ) : (
                <Avatar name={r.name} size={46} />
              )
            }
            name={r.mine ? `${r.name} (you)` : r.name}
            sub={`@${r.username}`}
            right={
              // Always show WHAT they reacted with: their emoji, or a selfie
              // thumbnail (with a camera glyph) when it was a photo reaction.
              r.emoji ? (
                <Text style={{ fontSize: 24 }}>{r.emoji}</Text>
              ) : r.mediaUrl ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Camera size={14} color={colors.fog} strokeWidth={2} />
                  <Image source={{ uri: r.mediaUrl }} style={{ width: 30, height: 30, borderRadius: 8 }} contentFit="cover" />
                </View>
              ) : (
                <Text style={{ fontSize: 22 }}>🔥</Text>
              )
            }
            onPress={() => {
              sheet.close();
              router.push(`/user/${r.username}`);
            }}
          />
        ))
      )}
    </View>
  );
}
