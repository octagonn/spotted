import type { ConfigContext, ExpoConfig } from "expo/config";

const black = `${String.fromCharCode(35)}000000`;

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

// HARD GATE: never ship an artifact without the backend config. Without it the
// app silently falls into the offline demo mode (mock "Octavio" profile, no
// real auth) — which is exactly what an EAS Update did on 2026-09-02, because
// `eas update` reads EAS-hosted environment variables (ignoring .env) and the
// production environment had none. Builds AND updates evaluate this file, so
// both are covered. Only an explicit opt-in allows an unconfigured config, for
// running the demo mode locally.
const producingArtifact = Boolean(process.env.EAS_BUILD) || Boolean(process.env.EAS_UPDATE_PUBLISH) || process.env.NODE_ENV === "production";
if ((!supabaseUrl || !supabaseAnonKey) && process.env.SPOTTED_ALLOW_UNCONFIGURED !== "1") {
  const hint = producingArtifact
    ? "Refusing to build/publish. For `eas update` the values must exist in the EAS environment (`eas env:list --environment production`) and you must pass `--environment production`."
    : "Add them to .env (see .env.example), or set SPOTTED_ALLOW_UNCONFIGURED=1 to run the offline demo mode on purpose.";
  throw new Error(`[app.config] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are not set. ${hint}`);
}

export default ({ config: baseConfig }: ConfigContext): ExpoConfig => ({
  ...baseConfig,
  name: "Spotted",
  slug: "spotted",
  scheme: "spotted",
  // 1.3.0 = first binary with background location (gym-arrival geofence).
  // Because runtimeVersion follows appVersion, OTAs published from this config
  // only reach 1.3.0 binaries — 1.2.1 installs never receive code that calls
  // the background APIs. Hotfixes for 1.2.1 must be published from a 1.2.1 tag.
  version: "1.3.0",
  orientation: "portrait",
  userInterfaceStyle: "dark",
  newArchEnabled: true,
  icon: "./assets/images/icon.png",
  // OTA updates via EAS Update: JS/asset-only changes reach existing installs
  // without an App Store build or review. Native changes still need a build —
  // the appVersion runtime policy scopes each update to binaries of the same
  // store version, so an OTA can never land on a binary missing its native code.
  updates: {
    url: "https://u.expo.dev/c64d03b4-83c0-48c9-863b-f225fb8de92d"
  },
  runtimeVersion: {
    policy: "appVersion"
  },
  splash: {
    image: "./assets/images/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: black
  },
  ios: {
    bundleIdentifier: "com.octavio.spotted",
    supportsTablet: false,
    usesAppleSignIn: true,
    entitlements: {
      // Apple Declared Age Range API (iOS 26+) — the Age Assurance mechanism.
      // Requires the matching capability enabled on the App ID in the
      // developer portal (see modules/declared-age-range/README.md).
      "com.apple.developer.declared-age-range": true
    },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      // Lets iOS wake the app for geofence enter/exit events (and the short
      // GPS "settle" stream that follows) while it is closed. See lib/gymGeofence.
      UIBackgroundModes: ["location"],
      NSCameraUsageDescription: "Spotted uses the camera to capture your posts.",
      NSMicrophoneUsageDescription: "Spotted uses the microphone when you record video posts.",
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "Spotted uses a single low-power geofence around your home gym so it can check you in and buzz you the moment you arrive — even with the app closed. No location history is stored.",
      NSLocationAlwaysUsageDescription:
        "Spotted uses a single low-power geofence around your home gym so it can check you in and buzz you the moment you arrive — even with the app closed. No location history is stored.",
      NSLocationWhenInUseUsageDescription: "Spotted uses location to verify gym check-ins and find nearby gyms.",
      NSPhotoLibraryUsageDescription: "Spotted accesses a photo only when you choose it for a post or your profile.",
      NSPhotoLibraryAddUsageDescription:
        "Spotted adds a captured or edited photo to your library only when you tap Save."
    }
  },
  android: {
    package: "com.octavio.spotted",
    adaptiveIcon: {
      backgroundColor: black,
      foregroundImage: "./assets/images/android-icon-foreground.png"
    },
    permissions: [
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "FOREGROUND_SERVICE",
      "FOREGROUND_SERVICE_LOCATION",
      "CAMERA",
      "RECORD_AUDIO",
      "POST_NOTIFICATIONS"
    ]
  },
  web: {
    output: "single",
    favicon: "./assets/images/favicon.png"
  },
  plugins: [
    "expo-router",
    "expo-font",
    "expo-asset",
    "expo-apple-authentication",
    "expo-localization",
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission:
          "Spotted uses a single low-power geofence around your home gym so it can check you in and buzz you the moment you arrive — even with the app closed. No location history is stored.",
        locationAlwaysPermission:
          "Spotted uses a single low-power geofence around your home gym so it can check you in and buzz you the moment you arrive — even with the app closed. No location history is stored.",
        locationWhenInUsePermission: "Spotted uses location to verify gym check-ins and find nearby gyms.",
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true
      }
    ],
    [
      "expo-contacts",
      {
        contactsPermission: "Spotted uses your contacts to help you find friends who already use Spotted."
      }
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/images/android-icon-monochrome.png",
        color: black,
        defaultChannel: "social"
      }
    ],
    "@react-native-community/datetimepicker",
    "expo-task-manager",
    "expo-video",
    "expo-audio",
    "expo-iap",
    [
      "expo-image-picker",
      {
        photosPermission: "Spotted uses your photo library to post images you've already taken."
      }
    ],
    [
      "expo-media-library",
      {
        photosPermission: "Spotted accesses only photos you choose.",
        savePhotosPermission: "Spotted saves photos only when you tap Save.",
        granularPermissions: ["photo"],
        isAccessMediaLocationEnabled: false
      }
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 180,
        resizeMode: "contain",
        backgroundColor: black
      }
    ],
    [
      "expo-build-properties",
      {
        ios: {
          deploymentTarget: "16.0"
        },
        android: {
          minSdkVersion: 24
        }
      }
    ]
  ],
  experiments: {
    typedRoutes: true
  },
  extra: {
    ...baseConfig.extra,
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? "c64d03b4-83c0-48c9-863b-f225fb8de92d"
    },
    supabaseUrl,
    supabaseAnonKey
  }
});
