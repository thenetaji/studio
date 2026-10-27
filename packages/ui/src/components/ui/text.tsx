import * as Slot from "@rn-primitives/slot";
import { cva } from "class-variance-authority";
import * as React from "react";
import { Platform, Text as RNText } from "react-native";

import { cn } from "../../lib/utils";
import { dynamicType, roundedFamily, type TypeVariant } from "@studio/theme";

const variantClass: Record<TypeVariant, string> = {
  display: "text-[54px] leading-[60px] font-bold tracking-[-2.4px]",
  hero: "text-[44px] leading-[50px] font-bold tracking-[-2px]",
  amountEntry: "text-[44px] leading-[52px] font-semibold tracking-[-1px]",
  largeTitle: "text-[34px] leading-[41px] font-bold tracking-[-0.4px]",
  title1: "text-[28px] leading-[34px] font-bold tracking-[-0.3px]",
  title2: "text-[22px] leading-[28px] font-semibold tracking-[-0.2px]",
  headline: "text-[17px] leading-[22px] font-semibold",
  body: "text-[17px] leading-[22px] font-normal",
  callout: "text-[16px] leading-[21px] font-normal",
  subhead: "text-[15px] leading-[20px] font-normal",
  footnote: "text-[13px] leading-[18px] font-normal",
  caption: "text-[12px] leading-[16px] font-medium tracking-[0.1px]",
};

const toneVariants = cva("", {
  variants: {
    tone: {
      default: "text-foreground",
      secondary: "text-secondary",
      tertiary: "text-tertiary",
      accent: "text-accent-text",
      income: "text-income",
      expense: "text-expense",
      warning: "text-warning",
      inverted: "text-overlay-foreground",
    },
  },
  defaultVariants: { tone: "default" },
});

type TextTone = NonNullable<
  NonNullable<Parameters<typeof toneVariants>[0]>["tone"]
>;

const multiplier: Partial<Record<TypeVariant, number>> = {
  display: dynamicType.hero,
  hero: dynamicType.hero,
  amountEntry: dynamicType.hero,
  largeTitle: dynamicType.hero,
};

const TextClassContext = React.createContext<string | undefined>(undefined);

/** Amounts use SF Pro Rounded on iOS, as Wallet and Fitness do; elsewhere the system face. */
const ROUNDED =
  Platform.OS === "ios" ? { fontFamily: roundedFamily } : undefined;

type TextProps = React.ComponentProps<typeof RNText> & {
  variant?: TypeVariant;
  tone?: TextTone;
  numeric?: boolean;
  asChild?: boolean;
};

function Text({
  className,
  asChild = false,
  variant = "body",
  tone,
  numeric = false,
  maxFontSizeMultiplier,
  style,
  ...props
}: TextProps) {
  const inherited = React.useContext(TextClassContext);
  const Component = asChild ? Slot.Text : RNText;
  return (
    <Component
      maxFontSizeMultiplier={
        maxFontSizeMultiplier ?? multiplier[variant] ?? dynamicType.default
      }
      className={cn(
        variantClass[variant],
        tone === undefined && toneVariants({ tone: "default" }),
        inherited,
        tone !== undefined && toneVariants({ tone }),
        numeric && "tabular-nums",
        className,
      )}
      style={numeric && ROUNDED ? [ROUNDED, style] : style}
      {...props}
    />
  );
}

export { Text, TextClassContext, toneVariants };
export type { TextProps, TextTone };
