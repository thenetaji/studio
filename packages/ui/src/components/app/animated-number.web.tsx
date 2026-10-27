import { Text } from "../ui/text";
import { HIDDEN_LABEL, isMaskedText } from "./amount-privacy";

import type { AnimatedNumberProps } from "./animated-number";

/** Web exists for screenshots and e2e only: plain text keeps `innerText` and layout identical. */
function AnimatedNumber({
  value,
  variant = "body",
  tone,
  color,
  fit = false,
  accessibilityLabel,
  className,
}: AnimatedNumberProps) {
  return (
    <Text
      numeric
      variant={variant}
      tone={tone}
      style={color ? { color } : undefined}
      numberOfLines={1}
      adjustsFontSizeToFit={fit}
      accessibilityLabel={
        isMaskedText(value) ? HIDDEN_LABEL : accessibilityLabel
      }
      className={className}
    >
      {value}
    </Text>
  );
}

export { AnimatedNumber };
export type { AnimatedNumberProps };
