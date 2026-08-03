import { Image, type ImageProps } from "expo-image";

/**
 * expo-image with the app's caching defaults baked in: memory+disk cache and a
 * soft fade-in. Use for ALL remote media (posts, thumbs, chat, avatars) —
 * plain expo-image call sites tended to omit cachePolicy, silently falling
 * back to disk-only and re-decoding on every mount. Pass `recyclingKey` at
 * call sites inside recycled lists (FlashList).
 */
export function CachedImage(props: ImageProps) {
  return <Image cachePolicy="memory-disk" transition={140} {...props} />;
}
