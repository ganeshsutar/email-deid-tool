import type { AvatarConfig } from "@/types/models";

const DICEBEAR_BASE = "https://api.dicebear.com/9.x/avataaars/svg";

export function buildAvatarUrl(
  config: AvatarConfig | null,
  fallbackSeed: string,
  size?: number,
): string {
  const params = new URLSearchParams();
  const seed = config?.seed ?? fallbackSeed;
  params.set("seed", seed);

  if (config) {
    for (const [key, value] of Object.entries(config)) {
      if (key !== "seed" && value !== undefined && value !== "") {
        params.set(key, String(value));
      }
    }
  }

  if (size) {
    params.set("size", String(size));
  }

  return `${DICEBEAR_BASE}?${params.toString()}`;
}

export const AVATAAR_OPTIONS = {
  top: [
    "bigHair", "bob", "bun", "curly", "curvy", "dreads",
    "frida", "fro", "froAndBand", "longButNotTooLong",
    "miaWallace", "microBraids", "miniAfro", "miniAfroPick",
    "mohawk", "noHair", "shavedSides", "straight01",
    "straight02", "straightAndStrand", "theCaesar",
    "theCaesarAndSidePart", "turban", "winterHat01",
    "winterHat02", "winterHat03", "winterHat04",
    "hat", "hijab", "eyepatch",
  ],
  accessories: [
    "eyepatch", "kurt", "prescription01", "prescription02",
    "round", "sunglasses", "wayfarers",
  ],
  clothing: [
    "blazerAndShirt", "blazerAndSweater", "collarAndSweater",
    "graphicShirt", "hoodie", "overall", "shirtCrewNeck",
    "shirtScoopNeck", "shirtVNeck",
  ],
  clothingGraphic: [
    "bat", "bear", "cumbia", "deer", "diamond", "hola",
    "pizza", "resist", "selena", "skull", "skullOutline",
  ],
  eyes: [
    "default", "close", "cry", "dizzy", "eyeRoll", "happy",
    "hearts", "side", "squint", "surprised", "wink",
    "winkWacky", "xDizzy",
  ],
  eyebrows: [
    "default", "defaultNatural", "angry", "angryNatural",
    "flatNatural", "frownNatural", "raisedExcited",
    "raisedExcitedNatural", "sadConcerned", "sadConcernedNatural",
    "unibrowNatural", "upDown", "upDownNatural",
  ],
  mouth: [
    "default", "concerned", "disbelief", "eating", "grimace",
    "sad", "screamOpen", "serious", "smile", "tongue",
    "twinkle", "vomit",
  ],
  facialHair: [
    "blank", "beardLight", "beardMajestic", "beardMedium",
    "moustacheFancy", "moustacheMagnum",
  ],
  skinColor: [
    "614335", "ae5d29", "d08b5b", "edb98a", "f8d25c", "fd9841", "ffdbb4",
  ],
  hairColor: [
    "a55728", "b58143", "c93305", "d6b370", "e8e1e1",
    "2c1b18", "4a312c", "724133", "f59797", "ecdcbf",
  ],
  hatColor: [
    "262e33", "3c4f5c", "65c9ff", "5199e4", "25557c",
    "929598", "a7ffc4", "e6e6e6", "ff5c5c", "ffafb9",
    "ffffb1", "ff488e", "ff6f00", "ffffff",
  ],
  clothesColor: [
    "262e33", "3c4f5c", "65c9ff", "5199e4", "25557c",
    "929598", "a7ffc4", "e6e6e6", "ff5c5c", "ffafb9",
    "ffffb1", "ff488e", "ff6f00", "ffffff",
  ],
  nose: ["default"],
} as const;

export type AvataarOptionKey = keyof typeof AVATAAR_OPTIONS;

export const AVATAAR_OPTION_KEYS = Object.keys(AVATAAR_OPTIONS) as AvataarOptionKey[];

export function formatOptionLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}
