import { useEffect, useState } from "react";

export type AvatarState = "idle" | "talking" | "thinking" | "listening" | "reacting";

export function useAvatarState(opts: {
  isStreaming?: boolean;
  isLoading?: boolean;
  userIsSpeaking?: boolean;
  lastAssistantText?: string;
}): AvatarState {
  const { isStreaming, isLoading, userIsSpeaking, lastAssistantText } = opts;
  const [reacting, setReacting] = useState(false);

  useEffect(() => {
    if (!lastAssistantText) return;
    if (/[!?]/.test(lastAssistantText.slice(-3))) {
      setReacting(true);
      const t = setTimeout(() => setReacting(false), 700);
      return () => clearTimeout(t);
    }
  }, [lastAssistantText]);

  if (reacting) return "reacting";
  if (isStreaming) return "talking";
  if (isLoading) return "thinking";
  if (userIsSpeaking) return "listening";
  return "idle";
}
