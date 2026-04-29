import * as Haptics from "expo-haptics";

export async function selectionHaptic() {
  await Haptics.selectionAsync();
}

export async function impactHaptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) {
  await Haptics.impactAsync(style);
}

export async function successHaptic() {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export async function warningHaptic() {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}
