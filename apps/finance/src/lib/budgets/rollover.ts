/**
 * Envelope rollover. Each period starts with the budget amount plus whatever the previous period left over
 * (negative when it overspent), so unspent money accumulates and overspend is paid back. The chain starts at the
 * period the budget was created in, which carries nothing in.
 */

/**
 * Carry into the period after `spentPerPeriod`, oldest first. Every period's available amount is `amount` plus
 * the carry it received; its leftover (available minus spent) is what it hands on.
 */
export function rolloverCarry(
  amount: number,
  spentPerPeriod: readonly number[],
): number {
  let carry = 0;
  for (const spent of spentPerPeriod) carry = amount + carry - spent;
  return carry;
}
