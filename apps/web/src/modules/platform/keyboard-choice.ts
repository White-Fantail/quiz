/** Numeric shortcuts work for both the digit row and the numeric keypad.
 * Numeric navigation keys when Num Lock is off are intentionally ignored.
 */
export function answerShortcutIndex(event: Pick<KeyboardEvent,
  "key" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey" | "repeat" | "isComposing"
>): number | null {
  if (event.repeat || event.isComposing ||
      event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
      !/^[1-9]$/.test(event.key)) return null;
  return Number(event.key) - 1;
}
