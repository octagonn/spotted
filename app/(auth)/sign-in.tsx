import { router } from "expo-router";
import { Apple, Phone } from "lucide-react-native";
import { View } from "react-native";

import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { signInWithApple } from "@/lib/auth";
import { colors } from "@/theme/colors";

export default function SignInScreen() {
  return (
    <Screen>
      <View className="min-h-[660px] justify-end">
        <Text variant="display-md">SIGN IN</Text>
        <Text variant="italic" className="mt-5">
          Apple first. Phone if you have to.
        </Text>
        <View className="mt-10 gap-3">
          <Button
            icon={<Apple color={colors.black} size={19} />}
            onPress={async () => {
              await signInWithApple();
              router.replace("/profile");
            }}
          >
            Continue with Apple
          </Button>
          <Button icon={<Phone color={colors.white} size={18} />} variant="ghost" onPress={() => router.push("/profile")}>
            Phone OTP
          </Button>
        </View>
      </View>
    </Screen>
  );
}
