/** A rectangle expressed as a fraction (0–1) of the source page.
 *  Normalised so a preset survives differing source page sizes. */
export interface NormalisedBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export type TextFieldKind = 'title' | 'subtitle' | 'body' | 'footer'

export type ImageStrategy = 'raw-object' | 'region-crop'

export interface TemplateField {
  readonly id: string
  readonly kind: TextFieldKind
  readonly label: string
  readonly box: NormalisedBox
  /** Default point size at trim scale. */
  readonly fontSizePt: number
  readonly align: 'left' | 'center' | 'right'
  readonly lineHeight: number
}

export interface TemplatePreset {
  readonly id: string
  readonly name: string
  readonly version: number
  readonly fields: readonly TemplateField[]
  readonly imageBox: NormalisedBox
  readonly imageStrategy: ImageStrategy
  readonly cropDpi: number
  readonly createdAt: string
}

export const FIELD_LABELS: Record<TextFieldKind, string> = {
  title: 'Title',
  subtitle: 'Subtitle',
  body: 'Body',
  footer: 'Footer / SKU',
}
