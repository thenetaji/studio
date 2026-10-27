import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { RefObject } from "react";
import type { View } from "react-native";

/**
 * Renders a mounted view to a PNG with Skia's `makeImageFromView` (no extra native module), writes it to the
 * cache directory and opens the share sheet. The view needs `collapsable={false}`.
 */
export async function shareViewAsImage(
  ref: RefObject<View | null>,
  name: string,
  dialogTitle: string,
): Promise<void> {
  // Loaded on demand: Skia stays out of the initial require graph.
  const Skia = await import("@shopify/react-native-skia");
  const image = await Skia.makeImageFromView(ref as RefObject<View>);
  if (!image) throw new Error("capture_failed");
  const bytes = image.encodeToBytes(Skia.ImageFormat.PNG, 100);
  image.dispose();
  const file = new File(Paths.cache, `${name}.png`);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("sharing_unavailable");
  await Sharing.shareAsync(file.uri, {
    mimeType: "image/png",
    UTI: "public.png",
    dialogTitle,
  });
}
