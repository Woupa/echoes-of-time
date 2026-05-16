import { useEffect, useState } from "react";

export type AvatarState = "idle" | "talking" | "thinking" | "listening" | "reacting" | "special";

export function AvatarSvg({
  svg,
  state,
  className,
}: {
  svg: string;
  state: AvatarState;
  className?: string;
}) {
  // "reacting" is a one-shot; auto-revert after animation
  const [overlay, setOverlay] = useState<"reacting" | "special" | null>(null);
  useEffect(() => {
    if (state === "reacting" || state === "special") {
      setOverlay(state);
      const t = setTimeout(() => setOverlay(null), state === "reacting" ? 700 : 1300);
      return () => clearTimeout(t);
    }
  }, [state]);

  const baseState = state === "reacting" || state === "special" ? "idle" : state;
  const cls = `svg-avatar avatar-${baseState}${overlay ? ` avatar-${overlay}` : ""}${className ? ` ${className}` : ""}`;

  return <div className={cls} dangerouslySetInnerHTML={{ __html: svg }} />;
}
