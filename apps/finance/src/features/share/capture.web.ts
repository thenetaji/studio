import type { RefObject } from "react";
import type { View } from "react-native";

/** Web is screenshots and e2e only: there is no share sheet, so this resolves without doing anything. */
export async function shareViewAsImage(
  _ref: RefObject<View | null>,
  _name: string,
  _dialogTitle: string,
): Promise<void> {}
