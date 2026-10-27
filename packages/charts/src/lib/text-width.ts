import type { SkFont } from "@shopify/react-native-skia";
import { Platform } from "react-native";

/** iOS system-font measurements run a little short of what is drawn, which clipped end labels and pills. */
const IOS = Platform.OS === "ios";

/** Width of `text` in `font`, padded on iOS so labels placed against an edge or inside a pill never clip. */
export function textWidth(
  font: Pick<SkFont, "getTextWidth">,
  text: string,
): number {
  "worklet";
  const width = font.getTextWidth(text);
  return IOS ? Math.ceil(width * 1.08) + 1 : width;
}
