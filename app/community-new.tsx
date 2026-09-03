import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useRouter, type Href } from "expo-router";
import { ChevronLeft, Globe, MapPin, Pencil, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { ChoiceRow } from "@/components/ui/ChoiceRow";
import { IconButton } from "@/components/ui/IconButton";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { TextField } from "@/components/ui/TextField";
import { useCreateCommunity, type CommunityType } from "@/hooks/queries/useCommunities";
import { useKeyboardVisible } from "@/hooks/useKeyboardVisible";
import { COMMUNITY_ICONS, WIZARD_TYPES } from "@/lib/communityTypes";
import { logger } from "@/lib/logger";
import { compressReactionSelfie } from "@/lib/posts";
import { uploadMediaObject } from "@/lib/r2";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { icon, radius, space, tokens } from "@/theme/tokens";

const NAME_MAX = 126;
const DESC_MAX = 1251;
const STEPS = 4;
const GUTTER = space[4] + 2;

export default function CommunityWizard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((state) => state.userId);
  const keyboardVisible = useKeyboardVisible();
  const create = useCreateCommunity();

  const [step, setStep] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const [type, setType] = useState<CommunityType | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "private">("public");
  const [locChoice, setLocChoice] = useState<"auto" | "custom" | "skip">("auto");
  const [suggested, setSuggested] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(true);
  const [customLoc, setCustomLoc] = useState("");

  // Auto-detect the user's location for the Location step.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await Location.getForegroundPermissionsAsync();
        if (!status.granted) return;
        const pos =
          (await Location.getLastKnownPositionAsync()) ??
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        if (!pos || cancelled) return;
        const places = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        });
        const p = places[0];
        if (p && !cancelled) {
          const label = [p.city ?? p.subregion, p.region].filter(Boolean).join(", ");
          if (label) setSuggested(label);
        }
      } catch (error) {
        logger.warn("community_location_failed", { message: error instanceof Error ? error.message : String(error) });
      } finally {
        if (!cancelled) setDetecting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const effectiveLocation = locChoice === "skip" ? null : locChoice === "custom" ? customLoc.trim() || null : suggested;

  const canNext = step === 0 ? Boolean(type) : step === 1 ? name.trim().length >= 2 : true;

  const pickPhoto = async () => {
    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8
      });
    } catch {
      showToast("Couldn't open your photo library");
      return;
    }
    if (result.canceled || !result.assets[0] || !userId) return;
    setPhotoPreview(result.assets[0].uri);
    setUploading(true);
    try {
      const compressed = await compressReactionSelfie(result.assets[0].uri);
      const body = await (await fetch(compressed)).arrayBuffer();
      if (!body || body.byteLength === 0) throw new Error("empty");
      setPhotoUrl(await uploadMediaObject(`${userId}/community-${Date.now()}.jpg`, body, "image/jpeg"));
    } catch (error) {
      logger.warn("community_photo_failed", { message: error instanceof Error ? error.message : String(error) });
      showToast("Couldn't upload photo — try again");
      setPhotoPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const [submitError, setSubmitError] = useState<string | null>(null);

  const submit = () => {
    if (!type || create.isPending) return;
    setSubmitError(null);
    create.mutate(
      { name: name.trim(), type, description, photoUrl, privacy, location: effectiveLocation },
      {
        onSuccess: (id) => {
          showToast(`Created ${name.trim()}`);
          router.replace(`/community/${id}` as Href);
        },
        onError: (error) => {
          logger.warn("community_create_failed", { message: error instanceof Error ? error.message : String(error) });
          setSubmitError("Couldn't create the community. Check your connection and try again.");
        }
      }
    );
  };

  const back = () => {
    if (step === 0) router.back();
    else setStep((s) => s - 1);
  };

  const chrome = tokens.text.secondary;

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      {/* Header: back · progress · dismiss */}
      <View
        style={{
          paddingTop: insets.top + space[2] + 2,
          paddingHorizontal: space[4],
          paddingBottom: space[2],
          flexDirection: "row",
          alignItems: "center",
          gap: space[3]
        }}
      >
        <IconButton
          icon={<ChevronLeft color={chrome} size={icon.size.xs + 2} strokeWidth={icon.stroke.bold} />}
          accessibilityLabel="Back"
          size={34}
          onPress={back}
        />
        <View
          accessible
          accessibilityLabel={`Step ${step + 1} of ${STEPS}`}
          style={{ flex: 1, flexDirection: "row", gap: 5 }}
        >
          {Array.from({ length: STEPS }, (_, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: i <= step ? colors.white : tokens.border.default
              }}
            />
          ))}
        </View>
        <IconButton
          icon={<X color={chrome} size={icon.size.xs + 2} strokeWidth={icon.stroke.bold} />}
          accessibilityLabel="Close"
          size={34}
          onPress={() => router.back()}
        />
      </View>

      {/* KAV lifts the scroll area + footer CTA above the keyboard; iOS then
          scrolls the focused field into view. Drag or tapping blank space
          dismisses the keyboard. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: space[2] + 2, paddingBottom: space[6] }}
        >
          {step === 0 ? (
            <View>
              <StepTitle title="What kind of community?" sub="Pick the vibe. You can always change this later." />
              {WIZARD_TYPES.map((t) => {
                const Icon = COMMUNITY_ICONS[t.key];
                const active = type === t.key;
                return (
                  <ChoiceRow
                    key={t.key}
                    title={t.label}
                    sub={t.hint}
                    selected={active}
                    onPress={() => setType(t.key)}
                    left={
                      <View
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 21,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: tokens.bg.subtle
                        }}
                      >
                        <Icon
                          size={icon.size.sm - 1}
                          color={active ? colors.white : colors.silver}
                          strokeWidth={icon.stroke.regular}
                        />
                      </View>
                    }
                  />
                );
              })}
            </View>
          ) : null}

          {step === 1 ? (
            <View>
              <StepTitle title="Customize it" sub="A photo and a name. You can always change this later." />
              <View style={{ alignItems: "center", paddingTop: space[2] }}>
                <Pressable onPress={() => void pickPhoto()} accessibilityLabel="Community photo" haptic="none">
                  <View
                    style={{
                      width: 104,
                      height: 104,
                      borderRadius: radius.md + 4,
                      overflow: "hidden",
                      backgroundColor: tokens.bg.raised,
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    {photoPreview ? (
                      <Image source={{ uri: photoPreview }} contentFit="cover" style={{ width: 104, height: 104 }} />
                    ) : (
                      <Pencil size={icon.size.sm + 2} color={tokens.text.tertiary} strokeWidth={icon.stroke.regular} />
                    )}
                    {uploading ? (
                      <View
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: tokens.bg.scrim,
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                      >
                        <ActivityIndicator color={colors.white} />
                      </View>
                    ) : null}
                  </View>
                  <View
                    style={{
                      position: "absolute",
                      right: -2,
                      bottom: -2,
                      width: 30,
                      height: 30,
                      borderRadius: 15,
                      backgroundColor: colors.white,
                      borderWidth: 3,
                      borderColor: colors.black,
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <Pencil size={icon.size.xs - 2} color={colors.black} strokeWidth={icon.stroke.bold} />
                  </View>
                </Pressable>
              </View>

              <FieldLabel>Name</FieldLabel>
              <TextField
                value={name}
                onChangeText={(v) => setName(v.slice(0, NAME_MAX))}
                placeholder="Community name"
                accessibilityLabel="Community name"
                maxLength={NAME_MAX}
                counter
              />

              <FieldLabel>Description</FieldLabel>
              <TextField
                value={description}
                onChangeText={(v) => setDescription(v.slice(0, DESC_MAX))}
                placeholder="What's this community about? (optional)"
                accessibilityLabel="Community description"
                multiline
                maxLength={DESC_MAX}
                counter
                // The description sits low on the Customize step — scroll it above
                // the keyboard on focus (14).
                onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80)}
              />
            </View>
          ) : null}

          {step === 2 ? (
            <View>
              <StepTitle title="Who can join?" sub="You can always change this later." />
              <ChoiceRow
                title="Public"
                sub="Anyone can join and view the community's content."
                selected={privacy === "public"}
                onPress={() => setPrivacy("public")}
              />
              <ChoiceRow
                title="Private"
                sub="People must request to join. Only admins can approve, and content stays hidden until then."
                selected={privacy === "private"}
                onPress={() => setPrivacy("private")}
              />
            </View>
          ) : null}

          {step === 3 ? (
            <View>
              <StepTitle
                title="Add a location?"
                sub="Optional — skip to keep it global. You can always change this later."
              />
              {detecting ? (
                <View style={{ paddingVertical: space[6], alignItems: "center" }}>
                  <ActivityIndicator color={colors.mist} />
                </View>
              ) : (
                <>
                  {suggested ? (
                    <ChoiceRow
                      title={suggested}
                      sub="Detected location"
                      selected={locChoice === "auto"}
                      onPress={() => setLocChoice("auto")}
                      left={<MapPin size={icon.size.xs + 2} color={colors.silver} strokeWidth={icon.stroke.regular} />}
                    />
                  ) : null}

                  {locChoice === "custom" ? (
                    <TextField
                      value={customLoc}
                      onChangeText={setCustomLoc}
                      placeholder="City, State or place"
                      accessibilityLabel="Custom location"
                      autoFocus
                      containerStyle={{ marginTop: space[2] + 2 }}
                    />
                  ) : (
                    <ChoiceRow
                      title={suggested ? "Change location" : "Set a location"}
                      selected={false}
                      onPress={() => setLocChoice("custom")}
                      left={<Pencil size={icon.size.xs} color={colors.silver} strokeWidth={icon.stroke.regular} />}
                    />
                  )}

                  <ChoiceRow
                    title="Skip — keep it global"
                    selected={locChoice === "skip"}
                    onPress={() => setLocChoice("skip")}
                    left={<Globe size={icon.size.xs + 2} color={colors.silver} strokeWidth={icon.stroke.regular} />}
                  />
                </>
              )}
            </View>
          ) : null}
        </ScrollView>

        {/* Footer CTA — drops the home-indicator inset while the keyboard is up
            so the button sits flush above it instead of leaving a gap. */}
        <View
          style={{
            paddingHorizontal: GUTTER,
            paddingBottom: keyboardVisible ? space[2] + 2 : insets.bottom + space[3] + 2,
            paddingTop: space[1] + 2
          }}
        >
          {submitError && step === STEPS - 1 ? (
            <Text variant="meta" className="pb-[10px] text-center text-white">
              {submitError}
            </Text>
          ) : (
            <Text variant="meta" className="pb-[10px] text-center">
              You can always change this later.
            </Text>
          )}
          {step < STEPS - 1 ? (
            <Button disabled={!canNext} onPress={() => setStep((s) => s + 1)}>
              Next
            </Button>
          ) : (
            <Button loading={create.isPending} disabled={create.isPending} onPress={submit}>
              Create community
            </Button>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function StepTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <View style={{ paddingBottom: space[2] }}>
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      <Text variant="caption" className="mt-[6px]">
        {sub}
      </Text>
    </View>
  );
}

function FieldLabel({ children }: { children: string }) {
  return (
    <Text variant="micro" className="pb-2 pt-[18px]">
      {children}
    </Text>
  );
}
