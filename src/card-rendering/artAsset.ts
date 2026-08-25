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

/** Keeps saved Card Builder drafts on the same resolved local asset path as every runtime renderer. */
export async function migrateStoredCardBuilderArtPaths(
  storage: Pick<Storage, "getItem" | "setItem" | "key" | "length"> = localStorage,
): Promise<void> {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
    (key): key is string => Boolean(key?.startsWith("card-builder:draft:")),
  );

  await Promise.all(
    keys.map(async (key) => {
      const raw = storage.getItem(key);
      if (!raw) return;
      try {
        const draft = JSON.parse(raw) as { art?: unknown };
        if (typeof draft.art !== "string" || !draft.art) return;
        const resolved = await resolveCardArtPath(draft.art);
        if (resolved === draft.art) return;
        draft.art = resolved;
        storage.setItem(key, JSON.stringify(draft));
      } catch {
        // Leave malformed/legacy drafts alone; the Builder already handles invalid JSON on selection.
      }
    }),
  );
}
