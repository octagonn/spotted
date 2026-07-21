import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetView,
  useBottomSheetTimingConfigs,
  type BottomSheetBackdropProps
} from "@gorhom/bottom-sheet";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DismissKeyboard } from "@/components/ui/DismissKeyboard";
import { colors } from "@/theme/colors";
import { durations, easing } from "@/theme/motion";

type SheetApi = {
  /** Opens the single sheet host with arbitrary content. Replaces any open sheet. */
  open: (content: ReactNode) => void;
  close: () => void;
};

const SheetContext = createContext<SheetApi | null>(null);

/** Access the global sheet host. Must be used under <SheetProvider>. */
export function useSheet(): SheetApi {
  const api = useContext(SheetContext);
  if (!api) {
    throw new Error("useSheet must be used within a SheetProvider");
  }
  return api;
}

function Backdrop(props: BottomSheetBackdropProps) {
  return (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={0.62}
      pressBehavior="close"
    />
  );
}

/**
 * Single bottom-sheet host per spec §2.7: graphite bg, 20px top radius, 1px iron
 * top border, 36×4 slate handle, rgba(0,0,0,0.62) backdrop, 320ms emphasized
 * translate, max height 78%. Mount once in the root layout; open content from
 * anywhere via `useSheet().open(<Content/>)`.
 */
export function SheetProvider({ children }: { children: ReactNode }) {
  const modalRef = useRef<BottomSheetModal>(null);
  // Content stays mounted after dismissal: clearing it mid-animation makes the
  // dynamic-sizing sheet re-measure to ~0 and bounce back up, and can corrupt
  // the modal so the next present() crashes. The key forces a fresh mount per
  // open() so a reopened sheet never reuses stale internal state.
  const [content, setContent] = useState<{ node: ReactNode; key: number } | null>(null);
  const openCount = useRef(0);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const animationConfigs = useBottomSheetTimingConfigs({
    duration: durations.sheet,
    easing: easing.emphasized
  });

  const open = useCallback((node: ReactNode) => {
    openCount.current += 1;
    setContent({ node, key: openCount.current });
    requestAnimationFrame(() => modalRef.current?.present());
  }, []);

  const close = useCallback(() => {
    modalRef.current?.dismiss();
  }, []);

  const api = useMemo(() => ({ open, close }), [open, close]);

  // SheetContext MUST wrap BottomSheetModalProvider: the modal re-parents its
  // children into a portal host at the BottomSheetModalProvider level, so any
  // context declared inside it is invisible to sheet content — useSheet()
  // inside a sheet (e.g. a Done button) would throw and crash the app.
  return (
    <SheetContext.Provider value={api}>
      <BottomSheetModalProvider>
        {children}
        <BottomSheetModal
          ref={modalRef}
          enableDynamicSizing
          maxDynamicContentSize={windowHeight * 0.78}
          // "extend": when the keyboard opens the sheet grows to its max
          // height, so search fields sit well above the keyboard with room
          // for results in between.
          keyboardBehavior="extend"
          keyboardBlurBehavior="restore"
          android_keyboardInputMode="adjustResize"
          animationConfigs={animationConfigs}
          backdropComponent={Backdrop}
          backgroundStyle={{
            backgroundColor: colors.graphite,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: colors.iron
          }}
          handleStyle={{ paddingTop: 10, paddingBottom: 4 }}
          handleIndicatorStyle={{
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.slate
          }}
        >
          <BottomSheetView key={content?.key ?? 0} style={{ paddingBottom: 28 + insets.bottom }}>
            {/* Tap on sheet dead space closes the keyboard (modals portal
                outside the root DismissKeyboard wrapper). */}
            <DismissKeyboard style={{ flex: 0 }}>{content?.node ?? null}</DismissKeyboard>
          </BottomSheetView>
        </BottomSheetModal>
      </BottomSheetModalProvider>
    </SheetContext.Provider>
  );
}

/** Sheet title (§2.7): 700/16 white, padding 10 20 2. */
export function SheetTitle({ children, center }: { children: ReactNode; center?: boolean }) {
  return (
    <Text
      style={{
        fontFamily: "Geist_700Bold",
        fontSize: 16,
        letterSpacing: 16 * -0.01,
        color: colors.white,
        paddingTop: 10,
        paddingHorizontal: 20,
        paddingBottom: 2,
        textAlign: center ? "center" : "left"
      }}
    >
      {children}
    </Text>
  );
}

/** Sheet sub (§2.7): 12.5 fog, padding 2 20 8. */
export function SheetSub({ children, center }: { children: ReactNode; center?: boolean }) {
  return (
    <Text
      style={{
        fontSize: 12.5,
        color: colors.fog,
        paddingTop: 2,
        paddingHorizontal: 20,
        paddingBottom: 8,
        textAlign: center ? "center" : "left"
      }}
    >
      {children}
    </Text>
  );
}

type SheetProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Legacy presentational sheet container (kept for old modal routes).
 * New screens should use the SheetProvider/useSheet host instead.
 */
export function Sheet({ children, className }: SheetProps) {
  return (
    <View
      className={className}
      style={{
        backgroundColor: colors.graphite,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: colors.iron,
        overflow: "hidden"
      }}
    >
      <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 4 }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.slate }} />
      </View>
      {children}
    </View>
  );
}
