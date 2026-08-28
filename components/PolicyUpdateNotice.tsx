import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname, useRouter } from "expo-router";
import { ShieldCheck } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Modal, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { useMyProfile } from "@/hooks/queries/useProfile";
import { LEGAL_EFFECTIVE_DATE, LEGAL_VERSION } from "@/lib/legal";
import { colors } from "@/theme/colors";

const SEEN_KEY = `policy-notice-seen:${LEGAL_VERSION}`;
const POLICY_ROUTE = "/settings/legal/privacy";

/**
 * One-time "Privacy Policy updated" sheet, shown on the first launch after a
 * policy change to every account that existed before it took effect. The
 * inbox notice expires after 7 days and a build can land later than that —
 * this is the guarantee that a material change is actually seen. Accounts
 * created on/after the effective date accepted the current version at signup
 * and are skipped.
 */
export function PolicyUpdateNotice({ userId }: { userId: string | null }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useMyProfile().data;
  const [visible, setVisible] = useState(false);
  // "Read the policy" hides the sheet WITHOUT marking it seen, then brings it
  // back when the user leaves the policy screen so "Got it" is still there to
  // acknowledge. (It used to dismiss for good — back arrow landed on nothing.)
  const [reading, setReading] = useState(false);
  const pathname = usePathname();
  const onPolicyRef = useRef(false);

  useEffect(() => {
    if (!userId || !profile) return;
    const createdAt = profile.created_at ? new Date(profile.created_at).getTime() : 0;
    if (createdAt >= new Date(`${LEGAL_VERSION}T00:00:00Z`).getTime()) return;
    let cancelled = false;
    void AsyncStorage.getItem(SEEN_KEY)
      .then((seen) => {
        if (!cancelled && seen !== userId) setVisible(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [userId, profile]);

  useEffect(() => {
    if (!reading) return;
    const onPolicy = pathname.startsWith(POLICY_ROUTE);
    if (onPolicy) {
      onPolicyRef.current = true;
      return;
    }
    if (onPolicyRef.current) {
      onPolicyRef.current = false;
      setReading(false);
      setVisible(true);
    }
  }, [reading, pathname]);

  const dismiss = () => {
    setVisible(false);
    if (userId) void AsyncStorage.setItem(SEEN_KEY, userId).catch(() => undefined);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={dismiss} statusBarTranslucent>
      <View accessibilityViewIsModal style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.68)" }}>
        <View
          style={{
            backgroundColor: colors.ink,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: colors.iron,
            paddingHorizontal: 24,
            paddingTop: 26,
            paddingBottom: insets.bottom + 20
          }}
        >
          <View
            style={{
              width: 54,
              height: 54,
              borderRadius: 27,
              borderWidth: 1,
              borderColor: colors.slate,
              backgroundColor: colors.charcoal,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <ShieldCheck size={23} color={colors.white} strokeWidth={2} />
          </View>
          <Text
            accessibilityRole="header"
            style={{ marginTop: 18, fontFamily: "Boldonse_400Regular", fontSize: 18, lineHeight: 26, color: colors.white }}
          >
            Privacy Policy updated
          </Text>
          <Text style={{ marginTop: 12, fontFamily: "Geist_400Regular", fontSize: 14, lineHeight: 21, color: colors.mist }}>
            Effective {LEGAL_EFFECTIVE_DATE}. Usage analytics (app opens, screens viewed, feature use) is now on by
            default so we can see what works and improve Spotted. It&apos;s used only by Spotted and is never shared
            with or sold to third parties.
          </Text>
          <Text style={{ marginTop: 10, fontFamily: "Geist_600SemiBold", fontSize: 13, lineHeight: 19, color: colors.bone }}>
            You can turn it off any time in Settings → Privacy.
          </Text>
          <View style={{ marginTop: 22, gap: 9 }}>
            <Button
              onPress={() => {
                setVisible(false);
                setReading(true);
                router.push(POLICY_ROUTE as never);
              }}
            >
              Read the policy
            </Button>
            <Button variant="ghost" onPress={dismiss}>
              Got it
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
