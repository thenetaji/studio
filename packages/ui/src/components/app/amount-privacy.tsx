import * as React from "react";

import { MASK, maskMoney } from "@studio/money";

/** What a screen reader says for a masked amount. */
export const HIDDEN_LABEL = "Hidden";

const AmountsHiddenContext = React.createContext(false);

/**
 * App-wide privacy switch for money components. `Amount` and `AmountReadout` mask their text and speak "Hidden"
 * while it is on; chart shapes and layout are unchanged. Formatted strings elsewhere are masked through the masked
 * locale (`maskLocale` in `@studio/money`), which every display path passes to `formatMoney`.
 */
function AmountsHiddenProvider({
  hidden,
  children,
}: {
  hidden: boolean;
  children: React.ReactNode;
}) {
  return (
    <AmountsHiddenContext.Provider value={hidden}>
      {children}
    </AmountsHiddenContext.Provider>
  );
}

function useAmountsHidden(): boolean {
  return React.useContext(AmountsHiddenContext);
}

/** True when a formatted string has already been masked (its digits are bullets). */
function isMaskedText(text: string): boolean {
  return text.includes(MASK.slice(0, 2));
}

/** Masks `text` when hidden; leaves it as is otherwise. Idempotent. */
function maskIf(hidden: boolean, text: string): string {
  return hidden ? maskMoney(text) : text;
}

export { AmountsHiddenProvider, useAmountsHidden, isMaskedText, maskIf };
