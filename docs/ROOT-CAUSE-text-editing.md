# Root cause: "clicking a card's text does nothing" (v1.7.0 → v1.8.2)

**Release numbering restarts here.** The failed attempts below were published as
v1.8.2 through v1.9.11 and have been withdrawn; the fix ships as **v1.8.2**, the
version that follows v1.8.1, because v1.8.1 is where the fault became visible and
the numbers in between describe work that did not work.

Eleven attempts in total. Every one of them was aimed at the press: whether it
arrived, whether it was suppressed, whether the handler ran. The press was never the
problem. This is the account of what was.

## The short version

Two independent defects combined. Either alone is survivable; together they produce
a text editor that cannot be used, and that reports nothing useful about why.

1. **A duplicate editor.** "Which card is being edited" was recorded by cell *number*.
   Every sheet draws the same cell numbers, so opening cell 3 opened a field on every
   sheet in the stack. Several fields then take the caret from each other continuously.
2. **Editing began too early.** From v1.8.1 the edit began on `pointerdown` instead of
   `click`. At `pointerdown` the browser has not yet performed its own default press
   handling, so when the edit opened here, the browser's focus change arrived *after*
   the field was already mounted — and every focus loss ended the edit.

The duplicate editor means the caret is contested. Beginning on `pointerdown` means the
contention starts inside the press itself. The field opens, loses the fight, closes.

## The evidence, from the probe

The report that finally identified it, from a build that had only the mechanism and
none of the fixes:

```
+15ms  a field WAS rendered
+16ms  the field was removed        <- opens and closes in one millisecond
+20ms  the button handler ran
```

And once both fields could exist, the same report showed the contradiction outright:

```
+18ms  a field appeared, focus is TEXTAREA
+18ms  focus is not in the field: TEXTAREA
```

Both true at once is only possible if there is more than one textarea. The probe found
one; the browser focused a different one.

## Why it started at v1.8.1 and not earlier

The duplicate-editor defect is older than v1.8.1. It arrived in **v1.7.0**.

| Release | What it did | Effect |
| --- | --- | --- |
| v1.3.0 (`518dd55`) | Introduced `editing={editingCell === cell.index}` | Harmless: one sheet on screen, so a cell number was a place |
| v1.7.0 (`ac6816e`) | `{sheets.map(...)}` — every sheet drawn at once | **A cell number stopped being a place.** Two sheets, two fields |
| v1.8.0 | Editing began on `click` | The press had finished before the edit opened, so the focus disturbance was already over. The duplicate fields existed but were never both mounted during a press |
| v1.8.1 (`f1ce6ef`) | Editing began on `pointerdown` | **The two defects met.** The edit now opened mid-press, the contested caret began fighting immediately, and the field closed itself |
| v1.8.2 → v1.9.11 | Eleven releases aimed at the press | Each treated a symptom: suppression, focus timing, fallbacks, dismissal. All withdrawn |

So the collision is v1.8.1, but the fault line is v1.7.0. v1.7.0 changed an
assumption ("a cell index identifies a place") without changing the code that
depended on it. Two releases later an unrelated change made the latent defect
live, and the blame went to the unrelated change.

This is the classic shape: **a latent defect plus a trigger, mistaken for a single
bug in the trigger.** Every subsequent attempt fixed the trigger over and over.

## Why the eleven attempts could not have worked

Each release treated one of the following as the cause. All were real observations.
None was the cause.

| Withdrawn release | Theory | Why it could not fix it |
| --- | --- | --- |
| v1.8.2 | The press was not suppressed, so focus landed by pointer position | Correct that `preventDefault` helps; the field was still duplicated and still contested |
| v1.9.2 | `select()` selected everything, so typing felt broken | A real bug, but it only matters once a field is usable |
| v1.9.5 | The press never arrives; open the field from a capture listener | The press always arrived. Measured from a window listener that fires before delivery, so "did not run" was guaranteed |
| v1.9.8 | The callback was looked up in a map and the lookup could silently fail | A real fragility, removed; it was not what failed on the reporting machine |
| v1.9.9 | Blur closed the box, so ignore a blur to nothing | The blur carried a related target and was indistinguishable from a deliberate move |
| v1.9.10 | Blur closes the box at all, so focus never ends an edit | Correct, and necessary — but with two fields open, taking the caret back makes them fight harder rather than less |

The last of them is the instructive one: it removed the closure that v1.8.1 had made
fatal, and the user's next report was *"it is flickering very fast."* The flicker was the
duplicate editor, now visible because nothing was closing it. The remaining defect
had been there since v1.7.0 and could not be seen while the first one was killing
the field.

## The two fixes, both in v1.8.2

**The duplicate editor** — the edit state carries the sheet it began on, and each
sheet is handed only its own edit. Selection had guarded against exactly this since
v1.7.0 (`selectionHere`); editing was the one place that did not.

**The self-closing field** — a lost focus never ends an edit. An edit ends on Escape,
on a press on another card, or on a press on the canvas around the sheets.

The second is what made the first observable: with the field no longer closing
itself, the duplicate editors were free to show themselves as a flicker. The first
is the cause.

## What would have found this sooner

Not more guesses. Two things:

1. **Ask the DOM how many editors exist.** Every diagnostic from v1.9.4 onward
   counted *fields found*, never *fields present*. `document.querySelectorAll('textarea')`
   returns one element; asking for `.length` would have shown two on a two-sheet
   document. The probe eventually did watch for this, but only after the duplicate
   had been found by other means.
2. **Check the assumption a container change invalidates.** v1.7.0 changed "one sheet
   on screen" to "every sheet on screen". Anything keyed by a per-sheet value needed
   re-reading. `selectionHere` was updated in v1.7.0. `editing` was not, because
   nothing drew attention to it.

## The rule this leaves behind

> When a container changes from showing one item to showing all of them, every key
> that identifies a place must be re-examined. A bare index is a place only while
> there is one list.

And the diagnostic corollary, which cost more than the bug:

> A probe that fires before the code it is measuring will report absences that are
> guaranteed by the clock. Measure after delivery, and count things rather than
> sampling them.
