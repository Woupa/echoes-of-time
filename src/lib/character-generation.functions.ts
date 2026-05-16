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
- basePortraitPrompt (description visuelle EN ANGLAIS. DOIT COMMENCER par "Photorealistic portrait of <FULL NAME>, " puis lister 3-5 traits iconiques NON-NÉGOCIABLES qui rendent la personne immédiatement reconnaissable — coiffure signature, vêtement signature, accessoires signature, âge à l'apogée, contexte historique. Ex pour MJ : "Photorealistic portrait of Michael Jackson in his Bad-era prime, signature single sequined glove, black fedora, curly black hair falling over forehead, pale complexion, red leather jacket". Pour Napoléon : "Photorealistic portrait of Napoleon Bonaparte, bicorne hat worn sideways, dark green colonel uniform of the Chasseurs à cheval, hand tucked in waistcoat, dark hair combed forward")
- reactions : EXACTEMENT 6 réactions les plus pertinentes pour CE personnage spécifiquement (pas génériques). Chaque réaction :
  - label (français court, ex "Eurêka !", "Moonwalk", "Indignation")
  - emoji (1 emoji)
  - animation (UN parmi : ${ANIMATIONS.join(", ")})
  - description (1 phrase courte décrivant l'émotion)
  - visualPrompt (EN ANGLAIS. DOIT AUSSI COMMENCER par "Photorealistic portrait of <FULL NAME>, " et reprendre les MÊMES traits iconiques que basePortraitPrompt, puis ajouter l'expression/posture spécifique à cette émotion)

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

// Gradium French voice catalog (id, name, gender, age, description)
const GRADIUM_FR_VOICES = [
  { id: "b35yykvVppLXyw_l", name: "Elise", gender: "F", age: "Adult", desc: "warm smooth female, friendly conversation, welcoming" },
  { id: "axlOaUiFyOZhy4nv", name: "Leo", gender: "M", age: "Adult", desc: "warm smooth male, friendly conversation, welcoming" },
  { id: "vMYQUSzm6GRkJX6d", name: "Olivier", gender: "M", age: "Adult", desc: "friendly male, warm welcoming tone" },
  { id: "p1fSBpcmVWngBqVd", name: "Manon", gender: "F", age: "Young Adult", desc: "gentle warm calm measured female" },
  { id: "3mM3xaoFjNMQa22C", name: "Jade", gender: "F", age: "Young Adult", desc: "young female, clear high-pitched smooth" },
  { id: "J4XbCGPYNMigXcfZ", name: "Amelie", gender: "F", age: "Young Adult", desc: "friendly clear pleasant young female" },
  { id: "0LMAi0x_YVG_GLeM", name: "Adrien", gender: "M", age: "Young Adult", desc: "clear smooth moderately paced warm young male" },
  { id: "-dOnYAX4N4GqSOee", name: "Sarah", gender: "F", age: "Young Adult", desc: "warm smooth young female, friendly interactions" },
  { id: "N8xxxD_d-ZinGVI4", name: "Jennifer", gender: "F", age: "Young Adult", desc: "warm smooth young female, support welcoming" },
  { id: "zba0owtqy4Gnewn9", name: "Elodie", gender: "F", age: "Adult", desc: "confident female, corporate training, compliance" },
  { id: "TJv-kucMsUo24VQe", name: "Justine", gender: "F", age: "Young Adult", desc: "confident upbeat young female, youth brands" },
  { id: "YE0-JPiElafJrZaC", name: "Oceane", gender: "F", age: "Young Adult", desc: "polished young female, broadcasting, radio" },
  { id: "QY_BJKHMElKDO12-", name: "Lea", gender: "F", age: "Adult", desc: "formal female, financial reports, news, authoritative" },
  { id: "QkmUhBH4hIV2_BkY", name: "Sarah2", gender: "F", age: "Adult", desc: "confident compassionate female, biographies, support" },
  { id: "D-IpHY1UI0iX9xQD", name: "Mathieu", gender: "M", age: "Adult", desc: "assertive energetic male, high-stakes promos" },
  { id: "twLGV8mrH_ycNpUn", name: "Clement", gender: "M", age: "Adult", desc: "confident sincere male, credibility, expert topics" },
  { id: "k1wgs3k8-wRxTJO6", name: "Julie", gender: "F", age: "Adult", desc: "joyful enthusiastic female, news, education" },
  { id: "Hdf5cdfaGrLDTD63", name: "Dylan", gender: "M", age: "Adult", desc: "sincere emotional male, genuine support, relatable" },
  { id: "1VAVLmmbQFDw7TMn", name: "Marion", gender: "F", age: "Adult", desc: "warm trustworthy female, storytelling, education" },
  { id: "2AtP1urAQkZaeI2U", name: "Pauline", gender: "F", age: "Adult", desc: "professional articulate female, serious journalism" },
  { id: "B09t5S64xLaKwXeW", name: "Vincent", gender: "M", age: "Adult", desc: "warm wise male, historical narration, supportive — strong fit for older historical figures" },
  { id: "AroCL6f1qizjiZ_a", name: "Pierre", gender: "M", age: "Young Adult", desc: "energetic young male, lively journalistic flair" },
  { id: "qTA0lxFpynJdoxx7", name: "Guillaume", gender: "M", age: "Young Adult", desc: "joyful adventurous young male, dynamic storytelling" },
  { id: "zpmn3GOfiU_i5QGo", name: "Romain", gender: "M", age: "Adult", desc: "warm steady male, quick instructions, interviews" },
  { id: "IB53xJtufx1sbfbt", name: "Kevin", gender: "M", age: "Adult", desc: "sincere emotional male, depth wisdom, narration" },
  { id: "kw_VWSocR7vyA9Ty", name: "Florian", gender: "M", age: "Adult", desc: "joyful relatable male, friendly journalist" },
  { id: "hx1RAC4Lqd9xyTAr", name: "Antoine", gender: "M", age: "Adult", desc: "gritty confident male, intense narration, experienced" },
  { id: "pdcyd1mLmo0fcg3O", name: "Quentin", gender: "M", age: "Adult", desc: "confident sincere male, tech expert" },
  { id: "aNiSRZ0BhQxO1FPx", name: "Adam", gender: "M", age: "Adult", desc: "warm formal male, calm professional, corporate" },
  { id: "ImBVnxSeLsdCfNIV", name: "Anais", gender: "F", age: "Young Adult", desc: "distinctive sharp young female, lifestyle" },
  { id: "GmGF_3ETsY2Zq7_w", name: "Marine", gender: "F", age: "Adult", desc: "warm nurturing female, storytelling, education, empathetic" },
  { id: "w9V1722uEmTkWqnR", name: "Camille", gender: "F", age: "Adult", desc: "joyful professional female, corporate, journalism" },
  { id: "BbLb4TxdlrldgpHI", name: "Marie", gender: "F", age: "Adult", desc: "warm professional female, calm instruction, empathetic" },
  { id: "8nsAoui8Y5RK9PYw", name: "Thomas", gender: "M", age: "Adult", desc: "confident sincere male, drives action, commercials" },
  { id: "rIYDMY3dLccdauWA", name: "Chloe", gender: "F", age: "Adult", desc: "bright versatile female, friendly assistance, education" },
  { id: "mxcKXLymdLQCdlEq", name: "Nicolas", gender: "M", age: "Adult", desc: "assertive warm male, strength, character, narration" },
  { id: "Jlh1B0PKQJyup0sQ", name: "Laura", gender: "F", age: "Adult", desc: "helpful clear female, educational content" },
  { id: "NvHEAMGiPT4u8iT-", name: "Amandine", gender: "F", age: "Adult", desc: "versatile joyful female, education" },
  { id: "WWHSNJCSTm77dyGd", name: "Valentin", gender: "M", age: "Adult", desc: "warm lively male, spark genuine enthusiasm" },
  { id: "L6OaiBybqikfCBk0", name: "Manu", gender: "M", age: "Young Adult", desc: "pleasant low-pitch smooth young male" },
] as const;

const DEFAULT_GRADIUM_VOICE = "axlOaUiFyOZhy4nv"; // Leo — neutral fallback

// Distinct voices for built-in characters (picked to match each persona)
const BUILTIN_VOICES: Record<string, string> = {
  napoleon: "B09t5S64xLaKwXeW", // Vincent — warm wise male, historical narration, authoritative
  einstein: "IB53xJtufx1sbfbt", // Kevin — sincere emotional male, depth and wisdom
  mjackson: "L6OaiBybqikfCBk0", // Manu — pleasant low-pitch smooth young male
};

// Strip stage-direction brackets like [voix grave], [rires], [pause] before TTS
function stripStageDirections(text: string): string {
  return text.replace(/\[[^\]]{1,40}\]/g, "").replace(/\s{2,}/g, " ").trim();
}

async function resolveVoiceId(characterId: string): Promise<string> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(characterId);
  if (isUuid) {
    const { data: char } = await supabaseAdmin
      .from("characters")
      .select("voice_id")
      .eq("id", characterId)
      .single();
    const stored = (char?.voice_id as string | null) ?? DEFAULT_GRADIUM_VOICE;
    return GRADIUM_FR_VOICES.some((v) => v.id === stored) ? stored : DEFAULT_GRADIUM_VOICE;
  }
  return BUILTIN_VOICES[characterId] ?? DEFAULT_GRADIUM_VOICE;
}

async function gradiumTtsBase64(voiceId: string, rawText: string): Promise<{ audio: string; mime: string } | null> {
  const apiKey = process.env.Gradium;
  if (!apiKey) return null;
  const text = stripStageDirections(rawText);
  if (!text) return null;
  try {
    const res = await fetch("https://api.gradium.ai/api/post/speech/tts", {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        voice_id: voiceId,
        output_format: "wav",
        only_audio: true,
      }),
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return { audio: btoa(binary), mime: "audio/wav" };
  } catch {
    return null;
  }
}

async function pickGradiumVoiceWithGpt(args: {
  name: string;
  era: string;
  userContext: string;
  basePortraitPrompt: string;
}): Promise<string> {
  const apiKey = process.env.ChatGPT;
  if (!apiKey) throw new Error("Clé ChatGPT manquante côté serveur.");

  const system = `Tu es directeur de casting vocal pour un TTS français Gradium. À partir d'un personnage historique, choisis LA voix la plus AUTHENTIQUE possible — genre, âge perçu (jeune adulte vs adulte mature), tempérament, gravité, autorité, contexte d'époque. Vise la ressemblance maximale avec ce qu'aurait été la voix réelle du personnage. Réponds STRICTEMENT en JSON : {"voice_id": "<id>"}.`;
  const user = `Personnage : ${args.name}
Époque : ${args.era}
Contexte : ${args.userContext}
Description visuelle : ${args.basePortraitPrompt}

Voix françaises disponibles (id | nom | genre | âge | description) :
${GRADIUM_FR_VOICES.map((v) => `- ${v.id} | ${v.name} | ${v.gender} | ${v.age} | ${v.desc}`).join("\n")}

Critères :
1. Genre du personnage en priorité absolue.
2. Âge perçu cohérent (jeune vs adulte mature/âgé).
3. Tempérament (autorité, douceur, énergie, gravité) cohérent avec le rôle historique.
4. Pour figures historiques masculines d'autorité (chefs militaires, monarques, savants âgés), privilégier voix mâles graves/sages (ex. Vincent, Nicolas, Antoine, Adam, Mathieu).`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI voix ${res.status}: ${txt.slice(0, 200)}`);
  }
  const j = await res.json();
  const parsed = JSON.parse(j.choices?.[0]?.message?.content ?? "{}") as { voice_id?: string };
  const valid = GRADIUM_FR_VOICES.some((v) => v.id === parsed.voice_id);
  return valid ? (parsed.voice_id as string) : DEFAULT_GRADIUM_VOICE;
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

  const res = await fetch("https://fal.run/fal-ai/flux-pro/v1.1", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify({
      prompt,
      image_size: "square_hd",
      num_images: 1,
      safety_tolerance: "6",
      output_format: "jpeg",
      enable_safety_checker: false,
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
      // 3) Choix de la voix Gradium FR en parallèle des images (ChatGPT casting)
      const voicesPromise = pickGradiumVoiceWithGpt({
        name,
        era,
        userContext,
        basePortraitPrompt: plan.basePortraitPrompt,
      }).catch((err: unknown) => {
        console.error("Voice pick failed:", err);
        return null;
      });

      // 4) Générer le portrait de base + 6 réactions en parallèle.
      // On force le nom en tête au cas où GPT l'aurait omis du prompt visuel.
      const cinematicSuffix =
        ", sepia cinematic tone, soft warm lighting, shallow depth of field, portrait centered on face and shoulders, hyper detailed photorealistic, film grain, unmistakably recognizable likeness";
      const ensureName = (p: string) => {
        const lower = p.toLowerCase();
        return lower.includes(data.name.toLowerCase())
          ? p
          : `Photorealistic portrait of ${data.name}, ${p}`;
      };

      const tasks = [
        { key: "base", prompt: ensureName(plan.basePortraitPrompt) + cinematicSuffix },
        ...plan.reactions.map((r, i) => ({
          key: `reaction-${i}`,
          prompt: ensureName(r.visualPrompt) + cinematicSuffix,
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
  characterId: z.string().min(1).max(120),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(40),
  withAudio: z.boolean().optional(),
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BUILT_IN_CHAT_CHARACTERS: Record<string, { name: string; system_prompt: string; reactions: ReactionData[] }> = {
  napoleon: {
    name: "Napoléon Bonaparte",
    system_prompt:
      "Tu es Napoléon Bonaparte. Réponds avec assurance impériale, références aux campagnes militaires, au Code civil, à Joséphine. Ton martial, parfois sentencieux.",
    reactions: [],
  },
  einstein: {
    name: "Albert Einstein",
    system_prompt:
      "Tu es Albert Einstein. Pédagogue, humble, joueur. Tu expliques la physique avec des métaphores simples. Quelques mots d'allemand à l'occasion.",
    reactions: [],
  },
  mjackson: {
    name: "Michael Jackson",
    system_prompt:
      "Tu es Michael Jackson. Doux, passionné par la musique, la danse, les enfants. Mélange anglais et français, ton chaleureux et timide.",
    reactions: [],
  },
};

export const chatWithCharacter = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ChatInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.PIONEER_API_KEY;
    if (!apiKey && !process.env.ChatGPT) {
      throw new Error("Aucun LLM configuré côté serveur (PIONEER_API_KEY ni ChatGPT).");
    }

    let char = BUILT_IN_CHAT_CHARACTERS[data.characterId];
    if (!char && UUID_RE.test(data.characterId)) {
      const { data: row, error } = await supabaseAdmin
        .from("characters")
        .select("name, system_prompt, reactions")
        .eq("id", data.characterId)
        .single();
      if (error || !row) throw new Error(`Personnage introuvable : ${error?.message}`);
      char = {
        name: row.name,
        system_prompt: row.system_prompt,
        reactions: (row.reactions as ReactionData[]) ?? [],
      };
    }
    if (!char) throw new Error("Personnage introuvable.");

    const reactions = (char.reactions as ReactionData[]) ?? [];
    const reactionList = reactions
      .map((r, i) => `${i}: ${r.label} (${r.description})`)
      .join("\n");

    const maxIdx = Math.max(0, reactions.length - 1);
    const reactionInstruction = reactions.length > 0
      ? `Tu dois aussi CHOISIR la réaction la plus adaptée à TA réponse parmi celles-ci (par index) :
${reactionList}

Réponds STRICTEMENT en JSON valide, sans markdown, sans texte autour, au format exact :
{"reply": "<ta réplique>", "reactionIdx": <numéro 0-${maxIdx}>}`
      : `Réponds STRICTEMENT en JSON valide, sans markdown, sans texte autour, au format exact :
{"reply": "<ta réplique>", "reactionIdx": 0}`;

    const system = `${char.system_prompt}

Tu es ${char.name}. Réponds toujours en français, dans ton style propre, en 1 à 3 phrases vivantes.

${reactionInstruction}`;

    // Try Pioneer first, fall back to OpenAI (ChatGPT) if it fails
    const messagesForLlm = [
      { role: "system", content: system },
      ...data.messages,
    ];

    let content: string | undefined;
    let pioneerError: string | null = null;
    try {
      if (!apiKey) throw new Error("Pioneer non configuré");
      const res = await fetch("https://api.pioneer.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "3143d855-95b1-4da7-afad-d579fcd3d5ed",
          messages: messagesForLlm,
          stream: false,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Pioneer ${res.status}: ${txt.slice(0, 300)}`);
      }
      const json = await res.json();
      content = json.choices?.[0]?.message?.content;
      if (!content) throw new Error("Réponse Pioneer vide.");
    } catch (err) {
      pioneerError = err instanceof Error ? err.message : "Pioneer indisponible";
      console.warn("[chat] Pioneer failed, falling back to ChatGPT:", pioneerError);
      const openaiKey = process.env.ChatGPT;
      if (!openaiKey) {
        throw new Error(`Pioneer indisponible et fallback ChatGPT non configuré : ${pioneerError}`);
      }
      const res2 = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: messagesForLlm,
          response_format: { type: "json_object" },
          temperature: 0.8,
        }),
      });
      if (!res2.ok) {
        const txt = await res2.text();
        throw new Error(`Pioneer KO (${pioneerError}) + ChatGPT ${res2.status}: ${txt.slice(0, 200)}`);
      }
      const json2 = await res2.json();
      content = json2.choices?.[0]?.message?.content;
      if (!content) throw new Error(`Pioneer KO (${pioneerError}) + ChatGPT réponse vide.`);
    }

    // Extract JSON object even if model wraps it in prose / markdown
    let parsed: { reply?: string; reactionIdx?: number } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch { /* ignore */ }
      }
    }
    const reply = typeof parsed.reply === "string" && parsed.reply.trim().length > 0
      ? parsed.reply
      : content.trim();
    const idx = Number.isInteger(parsed.reactionIdx)
      ? Math.max(0, Math.min(maxIdx, parsed.reactionIdx as number))
      : 0;
    return { reply, reactionIdx: idx };
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
  characterId: z.string().min(1).max(128),
  text: z.string().min(1).max(2000),
});

export const synthesizeSpeech = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SpeakInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.Gradium;
    if (!apiKey) throw new Error("Clé Gradium manquante côté serveur.");

    // Built-in voice presets for non-UUID character ids
    const BUILTIN_VOICES: Record<string, string> = {
      napoleon: DEFAULT_GRADIUM_VOICE,
      einstein: DEFAULT_GRADIUM_VOICE,
      mjackson: DEFAULT_GRADIUM_VOICE,
    };

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.characterId);
    let voiceId = BUILTIN_VOICES[data.characterId] ?? DEFAULT_GRADIUM_VOICE;
    if (isUuid) {
      const { data: char } = await supabaseAdmin
        .from("characters")
        .select("voice_id")
        .eq("id", data.characterId)
        .single();
      const stored = (char?.voice_id as string | null) ?? DEFAULT_GRADIUM_VOICE;
      voiceId = GRADIUM_FR_VOICES.some((v) => v.id === stored) ? stored : DEFAULT_GRADIUM_VOICE;
    }

    const res = await fetch("https://api.gradium.ai/api/post/speech/tts", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: data.text,
        voice_id: voiceId,
        output_format: "wav",
        only_audio: true,
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Gradium TTS ${res.status}: ${txt.slice(0, 200)}`);
    }
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const base64 = btoa(binary);
    return { audio: base64, mime: "audio/wav" };
  });

const TranscribeInput = z.object({
  audioBase64: z.string().min(10).max(15_000_000),
  mime: z.string().min(3).max(60).default("audio/wav"),
});

export const transcribeAudio = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TranscribeInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.Gradium;
    if (!apiKey) throw new Error("Clé Gradium manquante côté serveur.");

    const cleanMime = data.mime.split(";")[0].trim().toLowerCase();
    const inputFormatByMime: Record<string, string> = {
      "audio/wav": "wav",
      "audio/wave": "wav",
      "audio/x-wav": "wav",
      "audio/ogg": "opus",
      "audio/opus": "opus",
      "audio/pcm": "pcm",
    };
    const inputFormat = inputFormatByMime[cleanMime];
    if (!inputFormat) {
      throw new Error(`Format audio non supporté par Gradium STT: ${cleanMime}. Utilisez WAV/PCM ou Ogg Opus.`);
    }

    // base64 -> bytes
    const binary = atob(data.audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const cfg = encodeURIComponent(JSON.stringify({ language: "fr", input_format: inputFormat }));
    const res = await fetch(
      `https://api.gradium.ai/api/post/speech/asr?json_config=${cfg}&input_format=${inputFormat}`,
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": cleanMime === "audio/wave" || cleanMime === "audio/x-wav" ? "audio/wav" : cleanMime,
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
