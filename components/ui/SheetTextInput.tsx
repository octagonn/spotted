import { BottomSheetTextInput, useBottomSheetInternal } from "@gorhom/bottom-sheet";
import { forwardRef } from "react";
import { TextInput, type TextInputProps } from "react-native";

/**
 * Context-aware text input: inside the bottom-sheet host it renders gorhom's
 * BottomSheetTextInput — which drives the sheet's keyboard behavior so the
 * sheet extends and the field rises well above the keyboard (results stay
 * visible between field and keyboard). Anywhere else it's a plain TextInput.
 */
export const SheetTextInput = forwardRef<TextInput, TextInputProps>(function SheetTextInput(props, ref) {
  const sheetInternal = useBottomSheetInternal(true);
  if (sheetInternal) {
    // gorhom's input forwards to a TextInput under the hood.
    return <BottomSheetTextInput {...props} ref={ref as never} />;
  }
  return <TextInput {...props} ref={ref} />;
});
