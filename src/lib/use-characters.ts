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

  const custom = q.data ?? [];
  const all: Character[] = [...custom, ...CHARACTERS];
  return { all, custom, isLoading: q.isLoading };
}

export function useCharacter(id: string) {
  const fetchOne = useServerFn(getCustomCharacter);
  const builtIn = getCharacter(id);
  const custom = isCustomId(id);

  const q = useQuery({
    queryKey: ["character", id],
    queryFn: async () => {
      const row = (await fetchOne({ data: { id } })) as unknown as CharacterRow;
      return rowToCharacter(row);
    },
    enabled: custom,
    staleTime: 60_000,
  });

  return {
    character: builtIn ?? q.data ?? null,
    isLoading: custom && q.isLoading,
  };
}
