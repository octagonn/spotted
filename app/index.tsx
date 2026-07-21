import { Redirect } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuthStore } from "@/stores/auth";
import { colors } from "@/theme/colors";

export default function Index() {
  const status = useAuthStore((state) => state.status);
  const onboardingStage = useAuthStore((state) => state.onboardingStage);
  const needsBirthdate = useAuthStore((state) => state.needsBirthdate);
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (status === "loading") {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color={colors.white} />
      </View>
    );
  }
  if (status === "signed-out") {
    return <Redirect href="/welcome" />;
  }
  if (status === "needs-password") {
    return <Redirect href="/email" />;
  }
  if (status === "needs-profile") {
    return <Redirect href={needsBirthdate ? "/birthday" : "/create-profile"} />;
  }
  if (status === "needs-onboarding") {
    if (onboardingStage === "home-gym") {
      return <Redirect href="/home-gym" />;
    }
    if (onboardingStage === "schedule") {
      return <Redirect href="/schedule" />;
    }
    return <Redirect href="/permissions" />;
  }
  return <Redirect href="/feed" />;
}
