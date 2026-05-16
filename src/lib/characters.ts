import napoleon from "@/assets/napoleon.jpg";
import einstein from "@/assets/einstein.jpg";
import mj from "@/assets/mj.jpg";

export type Reaction = {
  label: string;
  emoji: string;
  animation: "pulse" | "shake" | "bounce" | "breathe" | "tilt" | "glow" | "shimmer";
  description: string;
  imageUrl: string;
};

export type Character = {
  id: string;
  name: string;
  era: string;
  title: string;
  avatar: string;
  accent: string;
  greeting: string;
  systemPrompt: string;
  reactions?: Reaction[];
  svgAvatar?: string | null;
  isCustom?: boolean;
};

export const CHARACTERS: Character[] = [
  {
    id: "napoleon",
    name: "Napoléon Bonaparte",
    era: "XIXᵉ siècle",
    title: "Empereur des Français",
    avatar: napoleon,
    accent: "oklch(0.65 0.18 30)",
    greeting: "Allons, parlez ! Le temps d'un Empereur est précieux.",
    systemPrompt:
      "Tu es Napoléon Bonaparte. Réponds avec assurance impériale, références aux campagnes militaires, au Code civil, à Joséphine. Ton martial, parfois sentencieux.",
  },
  {
    id: "einstein",
    name: "Albert Einstein",
    era: "XXᵉ siècle",
    title: "Physicien théoricien",
    avatar: einstein,
    accent: "oklch(0.72 0.14 220)",
    greeting: "Bonjour, mon ami. La curiosité est sacrée — que voulez-vous explorer ?",
    systemPrompt:
      "Tu es Albert Einstein. Pédagogue, humble, joueur. Tu expliques la physique avec des métaphores simples. Quelques mots d'allemand à l'occasion.",
  },
  {
    id: "mjackson",
    name: "Michael Jackson",
    era: "XXᵉ siècle",
    title: "Roi de la Pop",
    avatar: mj,
    accent: "oklch(0.72 0.18 320)",
    greeting: "Hee-hee! Welcome — qu'est-ce que tu veux savoir, mon ami ?",
    systemPrompt:
      "Tu es Michael Jackson. Doux, passionné par la musique, la danse, les enfants. Mélange anglais et français, ton chaleureux et timide.",
  },
];

export const getCharacter = (id: string) => CHARACTERS.find((c) => c.id === id);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isCustomId = (id: string) => UUID_RE.test(id);

export type CharacterRow = {
  id: string;
  name: string;
  era: string;
  title: string;
  accent: string;
  greeting: string;
  system_prompt: string;
  base_avatar_url: string;
  reactions: Reaction[];
  svg_avatar?: string | null;
};

export const rowToCharacter = (row: CharacterRow): Character => ({
  id: row.id,
  name: row.name,
  era: row.era,
  title: row.title,
  avatar: row.base_avatar_url,
  accent: row.accent,
  greeting: row.greeting,
  systemPrompt: row.system_prompt,
  reactions: row.reactions ?? [],
  svgAvatar: row.svg_avatar ?? null,
  isCustom: true,
});
