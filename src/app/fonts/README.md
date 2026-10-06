# Local typography

The app uses **Manrope**, the typeface used on vietcombank.com.vn. It is loaded with
`next/font/local` in `src/app/layout.tsx`, so builds need no font downloads, and it
covers Vietnamese, so no fallback family is needed.

All typography, including display text, forms, charts, code and source hashes,
uses the shared `--font-sans` stack in `src/ui/styles/tokens.css`.

The unmodified variable binary (weight range 200–800, normal style only) was
downloaded from the official Google Fonts repository on 2026-10-05; the filename
was shortened locally and the family name remains intact.

- [Manrope source](https://github.com/google/fonts/tree/main/ofl/manrope);
  license: `Manrope-OFL.txt` (SIL Open Font License 1.1). Keep it with the binary.

Manrope has no italic; browsers synthesise oblique text where `<em>` is used.
