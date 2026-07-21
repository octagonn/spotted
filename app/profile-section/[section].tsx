import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Trophy } from "lucide-react-native";
import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DailyCell } from "@/components/profile/cards";
import { TrophyCase } from "@/components/trophies/TrophyCase";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { useMyProfile, useUserPosts } from "@/hooks/queries/useProfile";
import { localDateKey } from "@/stores/ui";
import { colors } from "@/theme/colors";

type ProfileSection = "trophies" | "videos" | "posts";

type ArchiveDay = { id: string; date: string };
type ArchiveMonth = { label: string; days: ArchiveDay[] };

/** Group own posts into per-month day cells, newest month first. */
function buildArchive(createdDates: string[]): ArchiveMonth[] {
  const months = new Map<string, Map<string, ArchiveDay>>();
  for (const iso of createdDates) {
    const date = new Date(iso);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const dayKey = localDateKey(date);
    if (!months.has(monthKey)) {
      months.set(monthKey, new Map());
    }
    months.get(monthKey)!.set(dayKey, { id: dayKey, date: String(date.getDate()) });
  }
  return [...months.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([monthKey, days]) => {
      const [year, month] = monthKey.split("-").map(Number);
      const label = new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
      return { label, days: [...days.values()].sort((a, b) => b.id.localeCompare(a.id)) };
    });
}

export default function ProfileSectionScreen() {
  const { section: rawSection } = useLocalSearchParams<{ section: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useMyProfile();
  const myPosts = useUserPosts(profile.data?.id);
  const section: ProfileSection = ["trophies", "videos", "posts"].includes(rawSection)
    ? (rawSection as ProfileSection)
    : "trophies";

  const archive = useMemo(
    () => buildArchive((myPosts.data ?? []).map((post) => post.created_at)),
    [myPosts.data]
  );

  const title = section === "posts" ? "Daily posts" : `${section[0].toUpperCase()}${section.slice(1)}`;
  const sub =
    section === "trophies"
      ? "Your trophy case"
      : section === "videos"
        ? "Videos — coming soon"
        : "Your archive, month by month";

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}>
        <PanelHeader title={title} sub={sub} />
        {section === "trophies" ? <TrophyCase /> : null}
        {section === "videos" ? (
          <ComingSoon
            icon={<Trophy size={22} color={colors.white} />}
            title="Videos are coming soon"
            body="Record a video from the camera once video posting ships, and your proof reel collects here."
          />
        ) : null}
        {section === "posts" ? (
          <View>
            {archive.length === 0 ? (
              <Text style={{ paddingHorizontal: 18, paddingTop: 24, fontSize: 13, color: colors.fog }}>
                {myPosts.isLoading ? "Loading your archive…" : "No dailies yet. Your posts will collect here."}
              </Text>
            ) : (
              archive.map((month) => (
                <View key={month.label}>
                  <MonthLabel>{month.label}</MonthLabel>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 18 }}>
                    {month.days.map((day) => (
                      <DailyCell
                        key={day.id}
                        id={day.id}
                        date={day.id === localDateKey() ? "Today" : day.date}
                        onPress={() => router.push(`/daily/${day.id}` as Href)}
                      />
                    ))}
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ComingSoon({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <View style={{ alignItems: "center", paddingTop: 48, paddingHorizontal: 40 }}>
      <View
        style={{
          width: 58,
          height: 58,
          borderRadius: 29,
          borderWidth: 1.5,
          borderColor: colors.slate,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        {icon}
      </View>
      <Text style={{ marginTop: 16, fontFamily: "Geist_700Bold", fontSize: 15, color: colors.white, textAlign: "center" }}>
        {title}
      </Text>
      <Text style={{ marginTop: 8, fontSize: 12.5, lineHeight: 18, color: colors.fog, textAlign: "center" }}>
        {body}
      </Text>
    </View>
  );
}

function MonthLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        paddingTop: 18,
        paddingHorizontal: 18,
        paddingBottom: 10,
        fontFamily: "GeistMono_400Regular",
        fontSize: 10.5,
        letterSpacing: 10.5 * 0.14,
        textTransform: "uppercase",
        color: colors.fog
      }}
    >
      {children}
    </Text>
  );
}
