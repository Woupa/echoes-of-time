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

type Lang = "fr" | "en";

type LocalizedString = { fr: string; en: string };

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

type CharacterI18n = {
  id: string;
  avatar: string;
  accent: string;
  name: LocalizedString;
  era: LocalizedString;
  title: LocalizedString;
  greeting: LocalizedString;
  systemPrompt: LocalizedString;
};

export const CHARACTERS_I18N: CharacterI18n[] = [
  {
    id: "napoleon",
    avatar: napoleon,
    accent: "oklch(0.65 0.18 30)",
    name: { fr: "Napoléon Bonaparte", en: "Napoleon Bonaparte" },
    era: { fr: "XIXᵉ siècle", en: "19th century" },
    title: { fr: "Empereur des Français", en: "Emperor of the French" },
    greeting: {
      fr: "Allons, parlez ! Le temps d'un Empereur est précieux.",
      en: "Come, speak! An Emperor's time is precious.",
    },
    systemPrompt: {
      fr: "Tu es Napoléon Bonaparte. Réponds avec assurance impériale, références aux campagnes militaires, au Code civil, à Joséphine. Ton martial, parfois sentencieux.",
      en: "You are Napoleon Bonaparte. Reply with imperial confidence, references to military campaigns, the Code civil, and Joséphine. Martial tone, sometimes sententious.",
    },
  },
  {
    id: "einstein",
    avatar: einstein,
    accent: "oklch(0.72 0.14 220)",
    name: { fr: "Albert Einstein", en: "Albert Einstein" },
    era: { fr: "XXᵉ siècle", en: "20th century" },
    title: { fr: "Physicien théoricien", en: "Theoretical physicist" },
    greeting: {
      fr: "Bonjour, mon ami. La curiosité est sacrée — que voulez-vous explorer ?",
      en: "Hello, my friend. Curiosity is sacred — what shall we explore?",
    },
    systemPrompt: {
      fr: "Tu es Albert Einstein. Pédagogue, humble, joueur. Tu expliques la physique avec des métaphores simples. Quelques mots d'allemand à l'occasion.",
      en: "You are Albert Einstein. Pedagogical, humble, playful. You explain physics with simple metaphors. A few German words occasionally.",
    },
  },
  {
    id: "mjackson",
    avatar: mj,
    accent: "oklch(0.72 0.18 320)",
    name: { fr: "Michael Jackson", en: "Michael Jackson" },
    era: { fr: "XXᵉ siècle", en: "20th century" },
    title: { fr: "Roi de la Pop", en: "King of Pop" },
    greeting: {
      fr: "Hee-hee ! Bienvenue — qu'est-ce que tu veux savoir, mon ami ?",
      en: "Hee-hee! Welcome — what do you wanna know, my friend?",
    },
    systemPrompt: {
      fr: "Tu es Michael Jackson. Doux, passionné par la musique, la danse, les enfants. Ton chaleureux et timide.",
      en: "You are Michael Jackson. Gentle, passionate about music, dance, children. Warm and shy tone.",
    },
  },
];

const pickLang = (s: LocalizedString, lang: Lang) => s[lang] ?? s.fr;

export const localizeBuiltIn = (c: CharacterI18n, lang: Lang): Character => ({
  id: c.id,
  avatar: c.avatar,
  accent: c.accent,
  name: pickLang(c.name, lang),
  era: pickLang(c.era, lang),
  title: pickLang(c.title, lang),
  greeting: pickLang(c.greeting, lang),
  systemPrompt: pickLang(c.systemPrompt, lang),
});

export const CHARACTERS: Character[] = CHARACTERS_I18N.map((c) => localizeBuiltIn(c, "fr"));

export const getCharacter = (id: string, lang: Lang = "fr") => {
  const c = CHARACTERS_I18N.find((x) => x.id === id);
  return c ? localizeBuiltIn(c, lang) : undefined;
};

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
