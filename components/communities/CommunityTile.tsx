import { Dumbbell, Lock } from "lucide-react-native";
import { View } from "react-native";

import { CachedImage } from "@/components/ui/CachedImage";
import type { CommunitySummary } from "@/hooks/queries/useCommunities";
import { COMMUNITY_ICONS } from "@/lib/communityTypes";
import { gymLogo, gymLogoIsFullBleed } from "@/lib/gymChains";
import { colors } from "@/theme/colors";
import { icon, radius, tokens } from "@/theme/tokens";

/**
 * Community thumbnail: chain logo for gym communities (public brand art, shown
 * even when locked), else the custom photo, else the type glyph.
 */
export function CommunityTile({
  community,
  size = 44,
  locked = false
}: {
  community: CommunitySummary;
  size?: number;
  locked?: boolean;
}) {
  const Icon = COMMUNITY_ICONS[community.type];
  const gymRef = { chain: community.gymChain, institution: community.gymInstitution, name: community.name };
  const logo = community.type === "gym" && !community.photoUrl ? gymLogo(gymRef) : null;
  const frame = {
    width: size,
    height: size,
    borderRadius: radius.sm,
    overflow: "hidden" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const
  };
  if (logo) {
    const fullBleed = gymLogoIsFullBleed(gymRef);
    return (
      <View style={[frame, { backgroundColor: fullBleed ? tokens.bg.subtle : colors.pure, opacity: locked ? 0.8 : 1 }]}>
        <CachedImage
          source={logo}
          contentFit={fullBleed ? "cover" : "contain"}
          style={fullBleed ? { width: size, height: size } : { width: size * 0.68, height: size * 0.68 }}
        />
      </View>
    );
  }
  return (
    <View style={[frame, { backgroundColor: tokens.bg.subtle }]}>
      {locked ? (
        <Lock size={size * 0.36} color={tokens.text.tertiary} strokeWidth={icon.stroke.regular} />
      ) : community.photoUrl ? (
        <CachedImage source={{ uri: community.photoUrl }} contentFit="cover" style={{ width: size, height: size }} />
      ) : community.type === "gym" ? (
        <Dumbbell size={size * 0.42} color={colors.mist} strokeWidth={icon.stroke.regular} />
      ) : (
        <Icon size={size * 0.42} color={colors.mist} />
      )}
    </View>
  );
}
