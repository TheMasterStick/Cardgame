import { validateCard } from "../data/loadCustomCards";
import type { CardDefinition } from "../engine/types";
import { resizeImageToCardArt, resizeImageToSquareCardArt } from "./resizeImage";
import { supabase } from "./supabaseClient";

const COMMON_FIELDS = new Set([
  "id",
  "name",
  "archetype",
  "cost",
  "rarity",
  "text",
  "art",
  "element",
  "faction",
]);

interface CardRow {
  id: string;
  name: string;
  archetype: string;
  cost: number;
  rarity: string;
  text: string | null;
  art: string | null;
  element: string | null;
  faction: string | null;
  data: Record<string, unknown> | null;
}

function toRow(def: CardDefinition, createdBy?: string): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(def)) {
    if (!COMMON_FIELDS.has(key)) data[key] = value;
  }
  return {
    id: def.id,
    name: def.name,
    archetype: def.archetype,
    cost: def.cost,
    rarity: def.rarity,
    text: def.text ?? null,
    art: def.art ?? null,
    element: def.element ?? null,
    faction: def.faction ?? null,
    data,
    ...(createdBy ? { created_by: createdBy } : {}),
  };
}

function fromRow(row: CardRow): CardDefinition | null {
  const flat: Record<string, unknown> = {
    ...(row.data ?? {}),
    id: row.id,
    name: row.name,
    archetype: row.archetype,
    cost: row.cost,
    rarity: row.rarity,
  };
  if (row.text) flat.text = row.text;
  if (row.art) flat.art = row.art;
  if (row.element) flat.element = row.element;
  if (row.faction) flat.faction = row.faction;
  return validateCard(flat);
}

/** Fetches every admin-authored card from the shared catalog. Public read — no auth required. */
export async function fetchRemoteCards(): Promise<CardDefinition[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("cards").select("*");
  if (error || !data) {
    if (error) console.warn("Failed to fetch remote cards:", error.message);
    return [];
  }
  const cards: CardDefinition[] = [];
  for (const row of data as CardRow[]) {
    const card = fromRow(row);
    if (card) cards.push(card);
    else console.warn(`Skipped an invalid remote card ("${row.id}") — check its data against CARDS.md.`);
  }
  return cards;
}

/** Creates or overwrites a card in the shared catalog. Admin-only per RLS. */
export async function saveRemoteCard(def: CardDefinition, userId: string): Promise<string | null> {
  if (!supabase) return "No backend configured.";
  const { error } = await supabase.from("cards").upsert(toRow(def, userId));
  return error ? error.message : null;
}

/** Resizes the given image to the legacy baked-card art proportions and uploads it, returning its public URL. */
export async function uploadCardArt(file: File, cardId: string): Promise<{ url: string | null; error: string | null }> {
  if (!supabase) return { url: null, error: "No backend configured." };
  try {
    const blob = await resizeImageToCardArt(file);
    const path = `${cardId}-${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage
      .from("card-art")
      .upload(path, blob, { contentType: "image/png", upsert: true });
    if (uploadError) return { url: null, error: uploadError.message };
    const { data } = supabase.storage.from("card-art").getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  } catch (err) {
    return { url: null, error: err instanceof Error ? err.message : "Failed to process the image." };
  }
}

/**
 * Upload path for the layered Card Builder. Normalizes raw source art to the
 * project's canonical 2048 x 2048 square before storing it. Kept separate
 * from uploadCardArt so the legacy Admin workflow is not silently changed.
 */
export async function uploadSquareCardArt(file: File, cardId: string): Promise<{ url: string | null; error: string | null }> {
  if (!supabase) return { url: null, error: "No backend configured." };
  try {
    const blob = await resizeImageToSquareCardArt(file);
    const path = `layered/${cardId}-${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage
      .from("card-art")
      .upload(path, blob, { contentType: "image/png", upsert: true });
    if (uploadError) return { url: null, error: uploadError.message };
    const { data } = supabase.storage.from("card-art").getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  } catch (err) {
    return { url: null, error: err instanceof Error ? err.message : "Failed to process the image." };
  }
}
