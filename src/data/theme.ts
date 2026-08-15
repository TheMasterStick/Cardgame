/**
 * Visual theme config — edit these to reskin the board without touching any
 * engine or UI code. Leave a field empty ("") to keep the plain dark
 * background. Each value is an image URL or a path to a file dropped in
 * public/boards/ (e.g. "/boards/tavern.jpg").
 */
export interface BoardTheme {
  /** Background behind the whole page. */
  appBackground: string;
  /** Background behind the opponent's board panel (top half). */
  opponentBoardBackground: string;
  /** Background behind your own board panel (bottom half). */
  playerBoardBackground: string;
}

export const BOARD_THEME: BoardTheme = {
  appBackground: "",
  opponentBoardBackground: "",
  playerBoardBackground: "",
};

export function cssImage(url: string): string {
  return url ? `url("${url}")` : "none";
}
