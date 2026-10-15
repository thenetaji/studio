import * as React from "react";
import { Keyboard, Platform } from "react-native";

/** iOS keyboard height (accessory bar included). KeyboardAvoidingView mis-measures inside form sheets, so sheets pad by this. */
export function useKeyboardInset(): number {
  const [inset, setInset] = React.useState(0);
  React.useEffect(() => {
    if (Platform.OS !== "ios") return;
    const subs = [
      Keyboard.addListener("keyboardWillChangeFrame", (e) =>
        setInset(Math.max(0, e.endCoordinates.height)),
      ),
      Keyboard.addListener("keyboardWillHide", () => setInset(0)),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);
  return inset;
}
