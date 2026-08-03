import { Image, type ImageProps } from "expo-image";

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
export function CachedImage({ accessibilityLabel, accessible, ...props }: ImageProps) {
  const meaningful = Boolean(accessibilityLabel);
  return (
    <Image
      cachePolicy="memory-disk"
      transition={140}
      accessible={accessible ?? meaningful}
      accessibilityRole={meaningful ? "image" : undefined}
      accessibilityLabel={accessibilityLabel}
      {...props}
    />
  );
}
