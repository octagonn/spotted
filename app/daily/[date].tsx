import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PanelHeader } from "@/components/ui/PanelHeader";
import { useMyProfile, useUserPosts } from "@/hooks/queries/useProfile";
import { signedPostUrl } from "@/lib/supabase";
import { localDateKey } from "@/stores/ui";
import { colors } from "@/theme/colors";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function DailyPostScreen() {
  const { date = "" } = useLocalSearchParams<{ date: string }>();
  const insets = useSafeAreaInsets();
  const profile = useMyProfile();
  const posts = useUserPosts(profile.data?.id);
  const [mediaUri, setMediaUri] = useState<string | null>(null);

  const parts = date.split("-").map(Number);
  const day = Number.isFinite(parts[2]) ? parts[2] : 1;
  const month = MONTHS[(parts[1] || 1) - 1] ?? "";

  const dayPost = (posts.data ?? []).find((post) => localDateKey(new Date(post.created_at)) === date);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!dayPost?.media_url) {
        setMediaUri(null);
        return;
      }
      if (dayPost.media_url.startsWith("http")) {
        setMediaUri(dayPost.media_url);
        return;
      }
      try {
        const url = await signedPostUrl(dayPost.media_url);
        if (!cancelled) setMediaUri(url);
      } catch {
        if (!cancelled) setMediaUri(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dayPost?.media_url]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}>
        <PanelHeader title="Daily post" sub={`${day} ${month}`} />
        {!dayPost ? (
          <Text style={{ paddingTop: 40, textAlign: "center", fontSize: 13, color: colors.fog }}>
            {posts.isLoading ? "Loading…" : "No post saved for this day."}
          </Text>
        ) : (
          <>
            <View
              style={{
                marginHorizontal: 18,
                marginTop: 8,
                aspectRatio: 3 / 3.6,
                borderRadius: 16,
                overflow: "hidden",
                backgroundColor: colors.graphite
              }}
            >
              {mediaUri ? (
                <Image source={{ uri: mediaUri }} contentFit="cover" style={{ flex: 1 }} transition={150} />
              ) : null}
            </View>
            {dayPost.caption ? (
              <Text style={{ paddingHorizontal: 18, paddingTop: 12, fontSize: 13.5, lineHeight: 19, color: colors.mist }}>
                <Text style={{ fontFamily: "Geist_700Bold", color: colors.white }}>
                  {profile.data?.username ?? ""}
                </Text>
                {"  "}
                {dayPost.caption}
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
