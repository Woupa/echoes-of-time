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
      // 3) Générer le portrait de base + 6 réactions en parallèle
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

      // 4) Update record
      const { error: updateErr } = await supabaseAdmin
        .from("characters")
        .update({
          base_avatar_url: baseUrl,
          reactions: reactionsData,
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
