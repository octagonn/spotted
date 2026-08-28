import { Redirect } from "expo-router";
import { useEffect } from "react";

import { AppSplash } from "@/components/ui/AppSplash";
import { useAuthStore } from "@/stores/auth";

export default function Index() {
  const status = useAuthStore((state) => state.status);
  const onboardingStage = useAuthStore((state) => state.onboardingStage);
  const needsBirthdate = useAuthStore((state) => state.needsBirthdate);
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (status === "loading") {
    return <AppSplash />;
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
    return <Redirect href="/permissions" />;
  }
  return <Redirect href="/feed" />;
}
