export const CARD_ART_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"] as const;

export type CardArtExtension = (typeof CARD_ART_EXTENSIONS)[number];

type HasArt = { art?: string };

const STONEWALL_DEFENDER_STEM = "/cards/Stonewall-Defender";

function splitSuffix(path: string) {
  const match = path.match(/^([^?#]*)([?#].*)?$/);
  return { pathname: match?.[1] ?? path, suffix: match?.[2] ?? "" };
}

function isRemoteOrInline(path: string) {
  return /^(?:https?:|data:|blob:)/i.test(path);
}

function extensionOrder(stem: string, existingExtension?: string): CardArtExtension[] {
  // The current raw-art library is PNG-first. Stonewall Defender is the one
  // intentional JPG exception. Other local image paths keep their authored
  // extension first so this helper remains useful outside /cards/ as well.
  if (stem.toLowerCase() === STONEWALL_DEFENDER_STEM.toLowerCase()) {
    return ["jpg", "png", "jpeg", "webp", "gif"];
  }
  if (stem.toLowerCase().startsWith("/cards/")) {
    return ["png", "jpg", "jpeg", "webp", "gif"];
  }

  const supportedExisting = existingExtension && CARD_ART_EXTENSIONS.includes(existingExtension as CardArtExtension)
    ? (existingExtension as CardArtExtension)
    : undefined;
  return supportedExisting
    ? [supportedExisting, ...CARD_ART_EXTENSIONS.filter((extension) => extension !== supportedExisting)]
    : [...CARD_ART_EXTENSIONS];
}

export function cardArtCandidates(path: string): string[] {
  if (!path || isRemoteOrInline(path)) return [path];

  const { pathname, suffix } = splitSuffix(path);
  const extensionMatch = pathname.match(/\.([a-z0-9]+)$/i);
  const existingExtension = extensionMatch?.[1]?.toLowerCase();
  const stem = extensionMatch && existingExtension && CARD_ART_EXTENSIONS.includes(existingExtension as CardArtExtension)
    ? pathname.slice(0, -extensionMatch[0].length)
    : pathname;

  const candidates: string[] = [];
  for (const extension of extensionOrder(stem, existingExtension)) {
    const candidate = `${stem}.${extension}${suffix}`;
    if (!candidates.includes(candidate)) candidates.push(candidate);
  }
  return candidates;
}

function canLoadImage(path: string): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = path;
  });
}

export async function resolveCardArtPath(path: string): Promise<string> {
  if (!path || isRemoteOrInline(path)) return path;
  for (const candidate of cardArtCandidates(path)) {
    if (await canLoadImage(candidate)) return candidate;
  }
  return path;
}

export async function resolveCardDefinitionArtPaths<T extends Record<string, HasArt>>(definitions: T): Promise<void> {
  await Promise.all(
    Object.values(definitions).map(async (definition) => {
      if (!definition.art) return;
      definition.art = await resolveCardArtPath(definition.art);
    }),
  );
}
