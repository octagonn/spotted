import { Dumbbell } from "lucide-react-native";
import type { ReactNode } from "react";
import { View } from "react-native";

import { GymLogo } from "@/components/GymLogo";
import { ListRow } from "@/components/ui/ListRow";
import { icon, radius, tokens } from "@/theme/tokens";

export type GymRowGym = { id: string; name: string; address?: string | null; chain?: string | null };

/** Neutral gym glyph for gyms without a brand logo. */
export function GymFallbackIcon({ size = 40 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.pill,
        backgroundColor: tokens.bg.subtle,
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <Dumbbell
        size={size >= 40 ? icon.size.xs + 2 : icon.size.xs}
        color={tokens.text.primary}
        strokeWidth={icon.stroke.thin}
      />
    </View>
  );
}

/** A gym in a list: logo · name · address · optional trailing (distance). */
export function GymRow({ gym, right, onPress }: { gym: GymRowGym; right?: ReactNode; onPress?: () => void }) {
  return (
    <ListRow
      left={<GymLogo gym={gym} size={40} fallback={<GymFallbackIcon />} />}
      name={gym.name}
      sub={gym.address ?? undefined}
      right={right}
      onPress={onPress}
    />
  );
}
