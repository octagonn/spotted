import type { ConfigContext, ExpoConfig } from "expo/config";

const black = `${String.fromCharCode(35)}000000`;

export default ({ config: baseConfig }: ConfigContext): ExpoConfig => ({
  ...baseConfig,
  name: "Spotted",
  slug: "spotted",
  scheme: "spotted",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "dark",
  newArchEnabled: true,
  icon: "./assets/images/icon.png",
  splash: {
    image: "./assets/images/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: black
  },
  ios: {
    bundleIdentifier: "com.octavio.spotted",
    supportsTablet: false,
    usesAppleSignIn: true,
    // NOTE: the Declared Age Range entitlement is intentionally omitted — the
    // native module is deferred (see modules/declared-age-range/README.md).
    // Re-add "com.apple.developer.declared-age-range": true when restoring it.
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription: "Spotted uses the camera to capture your posts.",
      NSContactsUsageDescription: "Spotted uses your contacts to help you find friends who already use Spotted.",
      NSMicrophoneUsageDescription: "Spotted uses the microphone when you record video posts.",
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "Spotted uses location to verify gym check-ins and keep your presence accurate.",
      NSLocationAlwaysUsageDescription:
        "Spotted uses location to verify gym check-ins and keep your presence accurate.",
      NSLocationWhenInUseUsageDescription: "Spotted uses location to verify gym check-ins and find nearby gyms.",
      NSPhotoLibraryUsageDescription:
        "Spotted accesses a photo only when you choose it for a post or your profile.",
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
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission:
          "Spotted uses location to verify gym check-ins and keep your presence accurate."
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
      "react-native-vision-camera",
      {
        cameraPermissionText: "Spotted uses the camera to capture your posts.",
        enableMicrophonePermission: true,
        microphonePermissionText: "Spotted uses the microphone for video posts."
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
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ""
  }
});
