import * as React from "react";
import { View, type ViewProps } from "react-native";

import { cn } from "../../lib/utils";
import { useTokens } from "@studio/theme";

const lightShadow = {
  shadowColor: "#14120E",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.04,
  shadowRadius: 2,
} as const;

function Card({ className, style, ...props }: ViewProps) {
  const { isDark, colors, paletteKey } = useTokens();
  // Titanium: light catches the top edge, like a machined bevel.
  const bevel =
    paletteKey === "titanium"
      ? {
          borderTopColor: isDark
            ? "rgba(255,250,240,0.14)"
            : "rgba(255,255,255,1)",
        }
      : null;
  return (
    <View
      className={cn("overflow-hidden rounded-[18px] bg-surface p-4", className)}
      style={[
        { borderWidth: 1, borderColor: colors.border },
        bevel,
        isDark ? null : lightShadow,
        style,
      ]}
      {...props}
    />
  );
}

export { Card };
