import { type Character } from "@/lib/characters";
import type { AvatarState } from "@/hooks/useAvatarState";
import { NapoleonAvatar } from "@/assets/avatars/napoleon.svg";
import { EinsteinAvatar } from "@/assets/avatars/einstein.svg";
import { MJAvatar } from "@/assets/avatars/mj.svg";

type Props = {
  character: Character;
  state: AvatarState;
  size?: "full" | "pip";
};

const stateLabel: Record<AvatarState, string> = {
  idle: "au repos",
  talking: "en train de parler",
  thinking: "en train de réfléchir",
  listening: "à l'écoute",
  reacting: "réagit",
};

export function CharacterAvatar2D({ character, state, size = "full" }: Props) {
  const Avatar =
    character.id === "napoleon"
      ? NapoleonAvatar
      : character.id === "einstein"
        ? EinsteinAvatar
        : character.id === "mjackson"
          ? MJAvatar
          : NapoleonAvatar;

  const willChange = state === "talking" || state === "reacting" ? "transform" : "auto";

  return (
    <div
      role="img"
      aria-label={`Avatar animé de ${character.name}, état : ${stateLabel[state]}`}
      className={
        size === "full"
          ? "relative flex h-full w-full items-center justify-center"
          : "relative flex h-full w-full items-center justify-center rounded-full overflow-hidden"
      }
      style={{
        background:
          size === "full"
            ? `radial-gradient(ellipse at 50% 60%, color-mix(in oklab, ${character.accent} 30%, transparent) 0%, transparent 70%)`
            : `color-mix(in oklab, ${character.accent} 20%, var(--card))`,
        willChange,
      }}
    >
      <Avatar state={state} />
    </div>
  );
}
