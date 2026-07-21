type GrainOverlayProps = {
  opacity?: number;
};

/**
 * Skia is not part of Expo Go. Keep the decorative overlay inert so the root
 * layout can load in both Expo Go and native development builds.
 */
export function GrainOverlay(_props: GrainOverlayProps) {
  return null;
}
