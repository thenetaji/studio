import type { ReactNode } from "react";

import { AmountsHiddenProvider } from "@studio/ui";
import { useSetting } from "@/data/hooks";

/** Feeds the Hide amounts setting to every `Amount` and `AmountReadout` below it. */
export function AmountsPrivacy({ children }: { children: ReactNode }) {
  const [hidden] = useSetting("hide_amounts");
  return (
    <AmountsHiddenProvider hidden={hidden}>{children}</AmountsHiddenProvider>
  );
}
