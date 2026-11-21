import type { TextEditGesture } from '../../features/workspace/cards/use-text-edit-gesture'

/**
 * A card's press gesture, harmless in jsdom.
 *
 * `Card` takes the sheet-level gesture as a required prop so that a forgotten wire is a
 * compile error rather than a text box that silently stops opening. Unit tests render a
 * card on its own, with no sheet above it, so they hand in this: it records nothing and
 * does nothing, which is exactly what a card under test needs.
 */
export const textEditGestureStub: TextEditGesture = {
  press: () => undefined,
  register: () => undefined,
}
