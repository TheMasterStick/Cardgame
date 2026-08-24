import { describe, expect, it } from "vitest";
import { CARD_ART_EXTENSIONS, cardArtCandidates } from "./artAsset";

describe("cardArtCandidates", () => {
  it("prefers PNG for current local card art while retaining raster fallbacks", () => {
    expect(cardArtCandidates("/cards/Arcane-Missiles.jpg")).toEqual([
      "/cards/Arcane-Missiles.png",
      "/cards/Arcane-Missiles.jpg",
      "/cards/Arcane-Missiles.jpeg",
      "/cards/Arcane-Missiles.webp",
      "/cards/Arcane-Missiles.gif",
    ]);
  });

  it("keeps Stonewall Defender as the explicit JPG exception", () => {
    expect(cardArtCandidates("/cards/Stonewall-Defender.png")).toEqual([
      "/cards/Stonewall-Defender.jpg",
      "/cards/Stonewall-Defender.png",
      "/cards/Stonewall-Defender.jpeg",
      "/cards/Stonewall-Defender.webp",
      "/cards/Stonewall-Defender.gif",
    ]);
  });

  it("preserves query/hash suffixes while changing extensions", () => {
    const candidates = cardArtCandidates("/cards/Test.webp?v=2#crop");
    expect(candidates[0]).toBe("/cards/Test.png?v=2#crop");
    expect(candidates).toContain("/cards/Test.jpg?v=2#crop");
    expect(candidates).toContain("/cards/Test.webp?v=2#crop");
  });

  it("keeps the authored supported extension first for local images outside /cards/", () => {
    expect(cardArtCandidates("/icons/custom.webp")[0]).toBe("/icons/custom.webp");
  });

  it("does not rewrite remote or inline image URLs", () => {
    expect(cardArtCandidates("https://example.com/card.png")).toEqual(["https://example.com/card.png"]);
    expect(cardArtCandidates("data:image/png;base64,abc")).toEqual(["data:image/png;base64,abc"]);
  });

  it("documents the raster formats accepted by the shared resolver", () => {
    expect(CARD_ART_EXTENSIONS).toEqual(["png", "jpg", "jpeg", "webp", "gif"]);
  });
});
