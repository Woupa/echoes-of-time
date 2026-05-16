import type { AvatarState } from "@/hooks/useAvatarState";

export function NapoleonAvatar({ state }: { state: AvatarState }) {
  const talking = state === "talking" || state === "reacting";
  return (
    <svg viewBox="0 0 200 240" className="h-full w-full" aria-hidden="true">
      {/* Body / coat */}
      <g
        className={
          state === "talking"
            ? "[transform-box:fill-box] [transform-origin:50%_100%] animate-avatar-talk"
            : state === "thinking"
              ? "[transform-box:fill-box] [transform-origin:50%_100%] animate-avatar-think"
              : "[transform-box:fill-box] [transform-origin:50%_100%] animate-avatar-idle"
        }
      >
        {/* shoulders / uniform */}
        <path d="M40 230 C45 175 75 160 100 160 C125 160 155 175 160 230 Z" fill="var(--napoleon-blue)" />
        {/* gold epaulettes */}
        <ellipse cx="55" cy="172" rx="14" ry="6" fill="var(--gold)" />
        <ellipse cx="145" cy="172" rx="14" ry="6" fill="var(--gold)" />
        {/* hand-in-coat */}
        <path d="M90 195 C100 205 120 200 125 185 L120 215 L92 215 Z" fill="oklch(0.95 0.02 80)" opacity="0.95" />
        <path d="M88 195 Q100 215 122 195" stroke="var(--gold)" strokeWidth="2" fill="none" />
        {/* red collar */}
        <path d="M75 165 L100 178 L125 165 L120 175 L100 185 L80 175 Z" fill="var(--napoleon-red)" />

        {/* head */}
        <ellipse cx="100" cy="115" rx="34" ry="40" fill="oklch(0.82 0.05 60)" />
        {/* sideburns */}
        <path d="M68 115 Q66 135 78 145 L82 130 Z" fill="oklch(0.25 0.02 40)" />
        <path d="M132 115 Q134 135 122 145 L118 130 Z" fill="oklch(0.25 0.02 40)" />

        {/* eyes */}
        <ellipse cx="88" cy="115" rx="2.5" ry={state === "listening" ? 3.5 : 2.5} fill="#111" />
        <ellipse cx="112" cy="115" rx="2.5" ry={state === "listening" ? 3.5 : 2.5} fill="#111" />
        {/* brows */}
        <path
          d={state === "listening" ? "M80 104 L96 100 M104 100 L120 104" : "M80 106 L96 104 M104 104 L120 106"}
          stroke="#111"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* mouth */}
        <path
          d={talking ? "M88 135 Q100 148 112 135 Q100 142 88 135 Z" : "M90 136 Q100 140 110 136"}
          fill={talking ? "#3a1010" : "none"}
          stroke="#3a1010"
          strokeWidth="2"
          strokeLinecap="round"
          className={talking ? "animate-mouth-talk" : ""}
        />

        {/* bicorne hat */}
        <path d="M40 85 Q100 50 160 85 Q150 95 100 92 Q50 95 40 85 Z" fill="#0a0a0a" />
        <circle cx="100" cy="80" r="4" fill="var(--napoleon-red)" />
      </g>
    </svg>
  );
}
