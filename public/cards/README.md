# Card art

Drop image files here (PNG/JPG/WebP, any size — cards render at ~96px wide
so anything roughly square or portrait-oriented works well).

To use one, set the `art` field on the card in `src/data/cards.ts` to
`"/cards/your-file.png"` — the leading `/cards/` maps to this folder.

External URLs work too: `art: "https://example.com/image.png"`.

Leave `art` unset (or omit it) to keep the plain text card layout.
