import { Image, type ImageProps } from "expo-image";

import { isStoredMediaRef, useResolvedUri } from "@/lib/media";

/**
 * expo-image with the app's caching defaults baked in: memory+disk cache and a
 * soft fade-in. Use for ALL remote media (posts, thumbs, chat, avatars) —
 * plain expo-image call sites tended to omit cachePolicy, silently falling
 * back to disk-only and re-decoding on every mount. Pass `recyclingKey` at
 * call sites inside recycled lists (FlashList).
 *
 * Accessibility (WCAG 1.1.1): pass `accessibilityLabel` for a meaningful image
 * (it's exposed with role "image"); omit it and the image is treated as
 * decorative and hidden from screen readers — never announced as an unlabeled
 * "image" node. Override with `accessible`/`alt` as needed.
 */
export function CachedImage({ accessibilityLabel, accessible, source, ...props }: ImageProps) {
  const meaningful = Boolean(accessibilityLabel);
  // "r2:<key>" references (avatars, community photos, chat media…) are signed
  // on the fly; anything else is passed straight through.
  const rawUri = source && typeof source === "object" && !Array.isArray(source) && "uri" in source ? (source.uri as string | undefined) : undefined;
  const resolved = useResolvedUri(rawUri);
  const finalSource = isStoredMediaRef(rawUri) ? (resolved ? { ...(source as object), uri: resolved } : undefined) : source;
  return (
    <Image
      source={finalSource}
      cachePolicy="memory-disk"
      transition={140}
      accessible={accessible ?? meaningful}
      accessibilityRole={meaningful ? "image" : undefined}
      accessibilityLabel={accessibilityLabel}
      {...props}
    />
  );
}
