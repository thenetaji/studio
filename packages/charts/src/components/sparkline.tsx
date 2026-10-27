import { Canvas, Circle, Path, Skia } from "@shopify/react-native-skia";
import * as React from "react";
import { View } from "react-native";

import { sparkPoints } from "../lib";
import { monotoneSegments } from "../lib/smooth";
import { useTokens } from "@studio/theme";

export type SparklineProps = {
  values: readonly number[];
  width?: number;
  height?: number;
  /** Line colour; defaults to the tertiary text colour. */
  color?: string;
  /** Colour of the end dot (the current period). */
  endColor?: string;
};

/** A quiet trend line with the last point marked; decorative, so it is hidden from VoiceOver. */
function Sparkline({
  values,
  width = 48,
  height = 20,
  color,
  endColor,
}: SparklineProps) {
  const { colors } = useTokens();
  const pts = React.useMemo(
    () => sparkPoints(values, width, height, 4),
    [values, width, height],
  );
  const path = React.useMemo(() => {
    const b = Skia.PathBuilder.Make();
    if (pts.length < 2) return b.build();
    b.moveTo(pts[0]![0], pts[0]![1]);
    for (const [c1x, c1y, c2x, c2y, x, y] of monotoneSegments(pts))
      b.cubicTo(c1x, c1y, c2x, c2y, x, y);
    return b.build();
  }, [pts]);
  const last = pts[pts.length - 1];
  return (
    <View
      style={{ width, height }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <Canvas style={{ width, height }}>
        <Path
          path={path}
          style="stroke"
          strokeWidth={1.5}
          strokeCap="round"
          strokeJoin="round"
          color={color ?? colors.textTertiary}
        />
        {last ? (
          <>
            <Circle cx={last[0]} cy={last[1]} r={3.5} color={colors.surface} />
            <Circle
              cx={last[0]}
              cy={last[1]}
              r={2.25}
              color={endColor ?? color ?? colors.text}
            />
          </>
        ) : null}
      </Canvas>
    </View>
  );
}

export { Sparkline };
