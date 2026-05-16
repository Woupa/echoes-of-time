import type { AvatarState } from "@/hooks/useAvatarState";

export function EinsteinAvatar({ state }: { state: AvatarState }) {
  const talking = state === "talking" || state === "reacting";
  return (
    <svg viewBox="0 0 200 240" className="h-full w-full" aria-hidden="true">
      <g
        className={
          state === "talking"
            ? "[transform-box:fill-box] [transform-origin:50%_100%] animate-avatar-talk"
            : state === "thinking"
              ? "[transform-box:fill-box] [transform-origin:50%_100%] animate-avatar-think"
              : "[transform-box:fill-box] [transform-origin:50%_100%] animate-avatar-idle"
        }
      >
        {/* lab coat */}
        <path d="M40 230 C45 175 75 162 100 162 C125 162 155 175 160 230 Z" fill="var(--einstein-white)" />
        <path d="M100 162 L95 215 L105 215 Z" fill="var(--einstein-gray)" opacity="0.4" />
        {/* eureka finger */}
        {talking && (
          <g className="animate-eureka">
            <rect x="150" y="120" width="10" height="40" rx="4" fill="oklch(0.82 0.05 60)" />
            <circle cx="155" cy="115" r="7" fill="oklch(0.82 0.05 60)" />
          </g>
        )}

        {/* head */}
        <ellipse cx="100" cy="118" rx="34" ry="40" fill="oklch(0.85 0.04 60)" />

        {/* wild hair */}
        <g fill="var(--einstein-white)">
          <ellipse cx="100" cy="78" rx="42" ry="22" />
          <circle cx="65" cy="92" r="14" />
          <circle cx="135" cy="92" r="14" />
          <circle cx="55" cy="78" r="10" />
          <circle cx="145" cy="78" r="10" />
          <circle cx="80" cy="62" r="10" />
          <circle cx="120" cy="62" r="10" />
        </g>

        {/* eyes */}
        <ellipse cx="88" cy="118" rx="2.5" ry="2.5" fill="#111" />
        <ellipse cx="112" cy="118" rx="2.5" ry="2.5" fill="#111" />
        {/* squinty wrinkles */}
        <path d="M78 112 Q88 108 98 112" stroke="#5a4a3a" strokeWidth="1.2" fill="none" />
        <path d="M102 112 Q112 108 122 112" stroke="#5a4a3a" strokeWidth="1.2" fill="none" />

        {/* mustache */}
        <path d="M78 138 Q100 148 122 138 Q110 144 100 142 Q90 144 78 138 Z" fill="var(--einstein-white)" />

        {/* mouth */}
        <path
          d={talking ? "M90 150 Q100 158 110 150 Q100 154 90 150 Z" : "M93 150 Q100 153 107 150"}
          fill={talking ? "#3a1010" : "none"}
          stroke="#3a1010"
          strokeWidth="1.5"
          className={talking ? "animate-mouth-talk" : ""}
        />
      </g>
    </svg>
  );
}
