import { Globe, Lock, MapPin } from "lucide-react-native";
import { View } from "react-native";

import { GymLogo } from "@/components/GymLogo";
import { CachedImage } from "@/components/ui/CachedImage";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import type { CommunitySummary } from "@/hooks/queries/useCommunities";
import { COMMUNITY_ICONS } from "@/lib/communityTypes";
import { colors } from "@/theme/colors";
import { icon, radius, space, tokens } from "@/theme/tokens";

/** Community page identity: logo/photo · name · members (tappable) · privacy · location · description. */
export function CommunityHeader({
  community,
  onOpenMembers
}: {
  community: CommunitySummary;
  onOpenMembers: () => void;
}) {
  const isGym = community.type === "gym";
  const isPrivate = community.privacy === "private";
  const Icon = COMMUNITY_ICONS[community.type];
  const metaColor = tokens.text.tertiary;
  return (
    <View style={{ paddingHorizontal: space[4], paddingTop: space[1] + 2 }}>
      <View style={{ flexDirection: "row", gap: space[3] + 2 }}>
        {/* Gym communities without a custom photo show the chain logo. */}
        <GymLogo
          gym={
            community.photoUrl
              ? {}
              : {
                  chain: community.gymChain,
                  institution: community.gymInstitution,
                  name: isGym ? community.name : null
                }
          }
          size={64}
          radius={radius.md}
          fallback={
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: radius.md,
                overflow: "hidden",
                backgroundColor: tokens.bg.raised,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              {community.photoUrl ? (
                // CachedImage resolves the stored "r2:<key>" ref; a plain
                // expo-image here rendered nothing for uploaded photos.
                <CachedImage
                  source={{ uri: community.photoUrl }}
                  contentFit="cover"
                  style={{ width: 64, height: 64 }}
                  accessibilityLabel={`${community.name} photo`}
                />
              ) : (
                <Icon size={icon.size.md} color={colors.mist} />
              )}
            </View>
          }
        />
        <View style={{ flex: 1, justifyContent: "center", minWidth: 0 }}>
          <Text variant="heading" numberOfLines={2}>
            {community.name}
          </Text>
          <View style={{ marginTop: space[1], flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5 }}>
            <Pressable onPress={onOpenMembers} haptic="none" accessibilityLabel="See all members" hitSlop={6}>
              <Text variant="meta-strong" className="text-mist underline">
                {`${community.memberCount} member${community.memberCount === 1 ? "" : "s"}`}
              </Text>
            </Pressable>
            <Text variant="meta">·</Text>
            {isPrivate ? (
              <Lock size={11} color={metaColor} strokeWidth={icon.stroke.regular} />
            ) : (
              <Globe size={11} color={metaColor} strokeWidth={icon.stroke.regular} />
            )}
            <Text variant="meta">{isPrivate ? "Private" : "Public"}</Text>
            {community.location ? (
              <>
                <Text variant="meta">·</Text>
                <MapPin size={11} color={metaColor} strokeWidth={icon.stroke.regular} />
                <Text variant="meta" numberOfLines={1} className="flex-shrink">
                  {community.location}
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </View>
      {community.description ? (
        <Text variant="body-sm" className="pt-2 text-mist">
          {community.description}
        </Text>
      ) : null}
      {isGym ? (
        <Text variant="meta" className="pt-1">
          Posts require being at this gym.
        </Text>
      ) : null}
    </View>
  );
}
