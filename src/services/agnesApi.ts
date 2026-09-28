import { SceneShot, ShotType, CameraMotion, VideoSuggestion } from '../types/index';

export interface ScriptGenerationParams {
  synopsis: string;
  genre: string;
  shotCount: number;
  aspectRatio: '16:9' | '9:16' | '1:1';
}

function getAuthHeaders(userKey?: string): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const key = userKey || localStorage.getItem('agnes_api_key') || '';
  if (key) {
    headers['x-agnes-key'] = key;
    headers['Authorization'] = `Bearer ${key}`;
  }
  return headers;
}

/**
 * Resilient JSON parser that gracefully handles HTML, Cloudflare, rate limits, and network proxy responses
 */
async function parseSafeJson(response: Response, endpointName: string = 'Agnes API'): Promise<any> {
  const rawText = await response.text();
  let parsed: any = null;

  try {
    parsed = JSON.parse(rawText);
  } catch (_e) {
    const is429 =
      response.status === 429 ||
      rawText.includes('429') ||
      rawText.toLowerCase().includes('rate limit') ||
      rawText.toLowerCase().includes('too many requests');
    const isQuota =
      response.status === 402 ||
      rawText.toLowerCase().includes('quota') ||
      rawText.toLowerCase().includes('credit') ||
      rawText.toLowerCase().includes('balance');

    if (is429) {
      throw new Error(
        'Limite de requisições/concorrência atingido na Agnes AI (HTTP 429). A plataforma processa um vídeo por vez. Aguarde alguns segundos.'
      );
    }
    if (isQuota) {
      throw new Error(
        'Saldo ou créditos insuficientes na sua conta Agnes AI. Verifique seu plano e saldo na plataforma.'
      );
    }
    if (rawText.includes('<!doctype') || rawText.includes('<html')) {
      throw new Error(
        `O servidor retornou uma página HTML (HTTP ${response.status}) em vez de dados JSON.`
      );
    }
    throw new Error(`Resposta inesperada do servidor (HTTP ${response.status})`);
  }

  if (!response.ok) {
    const errMsg = parsed?.error?.message || parsed?.error || parsed?.message || `Erro HTTP ${response.status}`;
    const errStr = String(errMsg);
    if (
      response.status === 429 ||
      errStr.toLowerCase().includes('rate limit') ||
      errStr.toLowerCase().includes('too many requests') ||
      errStr.toLowerCase().includes('concorrência')
    ) {
      throw new Error(
        'Limite de concorrência atingido na Agnes AI (429). Aguarde alguns segundos entre as gerações de vídeo.'
      );
    }
    if (
      response.status === 402 ||
      errStr.toLowerCase().includes('credit') ||
      errStr.toLowerCase().includes('balance') ||
      errStr.toLowerCase().includes('quota')
    ) {
      throw new Error('Saldo ou créditos insuficientes na sua conta Agnes AI.');
    }
    throw new Error(errMsg);
  }

  return parsed;
}

/**
 * Interactive Chat with Agnes 2.5 Flash for theme/video suggestions
 */
export async function chatWithAgnesForSuggestions(
  history: { role: 'user' | 'assistant' | 'system'; content: string }[],
  userKey?: string,
): Promise<{ text: string; suggestions: VideoSuggestion[] }> {
  const systemPrompt = `Você é o consultor cinematográfico e showrunner criativo da Agnes CineForge.
O usuário vai conversar com você para pedir sugestões de temas, tipos de vídeo, conceitos visuais ou orientações para criar cenas e vídeos longos.
Responda sempre em português, com entusiasmo, precisão cinematográfica e ideias viáveis para geração de vídeo com IA.

SEMPRE que sugerir um ou mais conceitos de vídeo (ou quando o usuário pedir ideias/temas), estruture as ideias principais ao final da mensagem em um bloco JSON especial delimitado exatamente por:
\`\`\`json:suggestions
[
  {
    "title": "Título Curto e Cinematográfico",
    "genre": "Gênero e Estilo Visual (ex: Cyberpunk Sci-Fi, Dark Noir, Western Espacial)",
    "synopsis": "Sinopse narrativa detalhada e envolvente com ações das cenas...",
    "shotCount": 4,
    "aspectRatio": "16:9",
    "keyVisual": "Iluminação neon, lentes anamórficas e atmosfera de chuva"
  }
]
\`\`\`
Forneça de 1 a 3 opções de sugestões quando o usuário pedir ideias. Se ele fizer uma pergunta geral, responda e forneça ao menos 1 exemplo prático no bloco de sugestão para que ele possa clicar e preencher o projeto.`;

  const messagesToSend = [
    { role: 'system', content: systemPrompt },
    ...history,
  ];

  const response = await fetch('/api/agnes/chat', {
    method: 'POST',
    headers: getAuthHeaders(userKey),
    body: JSON.stringify({
      model: 'agnes-2.5-flash',
      messages: messagesToSend,
      temperature: 0.75,
      max_tokens: 2000,
    }),
  });

  const data = await parseSafeJson(response, 'Agnes Chat');
  const rawContent = data.choices?.[0]?.message?.content || '';

  let suggestions: VideoSuggestion[] = [];
  let cleanText = rawContent;

  const jsonMatch =
    rawContent.match(/```(?:json:suggestions|json)?\s*(\[\s*\{[\s\S]*?\}\s*\])\s*```/) ||
    rawContent.match(/(\[\s*\{\s*"title"[\s\S]*?\}\s*\])/);

  if (jsonMatch) {
    try {
      suggestions = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      cleanText = (rawContent || '').replace(jsonMatch[0], '').trim();
    } catch (e) {
      console.warn('Failed to parse suggestions JSON from Agnes:', e);
    }
  }

  return {
    text: cleanText || 'Aqui estão algumas sugestões com base no que conversamos:',
    suggestions,
  };
}

/**
 * Ultra-resilient JSON parser for storyboard breakdowns
 */
export function repairAndParseStoryboardJson(rawContent: string, requestedCount: number = 4): any[] {
  if (!rawContent || typeof rawContent !== 'string') {
    return createDefaultStoryboardShots(requestedCount);
  }

  // 1. Try direct parse
  try {
    const direct = JSON.parse(rawContent);
    if (Array.isArray(direct) && direct.length > 0) return direct;
  } catch (_) {}

  // 2. Extract JSON array substring
  let text = rawContent.trim();
  text = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();

  const firstBracket = text.indexOf('[');
  if (firstBracket !== -1) {
    text = text.slice(firstBracket);
  }

  // Fix missing '{' before array items
  text = text.replace(/([}\]])\s*,\s*("step(?:Number|Type)"|"actionTitle"|"order"|"title")\s*:/g, '$1, { $2:');
  text = text.replace(/\[\s*("step(?:Number|Type)"|"actionTitle"|"order"|"title")\s*:/g, '[ { $1:');

  // Handle cut off mid-string
  let insideString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\' && insideString) {
      escaped = !escaped;
    } else {
      if (ch === '"' && !escaped) {
        insideString = !insideString;
      }
      escaped = false;
    }
  }
  if (insideString) text += '"';

  // Fix unclosed brackets/braces
  const stack: string[] = [];
  insideString = false;
  escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\' && insideString) {
      escaped = !escaped;
    } else {
      if (ch === '"' && !escaped) {
        insideString = !insideString;
      } else if (!insideString) {
        if (ch === '{') stack.push('}');
        else if (ch === '[') stack.push(']');
        else if (ch === '}' || ch === ']') {
          if (stack.length > 0 && stack[stack.length - 1] === ch) {
            stack.pop();
          }
        }
      }
      escaped = false;
    }
  }

  text = text.trim().replace(/,\s*$/, '');
  while (stack.length > 0) {
    text += stack.pop();
  }

  try {
    const repaired = JSON.parse(text);
    if (Array.isArray(repaired) && repaired.length > 0) {
      return repaired.filter((s: any) => s && typeof s === 'object');
    }
  } catch (_) {}

  // 3. Fallback regex extraction of shots
  const shotBlocks = rawContent.split(/"title"\s*:/).slice(1);
  if (shotBlocks.length > 0) {
    const extracted: any[] = [];
    for (let idx = 0; idx < shotBlocks.length; idx++) {
      const block = shotBlocks[idx];
      const getField = (field: string) => {
        const m = block.match(new RegExp(`"${field}"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`));
        return m ? m[1].replace(/\\"/g, '"') : '';
      };
      const title = block.match(/^\s*"([^"\\]*(?:\\.[^"\\]*)*)"/)?.[1] || `Tomada ${idx + 1}`;
      extracted.push({
        order: idx + 1,
        title,
        shotType: getField('shotType') || 'medium_shot',
        cameraMotion: getField('cameraMotion') || 'cinematic_tracking',
        narrativeDescription: getField('narrativeDescription') || '',
        imagePrompt: getField('imagePrompt') || '',
        videoPrompt: getField('videoPrompt') || '',
        durationSeconds: 5,
      });
    }
    if (extracted.length > 0) return extracted;
  }

  return createDefaultStoryboardShots(requestedCount);
}

function createDefaultStoryboardShots(count: number = 4): any[] {
  return Array.from({ length: count }, (_, idx) => ({
    order: idx + 1,
    title: `Tomada ${String(idx + 1).padStart(2, '0')}: Cena Cinematográfica`,
    shotType: idx === 0 ? 'establishing_wide' : idx === count - 1 ? 'close_up' : 'medium_shot',
    cameraMotion: 'cinematic_tracking',
    narrativeDescription: 'Ação cinematográfica dramática revelando a história.',
    imagePrompt: 'Cinematic film shot, 8k resolution, photorealistic lighting, dramatic depth of field',
    videoPrompt: 'Cinematic camera movement, smooth motion dynamics, 24fps',
    durationSeconds: 5,
  }));
}

/**
 * Generates an automated cinematic storyboard breakdown using Agnes 2.5 Flash
 */
export async function generateStoryboardScript(
  params: ScriptGenerationParams,
  userKey?: string,
): Promise<Partial<SceneShot>[]> {
  const prompt = `Você é um diretor de fotografia e roteirista cinematográfico premiado.
Crie um storyboard sequencial detalhado de exatamente ${params.shotCount} tomadas (cenas/frames) para o seguinte filme:

Gênero: ${params.genre}
Sinopse: ${params.synopsis}
Aspect Ratio: ${params.aspectRatio}

Para cada tomada, forneça:
1. title: Título curto e cinematográfico (ex: "Tomada 01: O Despertar da Cidade")
2. shotType: um destes: 'establishing_wide', 'wide_shot', 'medium_shot', 'close_up', 'extreme_close_up', 'drone_aerial', 'pov', 'over_the_shoulder'
3. cameraMotion: um destes: 'pan_left', 'pan_right', 'zoom_in', 'zoom_out', 'tilt_up', 'tilt_down', 'cinematic_tracking', 'orbit_360', 'static_tripod'
4. narrativeDescription: Descrição narrativa em português do que acontece nesta tomada (1-2 frases).
5. imagePrompt: Prompt detalhado em inglês otimizado para o modelo agnes-image-2.0-flash (descreva iluminação, composição, lente, texturas, estilo cinematográfico 8k, sem palavras de baixa qualidade).
6. videoPrompt: Prompt em inglês para o modelo de vídeo agnes-video-v2.0 descrevendo o movimento exato da câmera e a dinâmica dos elementos na cena.
7. durationSeconds: 3, 5 ou 10 segundos.

Responda APENAS com um JSON array válido contendo esses objetos, sem markdown blocks com texto fora do json.`;

  const response = await fetch('/api/agnes/chat', {
    method: 'POST',
    headers: getAuthHeaders(userKey),
    body: JSON.stringify({
      model: 'agnes-2.5-flash',
      messages: [
        {
          role: 'system',
          content: 'Você é um assistente de direção de cinema e storyboard. Responda exclusivamente em formato JSON válido.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  const data = await parseSafeJson(response, 'Agnes Storyboard');
  const rawContent = data.choices?.[0]?.message?.content || '';

  const parsedShots = repairAndParseStoryboardJson(rawContent, params.shotCount);

  return parsedShots.map((s, index) => {
    const duration = s.durationSeconds === 10 ? 10 : s.durationSeconds === 3 ? 3 : 5;
    const numFrames = duration === 10 ? 241 : duration === 3 ? 81 : 121;
    return {
      order: index + 1,
      title: s.title || `Tomada ${String(index + 1).padStart(2, '0')}`,
      shotType: (s.shotType as ShotType) || 'medium_shot',
      cameraMotion: (s.cameraMotion as CameraMotion) || 'cinematic_tracking',
      narrativeDescription: s.narrativeDescription || '',
      imagePrompt: s.imagePrompt || '',
      videoPrompt: s.videoPrompt || '',
      durationSeconds: duration,
      numFrames,
      frameRate: 24,
      aspectRatio: params.aspectRatio,
      transitionToNext: 'crossfade',
    };
  });
}

/**
 * Generates shot image using Agnes Image 2.0 Flash
 */
export async function generateShotImage(
  prompt: string,
  aspectRatio: '16:9' | '9:16' | '1:1' = '16:9',
  referenceImageUrl?: string,
  userKey?: string,
): Promise<string> {
  const sizeMap: Record<string, string> = {
    '16:9': '1024x768',
    '9:16': '768x1024',
    '1:1': '1024x1024',
  };

  const payload: any = {
    model: 'agnes-image-2.0-flash',
    prompt,
    size: sizeMap[aspectRatio] || '1024x768',
    extra_body: {
      response_format: 'url',
    },
  };

  // If reference image provided, pass in extra_body.image for image-to-image
  if (referenceImageUrl && referenceImageUrl.startsWith('http')) {
    payload.extra_body.image = [referenceImageUrl];
  }

  const response = await fetch('/api/agnes/images/generations', {
    method: 'POST',
    headers: getAuthHeaders(userKey),
    body: JSON.stringify(payload),
  });

  const data = await parseSafeJson(response, 'Agnes Image');
  const imageUrl = data.data?.[0]?.url;
  if (!imageUrl) {
    if (data.data?.[0]?.b64_json) {
      return `data:image/png;base64,${data.data[0].b64_json}`;
    }
    throw new Error('Nenhuma imagem retornada pela Agnes API');
  }

  return imageUrl;
}

/**
 * Creates video task using Agnes Video V2.0 with automatic retry on 429 rate limit
 */
export async function createVideoTask(
  params: {
    prompt: string;
    imageUrl?: string;
    secondKeyframeUrl?: string; // If keyframe transition is desired
    numFrames?: number;
    frameRate?: number;
    aspectRatio?: '16:9' | '9:16' | '1:1';
  },
  userKey?: string,
): Promise<{ videoId: string; taskId: string; seconds?: string; size?: string }> {
  const numFrames = params.numFrames || 121;
  const frameRate = params.frameRate || 24;

  const width = params.aspectRatio === '9:16' ? 768 : 1152;
  const height = params.aspectRatio === '9:16' ? 1152 : 768;

  const payload: any = {
    model: 'agnes-video-v2.0',
    prompt: params.prompt,
    num_frames: numFrames,
    frame_rate: frameRate,
    width,
    height,
  };

  // If we have 2 keyframes, use keyframes mode
  if (params.imageUrl && params.secondKeyframeUrl) {
    payload.extra_body = {
      image: [params.imageUrl, params.secondKeyframeUrl],
      mode: 'keyframes',
    };
  } else if (params.imageUrl) {
    payload.image = params.imageUrl;
  }

  let lastErr: Error | null = null;
  // Retry up to 3 times if concurrency/rate limit (429) is hit
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch('/api/agnes/videos', {
        method: 'POST',
        headers: getAuthHeaders(userKey),
        body: JSON.stringify(payload),
      });

      const data = await parseSafeJson(response, 'Agnes Video');
      return {
        videoId: data.video_id || data.id,
        taskId: data.task_id || data.id,
        seconds: data.seconds,
        size: data.size,
      };
    } catch (err: any) {
      lastErr = err;
      const isRateLimit =
        err.message?.includes('429') ||
        err.message?.toLowerCase().includes('rate limit') ||
        err.message?.toLowerCase().includes('concorrência');
      if (isRateLimit && attempt < 2) {
        // Wait 4.5 seconds and retry
        await new Promise((r) => setTimeout(r, 4500));
        continue;
      }
      throw err;
    }
  }

  throw lastErr || new Error('Falha ao enviar tarefa de vídeo para a Agnes API.');
}

/**
 * Polls status of video generation task
 */
export async function pollVideoStatus(
  videoId: string,
  taskId?: string,
  onProgress?: (progress: number, status: string) => void,
  userKey?: string,
): Promise<string> {
  const maxAttempts = 150; // up to ~8-9 minutes
  const delayMs = 3000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const url = `/api/agnes/videos/status?video_id=${encodeURIComponent(videoId)}${
      taskId ? `&task_id=${encodeURIComponent(taskId)}` : ''
    }`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(userKey),
      });

      if (response.status === 429) {
        // Temporary rate limit during polling, back off slightly and continue
        await new Promise((r) => setTimeout(r, 4500));
        continue;
      }

      if (response.ok) {
        const data = await parseSafeJson(response, 'Agnes Video Status');
        const status = data.status || data.internal_status;
        const progress =
          typeof data.progress === 'number'
            ? data.progress
            : typeof data.internal_progress === 'number'
            ? data.internal_progress
            : status === 'completed'
            ? 100
            : 0;

        if (onProgress) {
          onProgress(progress, status || 'processando');
        }

        if (status === 'completed' || data.completed_at) {
          const videoUrl = data.metadata?.url || data.video_url || data.url;
          if (!videoUrl) {
            throw new Error('Vídeo concluído, mas URL de destino não foi encontrada.');
          }
          return videoUrl;
        }

        if (status === 'failed') {
          const errMsg = data.error?.message || data.error || 'A geração do vídeo falhou na Agnes API.';
          throw new Error(errMsg);
        }
      } else if (response.status >= 400 && response.status !== 404) {
        // If critical error like 401 or 402, abort polling immediately with clear error
        await parseSafeJson(response, 'Agnes Video Status');
      }
    } catch (pollErr: any) {
      if (
        pollErr.message?.includes('Saldo') ||
        pollErr.message?.includes('créditos') ||
        pollErr.message?.includes('inválida') ||
        pollErr.message?.includes('401') ||
        pollErr.message?.includes('402')
      ) {
        throw pollErr;
      }
      console.warn(`Poll attempt ${attempt + 1} warning:`, pollErr.message);
    }

    // Wait before next poll
    await new Promise((r) => setTimeout(r, delayMs));
  }

  throw new Error('Tempo limite excedido aguardando a renderização do vídeo.');
}

/**
 * Generates an automated culinary recipe step-by-step workflow with last-frame continuity
 */
export async function generateRecipeWorkflowWithAgnes(
  params: {
    recipeNameOrIdea: string;
    stepCount?: number;
    aspectRatio?: '9:16' | '16:9' | '1:1';
    handStyle?: string;
    bowlStyle?: string;
    surfaceStyle?: string;
    fixedAnchors?: {
      handAnchor?: string;
      countertopAnchor?: string;
      lightingAnchor?: string;
      styleAnchor?: string;
    };
  },
  userKey?: string,
): Promise<{
  title: string;
  category: string;
  prepTime: string;
  aspectRatio: '9:16' | '16:9' | '1:1';
  fixedAnchors: {
    handAnchor: string;
    countertopAnchor: string;
    lightingAnchor: string;
    styleAnchor: string;
  };
  handStyle: string;
  bowlStyle: string;
  surfaceStyle: string;
  steps: {
    stepNumber: number;
    stepType:
      | 'prep_cutting'
      | 'preparation'
      | 'saute_frying'
      | 'boil_simmer'
      | 'blender_process'
      | 'appliance_enter'
      | 'appliance_exit'
      | 'plated_hero'
      | 'tasting'
      | 'social_cta';
    equipmentStation:
      | 'cutting_board'
      | 'pan_stove'
      | 'pot_boiling'
      | 'blender'
      | 'bowl_prep'
      | 'oven_appliance'
      | 'serving_plate'
      | 'tasting_fork'
      | 'social_hero';
    utensil: string;
    continuityRule: string;
    continuityNote: string;
    actionTitle: string;
    instruction: string;
    voiceoverText: string;
    sfx: 'sizzle' | 'chop' | 'stir' | 'pour' | 'timer_ding' | 'none';
    imagePrompt: string;
    endImagePrompt?: string;
    videoPrompt: string;
    durationSeconds: number;
  }[];
}> {
  const handAnchor =
    params.fixedAnchors?.handAnchor ||
    params.handStyle ||
    'Mãos cuidadas do cozinheiro com unhas vermelhas elegantes e anel discreto';
  const countertopAnchor =
    params.fixedAnchors?.countertopAnchor ||
    params.surfaceStyle ||
    'Bancada de carvalho rústico escuro na cozinha com azulejos claros e clima acolhedor';
  const lightingAnchor =
    params.fixedAnchors?.lightingAnchor ||
    'Iluminação suave difusa de janela matinal 5600K com reflexos quentes e vapor aromático';
  const styleAnchor =
    params.fixedAnchors?.styleAnchor ||
    'Fotografia gastronômica comercial para Reels/TikTok, apetitosa em altíssima definição 8k';

  // 1. Try dedicated server endpoint first (which uses Gemini 3.8 Flash with structured schema or server-side Agnes proxy)
  try {
    const serverRes = await fetch('/api/recipe/generate', {
      method: 'POST',
      headers: getAuthHeaders(userKey),
      body: JSON.stringify({
        recipeNameOrIdea: params.recipeNameOrIdea,
        stepCount: params.stepCount || 5,
        aspectRatio: params.aspectRatio || '9:16',
        handStyle: handAnchor,
        surfaceStyle: countertopAnchor,
        fixedAnchors: {
          handAnchor,
          countertopAnchor,
          lightingAnchor,
          styleAnchor,
        },
      }),
    });

    if (serverRes.ok) {
      const serverData = await serverRes.json();
      if (serverData.ok) {
        if (serverData.data && Array.isArray(serverData.data.steps) && serverData.data.steps.length > 0) {
          return normalizeRecipe(serverData.data, params.recipeNameOrIdea);
        }
        if (serverData.raw) {
          return repairAndParseRecipeJson(serverData.raw, params.recipeNameOrIdea);
        }
      }
    }
  } catch (srvErr) {
    console.warn('Server /api/recipe/generate notice, using direct client flow:', srvErr);
  }

  // 2. Direct client flow via /api/agnes/chat with robust repair parser
  const prompt = `Você é um diretor de produção audiovisual e criador de conteúdo gastronômico viral para Reels, TikTok e YouTube Shorts.
O usuário quer estruturar um vídeo de culinária profissional, humano, natural e fluido (em vez de robótico e preso a uma única tigela).

DIRETRIZ DE ARQUITETURA FLUIDA & LAST-FRAME (MÚLTIPLOS UTENSÍLIOS):
Em um vídeo de culinária real, a consistência NÃO vem de usar a mesma tigela do começo ao fim, mas sim da IDENTIDADE VISUAL CONTÍNUA do ambiente e do cozinheiro associada à TRANSIÇÃO LÓGICA de utensílios entre cada tomada!

1. ÂNCORAS FIXAS vs. UTENSÍLIOS DINÂMICOS:
- ÂNCORAS FIXAS (Permanecem sempre presentes no prompt de cada tomada):
  * Mãos: "${handAnchor}"
  * Bancada: "${countertopAnchor}"
  * Iluminação: "${lightingAnchor}"
  * Estilo: "${styleAnchor}"

- UTENSÍLIOS DINÂMICOS (Mudam conforme a etapa gastronômica da receita):
  * Preparo / Corte (prep_cutting / cutting_board): Tábua de corte na bancada com faca de chef.
  * Refogado / Fritura (saute_frying / pan_stove): Frigideira de inox ou antiaderente sobre o fogão aceso com chama viva.
  * Cozimento / Fervura (boil_simmer / pot_boiling): Panela alta com água fervendo borbulhante ou molho.
  * Processamento (blender_process / blender): Jarra do liquidificador ou copo do processador.
  * Assados / Micro-ondas / Forno (appliance_enter & appliance_exit / oven_appliance): Interior ou entrada/saída do forno, air fryer ou micro-ondas.
  * Empratamento / Hero Shot (plated_hero / serving_plate): Prato de servir final elegante (prato raso, fundo de massa ou bowl de cerâmica) na bancada.
  * Degustação / Garfada (tasting / tasting_fork): Garfo, colher ou pinça levantando a porção com queijo esticando ou textura apetitosa em close-up.
  * Mídia Social / CTA (social_cta / social_hero): Prato completo apetitoso na bancada com texto e voz convidando a curtir, comentar e seguir!

2. REGRA DE OURO DA CONTINUIDADE POR LAST-FRAME:
A continuidade pelo Last-Frame deve ser usada quando o ingrediente é TRANSFERIDO ou TRANSFORMADO mantendo mãos, unhas e a iluminação do cenário fiéis.

DETALHES DO PEDIDO DO USUÁRIO:
Ideia da receita: ${params.recipeNameOrIdea}
Quantidade de passos/tomadas: ${params.stepCount || 5}
Formato de tela: ${params.aspectRatio || '9:16'}

REQUISITOS ESTRITOS DE FORMATO:
- Responda EXCLUSIVAMENTE com um objeto JSON bem formado.
- Cada etapa do array "steps" DEVE ser um objeto iniciando com "{" e terminando com "}".
- Mantenha imagePrompt e videoPrompt concisos (2 a 3 frases cada) para que todas as tomadas caibam no limite de tokens sem truncamento.
- Formato:
{
  "title": "Nome Curto e Apetitoso da Receita",
  "category": "Categoria (ex: Culinária Dinâmica / Alta Gastronomia / Massa)",
  "prepTime": "Tempo de preparo (ex: 12 min)",
  "aspectRatio": "${params.aspectRatio || '9:16'}",
  "fixedAnchors": {
    "handAnchor": "${handAnchor}",
    "countertopAnchor": "${countertopAnchor}",
    "lightingAnchor": "${lightingAnchor}",
    "styleAnchor": "${styleAnchor}"
  },
  "handStyle": "${handAnchor}",
  "bowlStyle": "Múltiplos utensílios conforme a etapa",
  "surfaceStyle": "${countertopAnchor}, ${lightingAnchor}",
  "steps": [
    {
      "stepNumber": 1,
      "stepType": "prep_cutting",
      "equipmentStation": "cutting_board",
      "utensil": "Tábua de madeira rústica e faca de chef",
      "continuityRule": "Fixa identidade visual das mãos, unhas e bancada",
      "continuityNote": "Corte de ingredientes que serão transferidos na tomada seguinte",
      "actionTitle": "Tomada 1: Cortar Ingredientes (Tábua de Madeira)",
      "instruction": "Instrução técnica rápida",
      "voiceoverText": "Texto falado para locução envolvente e natural...",
      "sfx": "chop",
      "imagePrompt": "Prompt em inglês conciso para o início da cena (Start Frame 0s) para agnes-image-2.0-flash com as âncoras fixas em 9:16 8k...",
      "endImagePrompt": "Prompt em inglês conciso para o frame final da cena (End Frame 3s-5s) onde a ação física deste passo termina nítida e pronta para a próxima tomada...",
      "videoPrompt": "Prompt em inglês conciso para agnes-video-v2.0 descrevendo o movimento exato entre o início e o fim...",
      "durationSeconds": 3
    }
  ]
}`;

  const response = await fetch('/api/agnes/chat', {
    method: 'POST',
    headers: getAuthHeaders(userKey),
    body: JSON.stringify({
      model: 'agnes-2.5-flash',
      messages: [
        {
          role: 'system',
          content: 'Você é um diretor especializado em vídeos virais de culinária com IA. Responda exclusivamente em formato JSON bem formado com chaves fechadas.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  const data = await parseSafeJson(response, 'Agnes Recipe');
  const rawContent = data.choices?.[0]?.message?.content || '';

  return repairAndParseRecipeJson(rawContent, params.recipeNameOrIdea);
}

/**
 * Ultra-resilient JSON parser and repair engine for Recipe LLM outputs.
 * Solves:
 * 1. Missing opening braces on array items (e.g. `}, "stepNumber": 5, ...`)
 * 2. Truncated output (cut off mid-string or mid-object)
 * 3. Unclosed quotes, brackets, and braces
 * 4. Regex-based fallback extraction to guarantee a flawless result
 */
export function repairAndParseRecipeJson(rawContent: string, fallbackTitle: string = 'Receita'): any {
  if (!rawContent || typeof rawContent !== 'string') {
    return createDefaultRecipe(fallbackTitle);
  }

  // 1. Try direct JSON.parse first
  try {
    const direct = JSON.parse(rawContent);
    if (direct && Array.isArray(direct.steps) && direct.steps.length > 0) {
      return normalizeRecipe(direct, fallbackTitle);
    }
  } catch (_) {}

  // 2. Extract JSON string candidate
  let text = rawContent.trim();
  text = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();

  const firstBrace = text.indexOf('{');
  if (firstBrace !== -1) {
    text = text.slice(firstBrace);
  }

  // 3. Fix missing '{' before array items:
  // e.g. `}, \n "stepNumber": 5` or `[ \n "stepNumber": 1`
  text = text.replace(/([}\]])\s*,\s*("step(?:Number|Type)"|"actionTitle"|"order"|"title")\s*:/g, '$1, { $2:');
  text = text.replace(/\[\s*("step(?:Number|Type)"|"actionTitle"|"order"|"title")\s*:/g, '[ { $1:');

  // 4. Handle cut off mid-string (odd count of unescaped quotes)
  let insideString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\' && insideString) {
      escaped = !escaped;
    } else {
      if (ch === '"' && !escaped) {
        insideString = !insideString;
      }
      escaped = false;
    }
  }
  if (insideString) {
    text += '"';
  }

  // 5. Track unclosed braces and brackets
  const stack: string[] = [];
  insideString = false;
  escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\' && insideString) {
      escaped = !escaped;
    } else {
      if (ch === '"' && !escaped) {
        insideString = !insideString;
      } else if (!insideString) {
        if (ch === '{') stack.push('}');
        else if (ch === '[') stack.push(']');
        else if (ch === '}' || ch === ']') {
          if (stack.length > 0 && stack[stack.length - 1] === ch) {
            stack.pop();
          }
        }
      }
      escaped = false;
    }
  }

  // Remove trailing dangling commas or colons before closing
  text = text.trim().replace(/,\s*$/, '');

  // Close all remaining brackets and braces in LIFO order
  while (stack.length > 0) {
    text += stack.pop();
  }

  // 6. Try parsing repaired string
  try {
    const repaired = JSON.parse(text);
    if (repaired && Array.isArray(repaired.steps) && repaired.steps.length > 0) {
      return normalizeRecipe(repaired, fallbackTitle);
    }
  } catch (err) {
    console.warn('Repaired JSON parse notice, applying regex step extraction:', err);
  }

  // 7. Regex-based extraction fallback: salvage all steps from rawContent!
  const regexExtracted = extractRecipeViaRegex(rawContent, fallbackTitle);
  if (regexExtracted && regexExtracted.steps.length > 0) {
    return regexExtracted;
  }

  // 8. Graceful default recipe matching fallbackTitle
  return createDefaultRecipe(fallbackTitle);
}

function extractRecipeViaRegex(rawContent: string, fallbackTitle: string): any {
  const titleMatch = rawContent.match(/"title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
  const categoryMatch = rawContent.match(/"category"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
  const prepTimeMatch = rawContent.match(/"prepTime"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
  const handAnchorMatch =
    rawContent.match(/"handAnchor"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/) ||
    rawContent.match(/"handStyle"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
  const countertopAnchorMatch =
    rawContent.match(/"countertopAnchor"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/) ||
    rawContent.match(/"surfaceStyle"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
  const lightingAnchorMatch = rawContent.match(/"lightingAnchor"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
  const styleAnchorMatch = rawContent.match(/"styleAnchor"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);

  const stepBlocks = rawContent.split(/"stepNumber"\s*:/).slice(1);
  const steps: any[] = [];

  for (let idx = 0; idx < stepBlocks.length; idx++) {
    const block = stepBlocks[idx];
    const getField = (field: string) => {
      const m = block.match(new RegExp(`"${field}"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`));
      return m ? m[1].replace(/\\"/g, '"').replace(/\\n/g, ' ') : '';
    };

    const actionTitle = getField('actionTitle') || `Tomada ${idx + 1}: Etapa Culinária`;
    const instruction = getField('instruction') || 'Realize o preparo gastronômico desta tomada.';
    const voiceoverText = getField('voiceoverText') || 'Prepare este passo com carinho e precisão.';
    const imagePrompt = getField('imagePrompt') || `Cinematic culinary shot, 9:16, 8k, ${actionTitle}`;
    const videoPrompt = getField('videoPrompt') || `Cinematic camera motion, smooth cooking dynamics, 24fps`;
    const sfx = (getField('sfx') || 'stir') as any;
    const stepType = (getField('stepType') || (idx === 0 ? 'prep_cutting' : idx === stepBlocks.length - 1 ? 'social_cta' : 'preparation')) as any;
    const equipmentStation = (getField('equipmentStation') || (stepType === 'prep_cutting' ? 'cutting_board' : stepType === 'social_cta' ? 'social_hero' : 'bowl_prep')) as any;
    const utensil = getField('utensil') || 'Utensílio culinário adequado';
    const continuityRule = getField('continuityRule') || 'Fixa identidade visual das mãos, bancada e iluminação';
    const continuityNote = getField('continuityNote') || 'Continuidade fluida com a etapa anterior';

    steps.push({
      stepNumber: idx + 1,
      stepType,
      equipmentStation,
      utensil,
      continuityRule,
      continuityNote,
      actionTitle,
      instruction,
      voiceoverText,
      sfx,
      imagePrompt,
      videoPrompt,
      durationSeconds: 5,
    });
  }

  if (steps.length > 0) {
    const handAnchor = handAnchorMatch ? handAnchorMatch[1] : 'Mãos cuidadas do cozinheiro com unhas vermelhas e anel discreto';
    const countertopAnchor = countertopAnchorMatch ? countertopAnchorMatch[1] : 'Bancada de carvalho rústico com iluminação suave';
    const lightingAnchor = lightingAnchorMatch ? lightingAnchorMatch[1] : 'Iluminação suave difusa de janela matinal 5600K com vapor aromático';
    const styleAnchor = styleAnchorMatch ? styleAnchorMatch[1] : 'Fotografia gastronômica comercial 8k, apetitosa e natural';

    return {
      title: titleMatch ? titleMatch[1] : fallbackTitle,
      category: categoryMatch ? categoryMatch[1] : 'Culinária Dinâmica',
      prepTime: prepTimeMatch ? prepTimeMatch[1] : '10 min',
      aspectRatio: '9:16',
      fixedAnchors: {
        handAnchor,
        countertopAnchor,
        lightingAnchor,
        styleAnchor,
      },
      handStyle: handAnchor,
      bowlStyle: 'Múltiplos utensílios conforme a etapa',
      surfaceStyle: countertopAnchor,
      steps,
    };
  }

  return null;
}

function normalizeRecipe(obj: any, fallbackTitle: string): any {
  const title = obj.title || fallbackTitle || 'Receita Gourmet Express';
  const category = obj.category || 'Culinária Dinâmica';
  const prepTime = obj.prepTime || '10 min';
  const aspectRatio = obj.aspectRatio === '16:9' || obj.aspectRatio === '1:1' ? obj.aspectRatio : '9:16';

  const handAnchor =
    obj.fixedAnchors?.handAnchor ||
    obj.handStyle ||
    'Mãos cuidadas do cozinheiro com unhas vermelhas e anel discreto';
  const countertopAnchor =
    obj.fixedAnchors?.countertopAnchor ||
    obj.surfaceStyle ||
    'Bancada de carvalho rústico com azulejos claros e iluminação suave';
  const lightingAnchor =
    obj.fixedAnchors?.lightingAnchor ||
    'Iluminação suave difusa de janela matinal 5600K com reflexos quentes e vapor aromático';
  const styleAnchor =
    obj.fixedAnchors?.styleAnchor ||
    'Fotografia gastronômica comercial para Reels/TikTok, apetitosa em altíssima definição 8k';

  const fixedAnchors = {
    handAnchor,
    countertopAnchor,
    lightingAnchor,
    styleAnchor,
  };

  const rawSteps = Array.isArray(obj.steps) ? obj.steps : [];
  const validSteps = rawSteps
    .filter((st: any) => st && typeof st === 'object')
    .map((st: any, idx: number) => {
      const stepNum = typeof st.stepNumber === 'number' ? st.stepNumber : idx + 1;
      const durationSeconds = typeof st.durationSeconds === 'number' ? st.durationSeconds : 5;
      const actionTitle = st.actionTitle || `Tomada ${stepNum}: Etapa Culinária`;
      const instruction = st.instruction || 'Execute o preparo gastronômico desta tomada com atenção.';
      const voiceoverText = st.voiceoverText || 'Prepare os ingredientes com carinho e precisão.';
      const sfx = st.sfx || 'stir';
      const stepType =
        st.stepType ||
        (idx === 0 ? 'prep_cutting' : idx === rawSteps.length - 1 ? 'social_cta' : 'preparation');
      const equipmentStation =
        st.equipmentStation ||
        (stepType === 'prep_cutting'
          ? 'cutting_board'
          : stepType === 'social_cta'
          ? 'social_hero'
          : 'bowl_prep');
      const utensil = st.utensil || 'Utensílio culinário adequado';
      const continuityRule =
        st.continuityRule || 'Fixa identidade visual das mãos, bancada e iluminação de fundo';
      const continuityNote = st.continuityNote || 'Continuidade fluida com a tomada anterior';
      const imagePrompt =
        st.imagePrompt || `Cinematic culinary vertical shot, 9:16, 8k, ${actionTitle}, hands and counter visible`;
      const videoPrompt =
        st.videoPrompt || `Smooth cinematic cooking action, 24fps, steam rising gently, realistic motion`;

      return {
        stepNumber: stepNum,
        stepType,
        equipmentStation,
        utensil,
        continuityRule,
        continuityNote,
        actionTitle,
        instruction,
        voiceoverText,
        sfx,
        imagePrompt,
        endImagePrompt: st.endImagePrompt || undefined,
        videoPrompt,
        durationSeconds,
      };
    });

  return {
    title,
    category,
    prepTime,
    aspectRatio,
    fixedAnchors,
    handStyle: handAnchor,
    bowlStyle: obj.bowlStyle || 'Múltiplos utensílios conforme a etapa',
    surfaceStyle: countertopAnchor,
    steps: validSteps.length > 0 ? validSteps : createDefaultRecipe(title).steps,
  };
}

function createDefaultRecipe(title: string): any {
  const cleanTitle = title || 'Bruschetta Italiana Express';
  const handAnchor = 'Mãos cuidadas do cozinheiro com unhas vermelhas e anel dourado discreto';
  const countertopAnchor = 'Bancada de carvalho rústico com azulejos claros e iluminação suave';
  const lightingAnchor = 'Iluminação suave difusa de janela matinal 5600K com reflexos dourados e vapor natural';
  const styleAnchor = 'Fotografia gastronômica comercial para Reels/TikTok, apetitosa em altíssima definição 8k';

  return {
    title: cleanTitle,
    category: 'Culinária Dinâmica',
    prepTime: '10 min',
    aspectRatio: '9:16',
    fixedAnchors: {
      handAnchor,
      countertopAnchor,
      lightingAnchor,
      styleAnchor,
    },
    handStyle: handAnchor,
    bowlStyle: 'Múltiplos utensílios conforme a etapa',
    surfaceStyle: countertopAnchor,
    steps: [
      {
        stepNumber: 1,
        stepType: 'prep_cutting',
        equipmentStation: 'cutting_board',
        utensil: 'Tábua de corte de madeira rústica e faca de chef afiada',
        continuityRule: 'Fixa identidade visual das mãos, unhas e bancada',
        continuityNote: 'Ingredientes frescos fatiados que serão transferidos para o calor no próximo passo',
        actionTitle: 'Tomada 1: Fatiar Ingredientes Frescos (Tábua de Corte)',
        instruction: 'Fatie os ingredientes finamente na tábua de madeira rústica.',
        voiceoverText: `Começamos preparando os ingredientes frescos para a nossa ${cleanTitle}...`,
        sfx: 'chop',
        imagePrompt: `Extreme close-up, top-down angle, 9:16, cutting board scene: ${handAnchor} cutting fresh ingredients on rustic wooden cutting board with chef knife, ${countertopAnchor}, ${lightingAnchor}, ${styleAnchor}`,
        videoPrompt: `Hands skillfully chopping ingredients on wooden board with chef knife, smooth camera tracking push in, 24fps`,
        durationSeconds: 5,
      },
      {
        stepNumber: 2,
        stepType: 'saute_frying',
        equipmentStation: 'pan_stove',
        utensil: 'Frigideira de inox sobre fogão aceso com chama viva',
        continuityRule: 'A IA pega os ingredientes fatiados da tábua e os transfere para o azeite quente',
        continuityNote: 'Ingredientes transferidos para a frigideira quente no fogão',
        actionTitle: 'Tomada 2: Dourar e Saltear (Frigideira no Fogo)',
        instruction: 'Despeje o azeite na frigideira quente e salteie os ingredientes até dourar.',
        voiceoverText: 'Agora vamos para o fogo alto: azeite quente e aquele chiado delicioso...',
        sfx: 'sizzle',
        imagePrompt: `Close-up shot, 9:16, pan on glowing stovetop burner: ${handAnchor} adding ingredients into sizzling olive oil in stainless steel pan, steam rising, ${lightingAnchor}, ${styleAnchor}`,
        videoPrompt: `Hands tossing ingredients in hot pan, visible sizzle and aromatic steam rising in warm light, 24fps`,
        durationSeconds: 5,
      },
      {
        stepNumber: 3,
        stepType: 'preparation',
        equipmentStation: 'bowl_prep',
        utensil: 'Bowl de cerâmica artesanal e colher de pau',
        continuityRule: 'Ingredientes cozidos misturados com temperos frescos no bowl',
        continuityNote: 'Mistura e incorporação dos sabores em textura suculenta',
        actionTitle: 'Tomada 3: Incorporar e Temperar (Tigela de Mistura)',
        instruction: 'Misture os ingredientes delicadamente com ervas frescas e temperos.',
        voiceoverText: 'Misturamos tudo com ervas frescas para criar uma textura suculenta e irresistível...',
        sfx: 'stir',
        imagePrompt: `Close-up, 9:16, ceramic bowl on countertop: ${handAnchor} stirring and dressing delicious savory mixture with wooden spoon, ${countertopAnchor}, ${lightingAnchor}, ${styleAnchor}`,
        videoPrompt: `Hands folding ingredients together in ceramic bowl, sauce coating richly, camera pushes in, 24fps`,
        durationSeconds: 5,
      },
      {
        stepNumber: 4,
        stepType: 'plated_hero',
        equipmentStation: 'serving_plate',
        utensil: 'Prato fundo de cerâmica artesanal elegante',
        continuityRule: 'Transferência da mistura para o prato de servir na bancada com as mesmas mãos',
        continuityNote: 'Empratamento final com apresentação gourmet',
        actionTitle: 'Tomada 4: Empratamento Gourmet (Hero Shot)',
        instruction: 'Monte o prato com elegância e finalize com folhas frescas e toque de azeite.',
        voiceoverText: 'Empratamos com carinho em um prato elegante... o aroma toma conta de toda a cozinha!',
        sfx: 'stir',
        imagePrompt: `Close-up hero shot, 9:16, rustic ceramic plate on wooden countertop: gorgeous presentation of ${cleanTitle}, garnished with fresh basil, steam rising, ${countertopAnchor}, ${lightingAnchor}, ${styleAnchor}`,
        videoPrompt: `Hands placing final garnish on plated dish, slow subtle camera orbit around the steaming plate, 24fps`,
        durationSeconds: 5,
      },
      {
        stepNumber: 5,
        stepType: 'social_cta',
        equipmentStation: 'social_hero',
        utensil: 'Prato finalizado na bancada com espaço para legenda',
        continuityRule: 'Prato pronto na bancada servindo de moldura para a chamada final de engajamento',
        continuityNote: 'Tomada de encerramento com chamada para curtir, comentar e seguir',
        actionTitle: 'Tomada 5: CTA Final — Degustação e Chamada',
        instruction: 'Apresente o prato pronto e faça o convite para salvar e seguir o canal.',
        voiceoverText: `Ficou espetacular! Se você gostou dessa receita, já salva nos favoritos, comenta o que achou e me segue para não perder os próximos vídeos!`,
        sfx: 'timer_ding',
        imagePrompt: `Wide close-up hero shot, 9:16, complete plated ${cleanTitle} on wooden countertop: ${handAnchor} gesturing invitingly toward camera, warm light reflections, clean negative space, ${lightingAnchor}, ${styleAnchor}`,
        videoPrompt: `Camera gently pulls back revealing finished dish, hands gesture welcomingly, appetizing steam rising, 24fps`,
        durationSeconds: 5,
      },
    ],
  };
}

/**
 * Builds or refreshes image and video prompts ensuring Fixed Anchors (hands, countertop, lighting)
 * remain 100% consistent while dynamic utensils change per culinary stage.
 */
export function buildPromptWithFixedAnchors(params: {
  handAnchor: string;
  countertopAnchor: string;
  lightingAnchor: string;
  styleAnchor: string;
  equipmentStation?: string;
  utensil?: string;
  actionTitle: string;
  instruction: string;
  aspectRatio: string;
  usesLastFrame?: boolean;
}): { imagePrompt: string; videoPrompt: string } {
  const stationDescriptions: Record<string, string> = {
    cutting_board: 'on a rustic wooden cutting board on the kitchen counter with a sharp chef knife',
    pan_stove: 'in a hot stainless steel frying pan directly on the glowing gas stove burner with blue flames',
    pot_boiling: 'in a tall cooking pot filled with rolling boiling water and bubbles on the stovetop',
    blender: 'inside the clear glass jar of a blender/food processor on the countertop',
    bowl_prep: 'inside a rustic artisanal ceramic prep bowl on the countertop',
    oven_appliance: 'inside an illuminated modern oven/air fryer with golden glowing interior heat',
    serving_plate: 'elegantly plated on a deep artisanal ceramic pasta bowl/serving plate on the counter',
    tasting_fork: 'close-up on an elegant fork lifting a steaming mouthwatering bite with stretching texture',
    social_hero: 'gorgeous appetizing presentation of the finished dish on the countertop ready for social media',
  };

  const stationContext = params.equipmentStation && stationDescriptions[params.equipmentStation]
    ? stationDescriptions[params.equipmentStation]
    : params.utensil
    ? `using ${params.utensil}`
    : 'on the kitchen counter';

  const continuityTag = params.usesLastFrame
    ? 'continuing seamlessly with the exact ingredients from previous shot,'
    : 'establishing shot,';

  const imagePrompt = `Cinematic vertical ${params.aspectRatio} culinary shot of ${params.handAnchor} performing: ${params.actionTitle} (${params.instruction}), ${stationContext}, ${continuityTag} set in kitchen with ${params.countertopAnchor}, ${params.lightingAnchor}, ${params.styleAnchor}`;

  const videoPrompt = `Hands smoothly performing ${params.actionTitle}, natural culinary dynamics, steam rising gently, realistic fluid movements, gentle camera tracking`;

  return { imagePrompt, videoPrompt };
}

/**
 * Validates Agnes API Key
 */
export async function testAgnesKey(key: string): Promise<{ valid: boolean; message: string }> {
  try {
    const response = await fetch('/api/agnes/test-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agnes-key': key,
      },
    });

    const data = await parseSafeJson(response, 'Agnes Key');
    return data;
  } catch (error: any) {
    return { valid: false, message: error.message || 'Erro de conexão com o servidor' };
  }
}
