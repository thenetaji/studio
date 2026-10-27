import { Image } from "expo-image";
import * as React from "react";
import { View } from "react-native";

import { Text } from "@studio/ui";
import { APP_NAME } from "@/constants/app";
import { useTokens } from "@studio/theme";

type ShareFrameProps = {
  ref?: React.Ref<View>;
  width: number;
  /** height / width. */
  ratio: number;
  /** Right side of the footer, e.g. "October 2026". */
  caption: string;
  children: React.ReactNode;
};

/** The canvas a share image is drawn on: app background, rounded corners, a quiet wordmark footer. */
export function ShareFrame({
  ref,
  width,
  ratio,
  caption,
  children,
}: ShareFrameProps) {
  const { colors } = useTokens();
  return (
    <View
      ref={ref}
      collapsable={false}
      style={{
        width,
        height: Math.round(width * ratio),
        backgroundColor: colors.bg,
        borderRadius: 28,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flex: 1 }}>{children}</View>
      <View className="flex-row items-center justify-between px-6 pb-5">
        <View className="flex-row items-center gap-2">
          <Image
            source={require("../../../assets/images/icon.png")}
            style={{ width: 18, height: 18, borderRadius: 4.5 }}
          />
          <Text variant="footnote" className="font-semibold">
            {APP_NAME}
          </Text>
        </View>
        <Text variant="footnote" tone="secondary">
          {caption}
        </Text>
      </View>
    </View>
  );
}
