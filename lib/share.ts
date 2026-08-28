import { Share } from "react-native";

export const APP_STORE_URL = "https://apps.apple.com/app/id6794171200";

/**
 * Share a profile via the system sheet: text plus a tappable App Store link.
 * (Per-profile deep links need universal links / a web profile page — until
 * then the store listing is the only URL that works for every recipient.)
 *
 * The link rides IN the message text on every platform — several iOS share
 * targets (SMS to some carriers, a few third-party apps) drop the separate
 * `url` field, which delivered link-less "Check out @user" texts to testers.
 */
export function shareProfile(handle: string) {
  void Share.share({ message: `Check out @${handle} on Spotted\n${APP_STORE_URL}` });
}
