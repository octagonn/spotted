import { Globe, Instagram, Music2, Twitter, Youtube, type LucideIcon } from "lucide-react-native";

/**
 * Social links live in profiles.social_links as a small JSON object keyed by
 * platform, e.g. { instagram: "user", website: "https://site.com" }. Users type
 * a handle (or a full URL); we normalize to an openable URL at render time.
 */
export type SocialPlatform = "instagram" | "tiktok" | "x" | "youtube" | "website";

export type SocialLinks = Partial<Record<SocialPlatform, string>>;

type PlatformMeta = {
  key: SocialPlatform;
  label: string;
  icon: LucideIcon;
  /** Prefix shown inside the input to hint the expected value. */
  prefix: string;
  placeholder: string;
  /** Build a full URL from a raw handle (no scheme). */
  toUrl: (handle: string) => string;
};

export const SOCIAL_PLATFORMS: PlatformMeta[] = [
  {
    key: "instagram",
    label: "Instagram",
    icon: Instagram,
    prefix: "instagram.com/",
    placeholder: "username",
    toUrl: (h) => `https://instagram.com/${h}`
  },
  {
    key: "tiktok",
    label: "TikTok",
    icon: Music2,
    prefix: "tiktok.com/@",
    placeholder: "username",
    toUrl: (h) => `https://tiktok.com/@${h.replace(/^@/, "")}`
  },
  {
    key: "x",
    label: "X",
    icon: Twitter,
    prefix: "x.com/",
    placeholder: "username",
    toUrl: (h) => `https://x.com/${h.replace(/^@/, "")}`
  },
  {
    key: "youtube",
    label: "YouTube",
    icon: Youtube,
    prefix: "youtube.com/@",
    placeholder: "channel",
    toUrl: (h) => `https://youtube.com/@${h.replace(/^@/, "")}`
  },
  {
    key: "website",
    label: "Website",
    icon: Globe,
    prefix: "https://",
    placeholder: "yoursite.com",
    toUrl: (h) => (/^https?:\/\//i.test(h) ? h : `https://${h}`)
  }
];

const PLATFORM_BY_KEY = new Map(SOCIAL_PLATFORMS.map((p) => [p.key, p]));

/** Coerce an unknown JSON value from the DB into a typed, trimmed SocialLinks. */
export function parseSocialLinks(raw: unknown): SocialLinks {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const out: SocialLinks = {};
  for (const platform of SOCIAL_PLATFORMS) {
    const value = (raw as Record<string, unknown>)[platform.key];
    if (typeof value === "string" && value.trim().length > 0) {
      out[platform.key] = value.trim();
    }
  }
  return out;
}

/** Resolve a stored handle/URL into an openable https URL. */
export function socialUrl(key: SocialPlatform, value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const meta = PLATFORM_BY_KEY.get(key);
  return meta ? meta.toUrl(trimmed.replace(/^@/, "")) : trimmed;
}

/** Ordered, non-empty links ready to render as icon buttons. */
export function socialEntries(links: SocialLinks): { meta: PlatformMeta; value: string; url: string }[] {
  return SOCIAL_PLATFORMS.flatMap((meta) => {
    const value = links[meta.key];
    if (!value) {
      return [];
    }
    return [{ meta, value, url: socialUrl(meta.key, value) }];
  });
}
