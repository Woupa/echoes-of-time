import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Lang = "fr" | "en";

type Dict = Record<string, { fr: string; en: string }>;

const DICT: Dict = {
  // Header / chat
  voice_on: { fr: "Couper la voix", en: "Mute voice" },
  voice_off: { fr: "Réactiver la voix", en: "Unmute voice" },
  voice_muted: { fr: "Voix coupée", en: "Voice muted" },
  speaking: { fr: "Parle…", en: "Speaking…" },
  online: { fr: "En ligne · Pionnier", en: "Online · Pioneer" },
  share: { fr: "Partager", en: "Share" },
  copied: { fr: "Copié", en: "Copied" },
  home: { fr: "Accueil", en: "Home" },
  history: { fr: "Historique", en: "History" },
  share_link: { fr: "Lien de partage", en: "Share link" },
  share_hint: {
    fr: "Toute personne avec ce lien pourra lire la conversation.",
    en: "Anyone with this link can read the conversation.",
  },
  share_copy: { fr: "Copier", en: "Copy" },
  close: { fr: "Fermer", en: "Close" },

  // Actions
  voice_mode: { fr: "Vocal", en: "Voice" },
  text_mode: { fr: "Clavier", en: "Keyboard" },
  stop: { fr: "Stop", en: "Stop" },
  transcribing: { fr: "Transcrit…", en: "Transcribing…" },
  speak: { fr: "Parler", en: "Speak" },
  scene: { fr: "Scène", en: "Scene" },
  scene_prompt: {
    fr: "Imagine une scène : que feriez-vous aujourd'hui ?",
    en: "Imagine a scene: what would you do today?",
  },
  save: { fr: "Mémoriser", en: "Save" },
  thread: { fr: "Fil", en: "Thread" },
  hangup: { fr: "Raccrocher", en: "Hang up" },
  retry: { fr: "Réessayer", en: "Retry" },
  retry_loading: { fr: "Nouvelle tentative…", en: "Retrying…" },
  write_to: { fr: "Écrivez à", en: "Write to" },
  you_said: { fr: "Vous avez dit", en: "You said" },
  you: { fr: "Vous", en: "You" },
  conversation: { fr: "Conversation", en: "Conversation" },
  with: { fr: "avec", en: "with" },
  loading: { fr: "Chargement…", en: "Loading…" },

  // Select
  contacts_subtitle: { fr: "Contacts historiques", en: "Historical contacts" },
  contacts_title: {
    fr: "Qui voulez-vous appeler ?",
    en: "Who do you want to call?",
  },
  account: { fr: "Compte", en: "Account" },
  search_placeholder: {
    fr: "Rechercher un personnage…",
    en: "Search a character…",
  },
  create_character: { fr: "Créer un personnage", en: "Create a character" },
  create_character_sub: {
    fr: "L'IA génère personnalité, voix et 6 réactions",
    en: "AI generates personality, voice and 6 reactions",
  },
  delete: { fr: "Supprimer", en: "Delete" },
  confirm: { fr: "Confirmer", en: "Confirm" },
  cancel: { fr: "Annuler", en: "Cancel" },
  contacts_loading: { fr: "Chargement des contacts…", en: "Loading contacts…" },
  footer_select: {
    fr: "Propulsé par Sonnet · Sélectionnez un contact pour lancer l'appel",
    en: "Powered by Sonnet · Pick a contact to start the call",
  },

  // Language switch
  lang_label: { fr: "Langue", en: "Language" },
};

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof typeof DICT) => string;
};

const LangCtx = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("app_lang");
      if (stored === "fr" || stored === "en") setLangState(stored);
    } catch { /* ignore */ }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { window.localStorage.setItem("app_lang", l); } catch { /* ignore */ }
  }, []);

  const t = useCallback((key: keyof typeof DICT) => DICT[key]?.[lang] ?? String(key), [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

export function useT() {
  const ctx = useContext(LangCtx);
  if (!ctx) throw new Error("useT must be used inside LanguageProvider");
  return ctx;
}

export function LangToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useT();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === "fr" ? "en" : "fr")}
      className={`flex items-center gap-1 rounded-full border border-border bg-card/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest backdrop-blur hover:bg-accent ${className}`}
      aria-label="Toggle language"
      title={lang === "fr" ? "Switch to English" : "Passer en français"}
    >
      <span className={lang === "fr" ? "text-gold" : "text-muted-foreground"}>FR</span>
      <span className="text-muted-foreground/60">/</span>
      <span className={lang === "en" ? "text-gold" : "text-muted-foreground"}>EN</span>
    </button>
  );
}
