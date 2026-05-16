import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ANIMATIONS = ["pulse", "shake", "bounce", "breathe", "tilt", "glow", "shimmer"] as const;
type Animation = (typeof ANIMATIONS)[number];

export type ReactionData = {
  label: string;
  emoji: string;
  animation: Animation;
  description: string;
  imageUrl: string;
};

const InputSchema = z.object({
  name: z.string().min(1).max(80),
  era: z.string().min(1).max(80),
  userContext: z.string().min(10).max(2000),
});

type GptPlan = {
  title: string;
  accent: string;
  greeting: string;
  systemPrompt: string;
  basePortraitPrompt: string;
  reactions: {
    label: string;
    emoji: string;
    animation: Animation;
    description: string;
    visualPrompt: string;
  }[];
};

async function callChatGpt(name: string, era: string, userContext: string): Promise<GptPlan> {
  const apiKey = process.env.ChatGPT;
  if (!apiKey) throw new Error("Clé ChatGPT manquante côté serveur.");

  const system = `Tu es un directeur artistique. À partir d'une figure historique ou fictive, tu produis UN JSON STRICT (aucun markdown) avec :
- title (court titre/fonction)
- accent (couleur hex caractéristique du personnage, ex #c9a84c)
- greeting (1 phrase d'accueil en français, dans son ton)
- systemPrompt (instructions de roleplay détaillées en français : style de parole, références personnelles, tics, valeurs, vocabulaire d'époque)
- basePortraitPrompt (description visuelle EN ANGLAIS pour génération d'image : âge, traits, vêtements, époque, éclairage cinématique sépia, portrait épaules visage centré)
- reactions : EXACTEMENT 6 réactions les plus pertinentes pour CE personnage spécifiquement (pas génériques). Chaque réaction :
  - label (français court, ex "Eurêka !", "Moonwalk", "Indignation")
  - emoji (1 emoji)
  - animation (UN parmi : ${ANIMATIONS.join(", ")})
  - description (1 phrase courte décrivant l'émotion)
  - visualPrompt (EN ANGLAIS, description du portrait montrant cette émotion précise : expression faciale, posture, garde le même style cinématique sépia que basePortraitPrompt)

Choisis les 6 réactions qui révèlent VRAIMENT ce personnage (ex pour Einstein : Eurêka, Pensif, Espiègle, Indigné par la guerre, Émerveillé, Mélancolique ; pour MJ : Moonwalk, Cri aigu, Timide, Dansant, Touché, Concentré sur scène).`;

  const user = `Personnage : ${name}\nÉpoque : ${era}\nContexte fourni par l'utilisateur :\n${userContext}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Réponse ChatGPT vide.");
  const parsed = JSON.parse(content) as GptPlan;

  // Sanitize
  parsed.reactions = (parsed.reactions || []).slice(0, 6).map((r) => ({
    ...r,
    animation: (ANIMATIONS as readonly string[]).includes(r.animation)
      ? r.animation
      : "breathe",
  }));
  if (parsed.reactions.length < 6) throw new Error("ChatGPT n'a pas renvoyé 6 réactions.");
  return parsed;
}

// SLNG Rime Arcana v2 French speakers (catalogue SLNG-hosted)
const SLNG_FR_SPEAKERS = [
  { id: "destin", description: "voix masculine grave, posée, autoritaire — figure d'autorité, leader, homme mûr" },
  { id: "serrin_joseph", description: "voix masculine chaleureuse, narrative, intellectuelle — savant, écrivain, mentor" },
  { id: "solstice", description: "voix féminine claire, lumineuse, élégante — figure inspirante, artiste, jeune femme" },
  { id: "livet_aurelie", description: "voix féminine douce, expressive, sensible — confidente, poétesse, héroïne romantique" },
  { id: "morel_marianne", description: "voix féminine mature, posée, sage — matriarche, conseillère, femme d'expérience" },
] as const;

async function pickSlngSpeakerWithGpt(args: {
  name: string;
  era: string;
  userContext: string;
  basePortraitPrompt: string;
}): Promise<string> {
  const apiKey = process.env.ChatGPT;
  if (!apiKey) throw new Error("Clé ChatGPT manquante côté serveur.");

  const system = `Tu es directeur de casting vocal pour un TTS français (Rime Arcana via SLNG). À partir d'un personnage, choisis LA voix la plus adaptée (genre, âge, tempérament, époque). Réponds STRICTEMENT en JSON : {"speaker": "<id>"}.`;
  const user = `Personnage : ${args.name}
Époque : ${args.era}
Contexte : ${args.userContext}
Description visuelle : ${args.basePortraitPrompt}

Voix disponibles :
${SLNG_FR_SPEAKERS.map((v) => `- ${v.id} : ${v.description}`).join("\n")}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI voix ${res.status}: ${txt.slice(0, 200)}`);
  }
  const j = await res.json();
  const parsed = JSON.parse(j.choices?.[0]?.message?.content ?? "{}") as { speaker?: string };
  const valid = SLNG_FR_SPEAKERS.some((v) => v.id === parsed.speaker);
  return valid ? (parsed.speaker as string) : "serrin_joseph";
}

async function generateSvgAvatar(args: {
  name: string;
  era: string;
  userContext: string;
  basePortraitPrompt: string;
  accent: string;
}): Promise<string> {
  const apiKey = process.env.ChatGPT;
  if (!apiKey) throw new Error("Clé ChatGPT manquante côté serveur.");

  const system = `Tu es un illustrateur SVG cartoon 2D flat (style Duolingo / Bitmoji). Tu produis UNIQUEMENT un SVG brut (commence par <svg ... et finit par </svg>), aucun texte, aucun markdown, aucune balise <html>.

Spec OBLIGATOIRE :
- viewBox="0 0 400 400", width="100%", height="100%"
- xmlns="http://www.w3.org/2000/svg"
- Style 2D flat, formes géométriques simplifiées, AUCUNE ombre portée, AUCUN dégradé, AUCUN contour stroke (les formes se définissent par contraste de couleur)
- Fond uni rectangulaire avec couleur cohérente à l'univers du personnage
- Entre 25 et 60 paths/shapes maximum
- AU MOINS 2 éléments iconiques non-négociables (signatures visuelles qui rendent le personnage reconnaissable en moins de 2s, même en vignette 60×60)
- Groupes nommés avec id="" pour permettre l'animation :
  * id="hair", id="head", id="face", id="eyes", id="eye-left", id="eye-right", id="eyebrows", id="mouth", id="body", id="accessory-1", id="accessory-2"
- Bouche : représentée par UN path avec id="mouth" et class="mouth-closed" (forme fermée par défaut). Génère AUSSI dans <defs> ou en commentaire une variante non utilisée pour l'ouverture — non, plus simple : juste id="mouth" avec un path simple, l'animation CSS suffira.
- L'avatar est centré, plan poitrine/épaules visage, occupant ~70% de la hauteur.
- Couleur accent dominante du personnage : ${args.accent}.

Suis rigoureusement ce briefing en interne (visage, yeux, bouche, cheveux, éléments iconiques, corps, accessoires) puis produis le SVG final. Aucune balise <script>. Aucun <foreignObject>. Aucun <image> externe.`;

  const user = `Personnage : ${args.name}
Époque : ${args.era}
Contexte : ${args.userContext}
Description visuelle de référence : ${args.basePortraitPrompt}

Identifie 2 à 3 éléments iconiques non-négociables propres à ce personnage (ex : bicorne + main dans la veste pour Napoléon ; cheveux blancs ébouriffés + moustache pour Einstein ; gant blanc à paillettes + chapeau noir pour MJ) et intègre-les visiblement.

Retourne UNIQUEMENT le SVG.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI SVG ${res.status}: ${txt.slice(0, 200)}`);
  }
  const j = await res.json();
  let svg: string = j.choices?.[0]?.message?.content ?? "";
  // Strip markdown code fences if present
  svg = svg.replace(/^```(?:svg|xml)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = svg.indexOf("<svg");
  const end = svg.lastIndexOf("</svg>");
  if (start === -1 || end === -1) throw new Error("SVG invalide retourné par ChatGPT.");
  return svg.slice(start, end + 6);
}

async function generateFalImage(prompt: string): Promise<ArrayBuffer> {
  const apiKey = process.env.Fal;
  if (!apiKey) throw new Error("Clé Fal manquante côté serveur.");

  const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify({
      prompt,
      image_size: "square_hd",
      num_inference_steps: 4,
      num_images: 1,
      enable_safety_checker: true,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Fal ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  const imageUrl = data.images?.[0]?.url;
  if (!imageUrl) throw new Error("Fal n'a pas renvoyé d'image.");

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Téléchargement image Fal échoué (${imgRes.status})`);
  return imgRes.arrayBuffer();
}

async function uploadSprite(
  characterId: string,
  filename: string,
  bytes: ArrayBuffer,
): Promise<string> {
  const path = `${characterId}/${filename}`;
  const { error } = await supabaseAdmin.storage
    .from("character-sprites")
    .upload(path, bytes, {
      contentType: "image/jpeg",
      upsert: true,
    });
  if (error) throw new Error(`Upload storage : ${error.message}`);
  const { data } = supabaseAdmin.storage.from("character-sprites").getPublicUrl(path);
  return data.publicUrl;
}

export const generateCharacter = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const { name, era, userContext } = data;

    // 1) ChatGPT : enrichir + 6 réactions
    const plan = await callChatGpt(name, era, userContext);

    // 2) Pré-créer l'ID pour structurer le storage
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("characters")
      .insert({
        name,
        era,
        user_context: userContext,
        title: plan.title || "",
        accent: plan.accent || "#d4af6e",
        greeting: plan.greeting || "",
        system_prompt: plan.systemPrompt || "",
        base_avatar_url: "",
        reactions: [],
      })
      .select("id")
      .single();
    if (insertErr || !inserted) throw new Error(`DB insert : ${insertErr?.message ?? "inconnu"}`);
    const characterId = inserted.id as string;

    try {
      // 3) Choix de la voix SLNG (Rime Arcana FR) en parallèle des images
      const voicesPromise = pickSlngSpeakerWithGpt({
        name,
        era,
        userContext,
        basePortraitPrompt: plan.basePortraitPrompt,
      }).catch((err: unknown) => {
        console.error("Voice pick failed:", err);
        return null;
      });

      // 4) Générer le portrait de base + 6 réactions en parallèle
      const cinematicSuffix =
        ", sepia cinematic tone, soft warm lighting, shallow depth of field, portrait centered on face and shoulders, photorealistic, film grain";

      const tasks = [
        { key: "base", prompt: plan.basePortraitPrompt + cinematicSuffix },
        ...plan.reactions.map((r, i) => ({
          key: `reaction-${i}`,
          prompt: r.visualPrompt + cinematicSuffix,
        })),
      ];

      const buffers = await Promise.all(tasks.map((t) => generateFalImage(t.prompt)));
      const urls = await Promise.all(
        tasks.map((t, i) => uploadSprite(characterId, `${t.key}.jpg`, buffers[i])),
      );

      const baseUrl = urls[0];
      const reactionUrls = urls.slice(1);

      const reactionsData: ReactionData[] = plan.reactions.map((r, i) => ({
        label: r.label,
        emoji: r.emoji,
        animation: r.animation,
        description: r.description,
        imageUrl: reactionUrls[i],
      }));

      // 3bis) SVG avatar animé en parallèle
      const svgPromise = generateSvgAvatar({
        name,
        era,
        userContext,
        basePortraitPrompt: plan.basePortraitPrompt,
        accent: plan.accent || "#d4af6e",
      }).catch((err: unknown) => {
        console.error("SVG avatar failed:", err);
        return null;
      });

      const voiceId = await voicesPromise;
      const svgAvatar = await svgPromise;

      // 5) Update record
      const { error: updateErr } = await supabaseAdmin
        .from("characters")
        .update({
          base_avatar_url: baseUrl,
          reactions: reactionsData,
          voice_id: voiceId,
          svg_avatar: svgAvatar,
        })
        .eq("id", characterId);
      if (updateErr) throw new Error(`DB update : ${updateErr.message}`);

      return { id: characterId };
    } catch (err) {
      // Rollback : supprimer le perso si la génération échoue
      await supabaseAdmin.from("characters").delete().eq("id", characterId);
      throw err;
    }
  });

const ListInput = z.object({}).optional();

export const listCustomCharacters = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => ListInput.parse(input))
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("characters")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const ChatInput = z.object({
  characterId: z.string().uuid(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(40),
});

export const chatWithCharacter = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ChatInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.ChatGPT;
    if (!apiKey) throw new Error("Clé ChatGPT manquante côté serveur.");

    const { data: char, error } = await supabaseAdmin
      .from("characters")
      .select("name, system_prompt, reactions")
      .eq("id", data.characterId)
      .single();
    if (error || !char) throw new Error(`Personnage introuvable : ${error?.message}`);

    const reactions = (char.reactions as ReactionData[]) ?? [];
    const reactionList = reactions
      .map((r, i) => `${i}: ${r.label} (${r.description})`)
      .join("\n");

    const system = `${char.system_prompt}

Tu es ${char.name}. Réponds toujours en français, dans ton style propre, en 1 à 3 phrases vivantes.

Tu dois aussi CHOISIR la réaction la plus adaptée à TA réponse parmi celles-ci (par index) :
${reactionList}

Réponds STRICTEMENT en JSON (aucun markdown) au format :
{"reply": "<ta réplique>", "reactionIdx": <numéro 0-${Math.max(0, reactions.length - 1)}>}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          ...data.messages,
        ],
        response_format: { type: "json_object" },
        temperature: 0.9,
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`OpenAI ${res.status}: ${txt.slice(0, 300)}`);
    }
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("Réponse ChatGPT vide.");
    const parsed = JSON.parse(content) as { reply: string; reactionIdx: number };
    const idx = Number.isInteger(parsed.reactionIdx)
      ? Math.max(0, Math.min(reactions.length - 1, parsed.reactionIdx))
      : 0;
    return { reply: String(parsed.reply ?? ""), reactionIdx: idx };
  });

export const deleteCustomCharacter = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    // Best-effort cleanup of sprite storage
    const { data: files } = await supabaseAdmin.storage
      .from("character-sprites")
      .list(data.id);
    if (files && files.length > 0) {
      await supabaseAdmin.storage
        .from("character-sprites")
        .remove(files.map((f) => `${data.id}/${f.name}`));
    }
    const { error } = await supabaseAdmin.from("characters").delete().eq("id", data.id);
    if (error) throw new Error(`DB delete : ${error.message}`);
    return { ok: true };
  });

export const getCustomCharacter = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("characters")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const SpeakInput = z.object({
  characterId: z.string().uuid(),
  text: z.string().min(1).max(2000),
});

export const synthesizeSpeech = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SpeakInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.SLNG;
    if (!apiKey) throw new Error("Clé SLNG manquante côté serveur.");

    const { data: char, error } = await supabaseAdmin
      .from("characters")
      .select("voice_id")
      .eq("id", data.characterId)
      .single();
    if (error || !char) throw new Error(`Personnage introuvable : ${error?.message}`);
    const stored = (char.voice_id as string | null) ?? "serrin_joseph";
    const speaker = SLNG_FR_SPEAKERS.some((v) => v.id === stored) ? stored : "serrin_joseph";

    const res = await fetch("https://api.slng.ai/v1/tts/slng/rime/arcana:fr", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: data.text,
        speaker,
        config: { encoding: "mp3", sample_rate: 24000 },
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`SLNG TTS ${res.status}: ${txt.slice(0, 200)}`);
    }
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const base64 = btoa(binary);
    return { audio: base64, mime: "audio/mpeg" };
  });

const TranscribeInput = z.object({
  audioBase64: z.string().min(10).max(15_000_000),
  mime: z.string().min(3).max(60).default("audio/webm"),
});

export const transcribeAudio = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TranscribeInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.Gradium;
    if (!apiKey) throw new Error("Clé Gradium manquante côté serveur.");

    // base64 -> bytes
    const binary = atob(data.audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const cfg = encodeURIComponent(JSON.stringify({ language: "fr" }));
    const res = await fetch(
      `https://api.gradium.ai/api/post/speech/asr?json_config=${cfg}`,
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": data.mime,
        },
        body: bytes,
      },
    );
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Gradium STT ${res.status}: ${txt.slice(0, 300)}`);
    }

    // NDJSON streamed body — accumulate text chunks
    const raw = await res.text();
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    let transcript = "";
    for (const line of lines) {
      try {
        const msg = JSON.parse(line) as { type?: string; text?: string };
        if ((msg.type === "text" || msg.type === "end_text") && typeof msg.text === "string") {
          transcript += (transcript && !transcript.endsWith(" ") ? " " : "") + msg.text;
        }
      } catch {
        // ignore malformed line
      }
    }
    return { text: transcript.trim() };
  });
