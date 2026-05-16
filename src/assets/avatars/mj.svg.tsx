import type { AvatarState } from "@/hooks/useAvatarState";

export function MJAvatar({ state }: { state: AvatarState }) {
  const talking = state === "talking" || state === "reacting";
  const sparkles = Array.from({ length: 10 });
  return (
    <svg viewBox="0 0 200 240" className="h-full w-full" aria-hidden="true">
      <g
        className={
          state === "talking"
            ? "[transform-box:fill-box] [transform-origin:50%_100%] animate-avatar-talk"
            : state === "idle"
              ? "[transform-box:fill-box] [transform-origin:50%_100%] animate-moonwalk"
              : "[transform-box:fill-box] [transform-origin:50%_100%] animate-avatar-idle"
        }
      >
        {/* military jacket */}
        <path d="M42 230 C48 178 75 162 100 162 C125 162 152 178 158 230 Z" fill="var(--mj-black)" />
        {/* silver epaulettes */}
        <ellipse cx="58" cy="174" rx="14" ry="6" fill="var(--mj-silver)" />
        <ellipse cx="142" cy="174" rx="14" ry="6" fill="var(--mj-silver)" />
        {/* buttons */}
        <circle cx="100" cy="185" r="3" fill="var(--mj-silver)" />
        <circle cx="100" cy="200" r="3" fill="var(--mj-silver)" />
        <circle cx="100" cy="215" r="3" fill="var(--mj-silver)" />

        {/* white glove + mic when talking */}
        {talking && (
          <g>
            <circle cx="148" cy="150" r="10" fill="var(--mj-white)" />
            <rect x="144" y="125" width="8" height="22" rx="3" fill="var(--mj-silver)" />
            <circle cx="148" cy="120" r="7" fill="#2a2a2a" />
          </g>
        )}

        {/* head */}
        <ellipse cx="100" cy="118" rx="32" ry="38" fill="oklch(0.55 0.05 50)" />

        {/* curly hair */}
        <g fill="oklch(0.15 0.01 40)">
          <circle cx="100" cy="82" r="28" />
          <circle cx="75" cy="92" r="14" />
          <circle cx="125" cy="92" r="14" />
          <circle cx="100" cy="70" r="14" />
        </g>

        {/* sunglasses on forehead */}
        <g>
          <rect x="72" y="92" width="56" height="2" fill="var(--mj-silver)" />
          <ellipse cx="84" cy="96" rx="9" ry="5" fill="#0a0a0a" />
          <ellipse cx="116" cy="96" rx="9" ry="5" fill="#0a0a0a" />
        </g>

        {/* eyes */}
        <ellipse cx="90" cy="120" rx="2.5" ry="2.5" fill="#111" />
        <ellipse cx="110" cy="120" rx="2.5" ry="2.5" fill="#111" />

        {/* mouth */}
        <path
          d={talking ? "M88 140 Q100 152 112 140 Q100 146 88 140 Z" : "M92 140 Q100 144 108 140"}
          fill={talking ? "#3a1010" : "none"}
          stroke="#3a1010"
          strokeWidth="1.6"
          className={talking ? "animate-mouth-talk" : ""}
        />
      </g>

      {/* sparkles */}
      {sparkles.map((_, i) => {
        const x = 20 + ((i * 37) % 160);
        const y = 30 + ((i * 53) % 180);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="1.6"
            fill="var(--mj-silver)"
            className="animate-pulse"
            style={{ animationDelay: `${(i * 0.23) % 2}s` }}
          />
        );
      })}
    </svg>
  );
}
