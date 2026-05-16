export type AvatarState = "idle" | "talking" | "thinking" | "listening" | "reacting" | "special";

export function AvatarSvg({
  svg,
  className,
}: {
  svg: string;
  state?: AvatarState;
  className?: string;
}) {
  return (
    <div
      className={`svg-avatar${className ? ` ${className}` : ""}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
