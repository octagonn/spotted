import { useRouter, type Href } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { Button } from "@/components/ui/Button";
import { SheetSub, SheetTitle, useSheet } from "@/components/ui/Sheet";
import { SheetTextInput } from "@/components/ui/SheetTextInput";
import { Text } from "@/components/ui/Text";
import { useJoinByCode } from "@/hooks/queries/useCommunities";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { radius, space, tokens } from "@/theme/tokens";

/** Sheet: join any community (incl. private) by entering its invite code. */
export function InviteCodeSheet() {
  const router = useRouter();
  const sheet = useSheet();
  const joinByCode = useJoinByCode();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const trimmed = code.trim();
    if (trimmed.length < 4) {
      setError("Enter the full code.");
      return;
    }
    setError(null);
    joinByCode.mutate(trimmed, {
      onSuccess: (communityId) => {
        if (communityId) {
          sheet.close();
          showToast("You're in");
          router.push(`/community/${communityId}` as Href);
        } else {
          setError("That code isn't valid — check it and try again.");
        }
      },
      onError: () => setError("Couldn't join right now — try again.")
    });
  };

  return (
    <View>
      <SheetTitle>Enter invite code</SheetTitle>
      <SheetSub>Join a private community directly with its code.</SheetSub>
      <View style={{ paddingHorizontal: space[4] + 4, paddingTop: space[1] + 2 }}>
        <SheetTextInput
          value={code}
          onChangeText={(v) => {
            setCode(
              v
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "")
                .slice(0, 8)
            );
            setError(null);
          }}
          autoFocus
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="ABC1234"
          placeholderTextColor={tokens.text.tertiary}
          onSubmitEditing={submit}
          accessibilityLabel="Invite code"
          style={{
            height: 52,
            borderWidth: 1,
            borderColor: error ? tokens.status.danger : tokens.border.default,
            borderRadius: radius.sm,
            backgroundColor: tokens.bg.raised,
            paddingHorizontal: space[4],
            fontFamily: "GeistMono_500Medium",
            fontSize: 18,
            letterSpacing: 4,
            color: colors.white,
            textAlign: "center"
          }}
        />
        {error ? (
          <Text variant="meta" className="pt-2 text-center text-danger">
            {error}
          </Text>
        ) : null}
        <View style={{ paddingTop: space[3] + 2 }}>
          <Button loading={joinByCode.isPending} disabled={joinByCode.isPending} onPress={submit}>
            Join
          </Button>
        </View>
      </View>
    </View>
  );
}
