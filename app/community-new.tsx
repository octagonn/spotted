import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useRouter, type Href } from "expo-router";
import { Check, ChevronLeft, Globe, MapPin, Pencil, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { useCreateCommunity, type CommunityType } from "@/hooks/queries/useCommunities";
import { useKeyboardVisible } from "@/hooks/useKeyboardVisible";
import { COMMUNITY_ICONS, WIZARD_TYPES } from "@/lib/communityTypes";
import { compressReactionSelfie } from "@/lib/posts";
import { logger } from "@/lib/logger";
import { publicAvatarUrl, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";

const NAME_MAX = 126;
const DESC_MAX = 1251;
const STEPS = 4;

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
        const places = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
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

  const canNext =
    step === 0 ? Boolean(type) : step === 1 ? name.trim().length >= 2 : true;

  const pickPhoto = async () => {
    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
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
      const path = `${userId}/community-${Date.now()}.jpg`;
      const upload = await supabase.storage.from("avatars").upload(path, body, { contentType: "image/jpeg", upsert: false });
      if (upload.error) throw upload.error;
      setPhotoUrl(publicAvatarUrl(path) ?? null);
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      {/* Header: back · progress · dismiss */}
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable onPress={back} accessibilityLabel="Back" hitSlop={8}>
          <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.iron, alignItems: "center", justifyContent: "center" }}>
            <ChevronLeft color={colors.mist} size={18} strokeWidth={2.2} />
          </View>
        </Pressable>
        <View style={{ flex: 1, flexDirection: "row", gap: 5 }}>
          {Array.from({ length: STEPS }, (_, i) => (
            <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? colors.white : colors.iron }} />
          ))}
        </View>
        <Pressable onPress={() => router.back()} accessibilityLabel="Close" hitSlop={8}>
          <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.iron, alignItems: "center", justifyContent: "center" }}>
            <X color={colors.mist} size={18} strokeWidth={2.2} />
          </View>
        </Pressable>
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
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 10, paddingBottom: 24 }}
      >
        {step === 0 ? (
          <View>
            <StepTitle title="What kind of community?" sub="Pick the vibe. You can always change this later." />
            {WIZARD_TYPES.map((t) => {
              const Icon = COMMUNITY_ICONS[t.key];
              const active = type === t.key;
              return (
                <Pressable key={t.key} onPress={() => setType(t.key)} accessibilityLabel={t.label} style={{ marginTop: 10 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 14,
                      padding: 14,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: active ? colors.white : colors.iron,
                      backgroundColor: colors.graphite
                    }}
                  >
                    <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.charcoal, borderWidth: 1, borderColor: colors.iron }}>
                      <Icon size={19} color={active ? colors.white : colors.silver} strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 14.5, color: colors.white }}>{t.label}</Text>
                      <Text style={{ marginTop: 2, fontSize: 12, color: colors.fog }}>{t.hint}</Text>
                    </View>
                    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: active ? 0 : 1.5, borderColor: colors.iron, backgroundColor: active ? colors.white : "transparent", alignItems: "center", justifyContent: "center" }}>
                      {active ? <Check size={13} color={colors.black} strokeWidth={3} /> : null}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {step === 1 ? (
          <View>
            <StepTitle title="Customize it" sub="A photo and a name. You can always change this later." />
            <View style={{ alignItems: "center", paddingTop: 8 }}>
              <Pressable onPress={() => void pickPhoto()} accessibilityLabel="Community photo">
                <View style={{ width: 104, height: 104, borderRadius: 20, overflow: "hidden", backgroundColor: colors.graphite, borderWidth: 1, borderColor: colors.iron, alignItems: "center", justifyContent: "center" }}>
                  {photoPreview ? (
                    <Image source={{ uri: photoPreview }} contentFit="cover" style={{ width: 104, height: 104 }} />
                  ) : (
                    <Pencil size={22} color={colors.fog} strokeWidth={2} />
                  )}
                  {uploading ? (
                    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}>
                      <ActivityIndicator color={colors.white} />
                    </View>
                  ) : null}
                </View>
                <View style={{ position: "absolute", right: -2, bottom: -2, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.white, borderWidth: 3, borderColor: colors.black, alignItems: "center", justifyContent: "center" }}>
                  <Pencil size={14} color={colors.black} strokeWidth={2.2} />
                </View>
              </Pressable>
            </View>

            <FieldLabel>Name</FieldLabel>
            <TextInput
              value={name}
              onChangeText={(v) => setName(v.slice(0, NAME_MAX))}
              placeholder="Community name"
              placeholderTextColor={colors.fog}
              maxLength={NAME_MAX}
              style={inputStyle}
            />
            <Counter value={name.length} max={NAME_MAX} />

            <FieldLabel>Description</FieldLabel>
            <TextInput
              value={description}
              onChangeText={(v) => setDescription(v.slice(0, DESC_MAX))}
              placeholder="What's this community about? (optional)"
              placeholderTextColor={colors.fog}
              multiline
              maxLength={DESC_MAX}
              textAlignVertical="top"
              // The description sits low on the Customize step — scroll it above
              // the keyboard on focus (14).
              onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80)}
              style={[inputStyle, { minHeight: 92, paddingTop: 12 }]}
            />
            <Counter value={description.length} max={DESC_MAX} />
          </View>
        ) : null}

        {step === 2 ? (
          <View>
            <StepTitle title="Who can join?" sub="You can always change this later." />
            <PrivacyOption
              active={privacy === "public"}
              onPress={() => setPrivacy("public")}
              title="Public"
              body="Anyone can join and view the community's content."
            />
            <PrivacyOption
              active={privacy === "private"}
              onPress={() => setPrivacy("private")}
              title="Private"
              body="People must request to join. Only admins can approve, and content stays hidden until then."
            />
          </View>
        ) : null}

        {step === 3 ? (
          <View>
            <StepTitle title="Add a location?" sub="Optional — skip to keep it global. You can always change this later." />
            {detecting ? (
              <View style={{ paddingVertical: 24, alignItems: "center" }}>
                <ActivityIndicator color={colors.mist} />
              </View>
            ) : (
              <>
                {suggested ? (
                  <Pressable onPress={() => setLocChoice("auto")} style={{ marginTop: 6 }}>
                    <View style={rowCard(locChoice === "auto")}>
                      <MapPin size={18} color={locChoice === "auto" ? colors.white : colors.silver} strokeWidth={2} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.white }}>{suggested}</Text>
                        <Text style={{ marginTop: 1, fontSize: 11.5, color: colors.fog }}>Detected location</Text>
                      </View>
                    </View>
                  </Pressable>
                ) : null}

                {locChoice === "custom" ? (
                  <TextInput
                    value={customLoc}
                    onChangeText={setCustomLoc}
                    placeholder="City, State or place"
                    placeholderTextColor={colors.fog}
                    autoFocus
                    style={[inputStyle, { marginTop: 10 }]}
                  />
                ) : (
                  <Pressable onPress={() => setLocChoice("custom")} style={{ marginTop: 10 }}>
                    <View style={rowCard(false)}>
                      <Pencil size={16} color={colors.silver} strokeWidth={2} />
                      <Text style={{ flex: 1, fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.white }}>
                        {suggested ? "Change location" : "Set a location"}
                      </Text>
                    </View>
                  </Pressable>
                )}

                <Pressable onPress={() => setLocChoice("skip")} style={{ marginTop: 10 }}>
                  <View style={rowCard(locChoice === "skip")}>
                    <Globe size={18} color={locChoice === "skip" ? colors.white : colors.silver} strokeWidth={2} />
                    <Text style={{ flex: 1, fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.white }}>Skip — keep it global</Text>
                  </View>
                </Pressable>
              </>
            )}
          </View>
        ) : null}
      </ScrollView>

      {/* Footer CTA — drops the home-indicator inset while the keyboard is up
          so the button sits flush above it instead of leaving a gap. */}
      <View style={{ paddingHorizontal: 18, paddingBottom: keyboardVisible ? 10 : insets.bottom + 14, paddingTop: 6 }}>
        {submitError && step === STEPS - 1 ? (
          <Text style={{ textAlign: "center", fontSize: 12.5, color: colors.white, paddingBottom: 10 }}>
            {submitError}
          </Text>
        ) : (
          <Text style={{ textAlign: "center", fontSize: 11.5, color: colors.fog, paddingBottom: 10 }}>
            You can always change this later.
          </Text>
        )}
        {step < STEPS - 1 ? (
          <Button disabled={!canNext} onPress={() => setStep((s) => s + 1)}>
            Next
          </Button>
        ) : (
          <Button loading={create.isPending} disabled={create.isPending} onPress={submit}>
            {create.isPending ? "Creating…" : "Create Community"}
          </Button>
        )}
      </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function StepTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <View style={{ paddingBottom: 6 }}>
      <Text style={{ fontFamily: "Geist_700Bold", fontSize: 21, letterSpacing: 21 * -0.02, color: colors.white }}>{title}</Text>
      <Text style={{ marginTop: 6, fontSize: 13, lineHeight: 18, color: colors.silver }}>{sub}</Text>
    </View>
  );
}

function FieldLabel({ children }: { children: string }) {
  return (
    <Text style={{ paddingTop: 18, paddingBottom: 8, fontFamily: "GeistMono_400Regular", fontSize: 10.5, letterSpacing: 10.5 * 0.12, textTransform: "uppercase", color: colors.fog }}>
      {children}
    </Text>
  );
}

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <Text style={{ alignSelf: "flex-end", paddingTop: 6, fontFamily: "GeistMono_400Regular", fontSize: 10, color: value >= max ? colors.silver : colors.fog }}>
      {value}/{max}
    </Text>
  );
}

function PrivacyOption({ active, onPress, title, body }: { active: boolean; onPress: () => void; title: string; body: string }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={title} style={{ marginTop: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 15, borderRadius: 16, borderWidth: 1, borderColor: active ? colors.white : colors.iron, backgroundColor: colors.graphite }}>
        <View style={{ marginTop: 1, width: 22, height: 22, borderRadius: 11, borderWidth: active ? 0 : 1.5, borderColor: colors.iron, backgroundColor: active ? colors.white : "transparent", alignItems: "center", justifyContent: "center" }}>
          {active ? <Check size={13} color={colors.black} strokeWidth={3} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14.5, color: colors.white }}>{title}</Text>
          <Text style={{ marginTop: 3, fontSize: 12.5, lineHeight: 17, color: colors.fog }}>{body}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function rowCard(active: boolean) {
  return {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: active ? colors.white : colors.iron,
    backgroundColor: colors.graphite
  };
}

const inputStyle = {
  minHeight: 46,
  borderWidth: 1,
  borderColor: colors.iron,
  borderRadius: 12,
  backgroundColor: colors.graphite,
  paddingHorizontal: 14,
  fontSize: 15,
  color: colors.white
} as const;
