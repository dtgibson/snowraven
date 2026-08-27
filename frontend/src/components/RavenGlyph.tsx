import type { CSSProperties } from 'react'

// The SnowRaven raven mark: the clean vector trace of the v0.5.93 app icon's
// raven, inlined as a dependency-free single-path SVG. It replaced the generic
// lucide Bird at the app's two brand-mark sites (the App.tsx header and the
// WelcomeScreen mark) in v1.0.3, completing the v0.5.93 mark unification
// inside the app itself.
//
// Master artwork (source of truth, committed per the v0.5.93 asset
// convention so regeneration never depends on a Downloads folder):
//   frontend/src/assets/snowraven-bird-glyph.svg
// This path is that file's, with its baked default color and title/desc
// stripped: the mark is decorative everywhere it renders (aria-hidden is
// unconditional; the adjacent wordmark carries the name), and color comes
// from CSS currentColor only. Give it a token at the call site, e.g.
// style={{ color: 'var(--sr-accent)' }}; never a literal color value.
//
// Deliberately dependency-free: it rides the App.tsx entry chunk
// (entryChunk.test.ts polices that graph).

interface RavenGlyphProps {
  /** Rendered width AND height in px; the square 512 viewBox keeps it 1:1. */
  size: number
  /** Pass-through for the color token, exactly as the lucide sites did. */
  style?: CSSProperties
}

const RAVEN_PATH =
  'M 150.79 440.77 L 176.47 435.39 L 197.48 429.33 L 213.04 423.88 L 245.73 409.97 L 270.63 397.28 L 296.30 381.80 L 318.09 366.18 L 336.57 350.44 L 352.33 334.58 L 367.31 316.20 L 379.08 297.53 L 385.19 285.08 L 389.91 273.41 L 395.34 253.95 L 396.99 244.61 L 398.12 232.16 L 397.64 214.27 L 393.73 194.04 L 386.46 169.91 L 384.84 159.02 L 385.60 149.68 L 388.70 139.57 L 394.35 130.77 L 399.02 125.85 L 405.25 120.87 L 417.70 113.66 L 430.15 109.05 L 445.71 105.74 L 451.93 105.05 L 464.38 105.06 L 473.72 106.67 L 484.62 111.08 L 485.38 110.77 L 485.11 101.44 L 483.21 95.21 L 479.17 87.44 L 473.72 81.39 L 464.38 74.65 L 449.60 68.35 L 437.93 65.33 L 410.69 60.66 L 402.71 53.19 L 392.02 45.17 L 381.12 38.75 L 373.34 35.08 L 354.67 28.85 L 339.10 26.17 L 322.76 25.37 L 311.09 26.27 L 297.08 28.66 L 288.52 31.10 L 273.74 37.43 L 262.07 44.46 L 253.51 51.19 L 244.65 60.19 L 234.69 73.42 L 226.06 88.21 L 215.97 110.77 L 198.93 152.79 L 199.81 153.14 L 210.71 148.11 L 230.16 141.75 L 241.83 139.37 L 254.28 138.31 L 267.51 138.63 L 281.50 141.12 L 293.19 144.94 L 303.31 150.17 L 311.57 155.91 L 321.42 166.02 L 327.70 175.36 L 332.88 187.08 L 335.35 196.37 L 336.92 208.82 L 336.90 218.94 L 334.38 236.06 L 328.50 255.51 L 319.29 274.96 L 307.20 294.01 L 289.43 316.20 L 271.40 335.03 L 248.84 355.96 L 146.83 440.71 L 147.68 441.18 Z M 361.37 83.54 L 355.44 83.04 L 349.39 79.65 L 345.70 75.76 L 340.28 67.20 L 335.99 63.61 L 331.05 60.97 L 331.32 60.45 L 343.77 60.10 L 354.67 61.50 L 367.12 66.26 L 376.07 72.64 L 374.90 74.46 L 367.89 80.74 Z M 384.80 96.77 L 381.12 97.22 L 379.95 96.77 L 389.68 89.61 L 398.24 84.87 L 409.14 81.06 L 423.14 79.17 L 436.37 79.99 L 446.49 82.49 L 458.16 88.01 L 465.16 93.23 L 467.68 95.99 L 466.72 96.57 L 440.26 94.09 L 416.92 93.78 L 399.02 94.86 Z M 27.07 486.63 L 42.63 480.11 L 57.41 472.78 L 83.87 457.96 L 111.11 441.03 L 146.90 416.35 L 188.78 384.68 L 227.05 353.61 L 252.69 330.99 L 266.74 317.42 L 278.01 305.31 L 291.95 288.19 L 298.64 278.72 L 306.04 266.40 L 311.49 255.51 L 315.26 246.17 L 317.53 239.17 L 319.92 228.27 L 321.08 218.94 L 321.06 210.38 L 320.04 201.82 L 318.42 194.81 L 315.25 187.03 L 311.19 180.03 L 307.72 175.36 L 302.53 170.13 L 295.53 164.95 L 286.97 160.39 L 276.07 156.55 L 269.07 154.98 L 260.51 153.84 L 248.84 153.69 L 231.72 155.87 L 220.82 158.88 L 212.26 162.07 L 203.81 166.02 L 195.15 171.24 L 186.59 177.15 L 176.64 185.48 L 162.41 200.26 L 153.88 211.15 L 143.79 226.74 L 136.73 239.17 L 125.74 261.73 L 109.38 300.64 L 78.90 379.23 L 79.98 379.55 L 90.87 375.49 L 106.44 367.80 L 123.56 357.64 L 148.46 339.41 L 149.24 339.06 L 149.37 339.55 L 133.67 359.67 L 120.96 373.01 L 107.66 384.68 L 87.69 397.91 L 62.88 436.82 L 44.33 463.27 L 26.62 485.84 Z'

export function RavenGlyph({ size, style }: RavenGlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      <path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d={RAVEN_PATH} />
    </svg>
  )
}
