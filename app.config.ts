import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
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
    backgroundColor: "#000000"
  },
  ios: {
    bundleIdentifier: "com.octavio.spotted",
    buildNumber: "1",
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription: "Spotted uses the camera to capture pump drops.",
      NSMicrophoneUsageDescription: "Spotted uses the microphone when you record video pump drops.",
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "Spotted uses location to verify gym check-ins and show friends at gyms.",
      NSLocationWhenInUseUsageDescription:
        "Spotted uses location to verify gym check-ins and find nearby gyms.",
      NSPhotoLibraryUsageDescription: "Spotted uses your library when you choose a profile photo.",
      UIBackgroundModes: ["location", "remote-notification"]
    },
    entitlements: {
      "aps-environment": "development"
    }
  },
  android: {
    package: "com.octavio.spotted",
    edgeToEdgeEnabled: true,
    adaptiveIcon: {
      backgroundColor: "#000000",
      foregroundImage: "./assets/images/android-icon-foreground.png"
    },
    permissions: [
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "CAMERA",
      "RECORD_AUDIO",
      "POST_NOTIFICATIONS"
    ]
  },
  web: {
    output: "static",
    favicon: "./assets/images/favicon.png"
  },
  plugins: [
    "expo-router",
    "expo-font",
    "expo-apple-authentication",
    "expo-location",
    "expo-notifications",
    "expo-task-manager",
    [
      "react-native-vision-camera",
      {
        cameraPermissionText: "Spotted uses the camera to capture pump drops.",
        enableMicrophonePermission: true,
        microphonePermissionText: "Spotted uses the microphone for video pump drops."
      }
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 180,
        resizeMode: "contain",
        backgroundColor: "#000000"
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
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? ""
    },
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
    apnsEnvironment: process.env.EXPO_PUBLIC_APNS_ENV ?? "development"
  }
};

export default config;
