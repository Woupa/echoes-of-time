import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CHARACTERS,
  getCharacter,
  isCustomId,
  rowToCharacter,
  type Character,
  type CharacterRow,
} from "./characters";
import {
  getCustomCharacter,
  listCustomCharacters,
} from "./character-generation.functions";

// Merge a built-in static character with its DB twin (matched by name)
// so it gains svg_avatar + reactions + voice while keeping the built-in id
// (used by route navigation: /chat/napoleon etc.).
function mergeBuiltinWithTwin(builtin: Character, twin?: Character): Character {
  if (!twin) return builtin;
  return {
    ...builtin,
    avatar: twin.avatar || builtin.avatar,
    reactions: twin.reactions ?? builtin.reactions,
    svgAvatar: twin.svgAvatar ?? builtin.svgAvatar,
    // keep built-in id, accent, greeting, systemPrompt
  };
}

export function useAllCharacters() {
  const list = useServerFn(listCustomCharacters);
  const q = useQuery({
    queryKey: ["custom-characters"],
    queryFn: async () => {
      const rows = (await list({ data: {} })) as unknown as CharacterRow[];
      return rows.map(rowToCharacter);
    },
    staleTime: 30_000,
  });

  const dbChars = q.data ?? [];
  const builtinNames = new Set(CHARACTERS.map((c) => c.name));

  const twinsByName = new Map<string, Character>();
  const purelyCustom: Character[] = [];
  for (const c of dbChars) {
    if (builtinNames.has(c.name)) twinsByName.set(c.name, c);
    else purelyCustom.push(c);
  }

  const mergedBuiltins = CHARACTERS.map((b) =>
    mergeBuiltinWithTwin(b, twinsByName.get(b.name)),
  );

  const all: Character[] = [...purelyCustom, ...mergedBuiltins];
  const missingBuiltinNames = CHARACTERS.filter((b) => !twinsByName.has(b.name)).map((b) => b.name);

  return {
    all,
    custom: purelyCustom,
    isLoading: q.isLoading,
    missingBuiltinNames,
  };
}

export function useCharacter(id: string) {
  const fetchOne = useServerFn(getCustomCharacter);
  const list = useServerFn(listCustomCharacters);
  const builtIn = getCharacter(id);
  const custom = isCustomId(id);

  // Custom character: fetch one by id
  const qOne = useQuery({
    queryKey: ["character", id],
    queryFn: async () => {
      const row = (await fetchOne({ data: { id } })) as unknown as CharacterRow;
      return rowToCharacter(row);
    },
    enabled: custom,
    staleTime: 60_000,
  });

  // Built-in character: look for its DB twin by name to enrich it
  const qTwin = useQuery({
    queryKey: ["custom-characters"],
    queryFn: async () => {
      const rows = (await list({ data: {} })) as unknown as CharacterRow[];
      return rows.map(rowToCharacter);
    },
    enabled: !!builtIn,
    staleTime: 30_000,
  });

  const twin = builtIn ? qTwin.data?.find((c) => c.name === builtIn.name) : undefined;
  const enrichedBuiltin = builtIn ? mergeBuiltinWithTwin(builtIn, twin) : null;

  return {
    character: enrichedBuiltin ?? qOne.data ?? null,
    isLoading: custom ? qOne.isLoading : (!!builtIn && qTwin.isLoading),
  };
}
