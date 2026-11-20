/**
 * Removing a photograph's background, without a model and without a network.
 *
 * This is the classical cut-out, chosen deliberately over a segmentation model: a U²-Net
 * sized network is several megabytes of weights, larger than this app's entire JavaScript
 * bundle, and it would have to be fetched and cached before the first use — which changes
 * what "works offline" means for a tool that otherwise needs nothing after install. The
 * cost is a method that is honest about its limits.
 *
 * The method is flood fill from the border, in Lab-ish colour distance, followed by a
 * one-pixel feather. It assumes what a recipe photo usually is: a dish on a plate or tray,
 * filling most of the frame, against a background that is broadly one colour. It fails,
 * visibly and without damaging the source, on a busy background — the caller must keep the
 * original so a bad cut can be undone.
 *
 * The core is pure and synchronous on a plain pixel buffer, so it can be reasoned about and
 * tested without a DOM — `ImageData` does not exist in the test environment, and nothing
 * about the algorithm needs it.
 */

/** How far a pixel may be from the background sample and still count as background. */
export const DEFAULT_TOLERANCE = 34

export interface CutoutOptions {
  /** 0–100, where 0 removes almost nothing and 100 removes nearly everything. */
  readonly tolerance?: number
}

/** Squared distance between two RGB triples, in a rough perceptual weighting. */
function distance(
  r: number, g: number, b: number,
  r2: number, g2: number, b2: number,
): number {
  const dr = r - r2
  const dg = g - g2
  const db = b - b2
  // Weighted for the eye rather than for the maths: green carries most of the luminance.
  return dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11
}

/** The colour a border pixel is most likely to represent: the median of the frame edge. */
function backgroundSample(data: Uint8ClampedArray, width: number, height: number): [number, number, number] {
  const samples: [number, number, number][] = []
  const stepX = Math.max(1, Math.floor(width / 32))
  const stepY = Math.max(1, Math.floor(height / 32))

  for (let x = 0; x < width; x += stepX) {
    for (const y of [0, height - 1]) {
      const i = (y * width + x) * 4
      samples.push([data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0])
    }
  }
  for (let y = 0; y < height; y += stepY) {
    for (const x of [0, width - 1]) {
      const i = (y * width + x) * 4
      samples.push([data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0])
    }
  }

  if (samples.length === 0) return [255, 255, 255]
  // Component-wise median: robust against one corner being much brighter than the rest.
  const median = (channel: 0 | 1 | 2): number => {
    const values = samples.map((sample) => sample[channel]).sort((a, b) => a - b)
    return values[Math.floor(values.length / 2)] ?? 255
  }
  return [median(0), median(1), median(2)]
}

/**
 * Clears the background behind a photo, in place on a copy.
 *
 * @returns the cleared pixels, or `null` when the image is too small to be worth trying
 */
export interface Pixels {
  readonly data: Uint8ClampedArray
  readonly width: number
  readonly height: number
}

export function cutoutPixels(
  source: Pixels,
  options: CutoutOptions = {},
): Pixels | null {
  const { width, height, data } = source
  if (width < 8 || height < 8) return null

  const tol = Math.min(1, Math.max(0, (options.tolerance ?? DEFAULT_TOLERANCE) / 100))
  const [br, bg, bb] = backgroundSample(data, width, height)
  /*
    A squared distance, because that is what `distance` returns and comparing squares
    avoids a square root per pixel. `tol` is treated as a fraction of the full channel
    range, so 34% means "within 87 levels on a 255 scale" — about the width of a shadow
    cast by a plate, and far tighter than a different dish's colour.
  */
  const channelRange = 255 * tol
  const near = channelRange * channelRange

  // A flood fill from every border pixel, so a background that is not connected to the
  // frame — a gap between two plates — is not mistaken for the subject.
  const seen = new Uint8Array(width * height)
  const stack: number[] = []
  const push = (index: number): void => {
    if (index < 0 || index >= seen.length || seen[index] === 1) return
    const i = index * 4
    const d = distance(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0, br, bg, bb)
    if (d > near) return
    seen[index] = 1
    stack.push(index)
  }

  for (let x = 0; x < width; x += 1) {
    push(x)
    push((height - 1) * width + x)
  }
  for (let y = 0; y < height; y += 1) {
    push(y * width)
    push(y * width + width - 1)
  }

  const removed = new Uint8Array(width * height)
  while (stack.length > 0) {
    const index = stack.pop() ?? 0
    removed[index] = 1
    const x = index % width
    const y = Math.floor(index / width)
    if (x > 0) push(index - 1)
    if (x < width - 1) push(index + 1)
    if (y > 0) push(index - width)
    if (y < height - 1) push(index + width)
  }

  /*
    Feather the edge by one pixel. A hard cut leaves the photograph's own anti-aliased
    boundary behind as a halo of background colour, which reads as a grey outline on a
    white card. A removed pixel that touches a kept one keeps half its alpha, so the edge
    blends instead of stepping.
  */
  const out = new Uint8ClampedArray(data)
  let removedCount = 0
  for (let index = 0; index < removed.length; index += 1) {
    if (removed[index] === 0) continue
    removedCount += 1
    const x = index % width
    const y = Math.floor(index / width)
    const touchesKept =
      (x > 0 && removed[index - 1] === 0) ||
      (x < width - 1 && removed[index + 1] === 0) ||
      (y > 0 && removed[index - width] === 0) ||
      (y < height - 1 && removed[index + width] === 0)

    /*
      Half alpha on the ring, zero beyond it. A flooded pixel is by definition close to
      the background colour, so gating this on a second colour threshold — as an earlier
      version did — made it unreachable: everything the fill takes is inside the first
      threshold already.
    */
    out[index * 4 + 3] = touchesKept ? 128 : 0
  }

  // A cut that removed nothing, or removed everything, is not a cut — the caller should
  // keep the original rather than show a blank card or a pointless re-encode.
  if (removedCount === 0 || removedCount === removed.length) return null

  return { data: out, width, height }
}

/** The canvas-shaped wrapper: an `ImageData` in, an `ImageData` out. */
export function removeBackground(source: ImageData, options: CutoutOptions = {}): ImageData | null {
  const cleared = cutoutPixels(source, options)
  if (cleared === null) return null
  // `ImageData` insists on an `ArrayBuffer`-backed view; the copy also keeps the caller's
  // buffer from being aliased by anything the canvas does later.
  return new ImageData(new Uint8ClampedArray(cleared.data), cleared.width, cleared.height)
}
