import React, { useState, useRef, useEffect } from 'react';
import {
  Utensils,
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Link,
  Camera,
  Layers,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
  Send,
  MessageSquare,
  Wand2,
  Music,
  Mic,
  Maximize2,
  ArrowRight,
  ExternalLink,
  Film,
  Zap,
  Upload,
  Image as ImageIcon,
  Flame,
  Share2,
  Heart,
  Bookmark,
} from 'lucide-react';
import {
  RecipeProject,
  RecipeStep,
  RecipeStepType,
  EquipmentStation,
  FixedAnchors,
  CulinarySfx,
} from '../types';
import {
  initialRecipeProject,
  pastaShrimpRecipeProject,
  croquetesAirFryerRecipeProject,
  paoQueijoAirFryerRecipeProject,
  escondidinhoAirfryerRecipeProject,
  sampleRecipeProjects,
} from '../data/sampleRecipes';
import { audioEngine } from '../utils/audioSynth';
import {
  generateShotImage,
  createVideoTask,
  pollVideoStatus,
  generateRecipeWorkflowWithAgnes,
  buildPromptWithFixedAnchors,
} from '../services/agnesApi';
import { stitchLongVideo } from '../utils/videoStitcher';
import { AutoPilotModal } from './AutoPilotModal';

interface RecipeStudioViewProps {
  recipe: RecipeProject;
  onUpdateRecipe: React.Dispatch<React.SetStateAction<RecipeProject>>;
  apiKey: string;
  onOpenKeyModal: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onNavigateToPlayer?: () => void;
}

export const STATION_CONFIG: Record<
  EquipmentStation,
  {
    emoji: string;
    label: string;
    sub: string;
    defaultUtensil: string;
    continuityHint: string;
    color: string;
  }
> = {
  cutting_board: {
    emoji: '🪵',
    label: 'Tábua de Corte',
    sub: 'Preparo & Corte',
    defaultUtensil: 'Tábua de corte de madeira rústica e faca de chef de inox',
    continuityHint: 'Corte e lâminas de ingredientes prontos para serem transferidos ao fogo',
    color: 'amber',
  },
  pan_stove: {
    emoji: '🔥',
    label: 'Frigideira no Fogão',
    sub: 'Refogado & Fritura',
    defaultUtensil: 'Frigideira de inox / antiaderente sobre boca do fogão aceso com chama azul',
    continuityHint: 'Ingrediente despejado no azeite quente ou salteando com vapor',
    color: 'orange',
  },
  pot_boiling: {
    emoji: '🍲',
    label: 'Panela Alta',
    sub: 'Fervura & Cozimento',
    defaultUtensil: 'Panela alta com água fervente borbulhante ou molho fervendo no fogão',
    continuityHint: 'Cozimento de massas ou caldos com vapor subindo',
    color: 'sky',
  },
  blender: {
    emoji: '🌪️',
    label: 'Liquidificador / Processador',
    sub: 'Processamento',
    defaultUtensil: 'Jarra de vidro do liquidificador ou copo do processador de alimentos',
    continuityHint: 'Vórtice girando e triturando ingredientes em alta velocidade',
    color: 'teal',
  },
  bowl_prep: {
    emoji: '🥣',
    label: 'Bowl / Tigela',
    sub: 'Mistura & Marinar',
    defaultUtensil: 'Bowl de cerâmica artesanal para mistura e incorporação',
    continuityHint: 'Mistura delicada de massas, cremes ou purês',
    color: 'indigo',
  },
  oven_appliance: {
    emoji: '♨️',
    label: 'Forno / Air Fryer',
    sub: 'Assados & Gratinar',
    defaultUtensil: 'Interior iluminado de forno aquecido ou gaveta da Air Fryer',
    continuityHint: 'Entrada ou saída do aparelho borbulhante e dourado',
    color: 'rose',
  },
  serving_plate: {
    emoji: '🍽️',
    label: 'Prato de Servir',
    sub: 'Empratamento / Hero',
    defaultUtensil: 'Prato fundo de cerâmica artesanal ou prato raso de alta gastronomia',
    continuityHint: 'Mãos com pegador/pinça montando o prato com apresentação gourmet',
    color: 'emerald',
  },
  tasting_fork: {
    emoji: '🍴',
    label: 'Garfada / Prova',
    sub: 'Degustação & Texture',
    defaultUtensil: 'Garfo de inox levantando porção fumegante em close-up macro',
    continuityHint: 'Garfada apetitosa com vapor subindo ou queijo esticando (cheese pull)',
    color: 'purple',
  },
  social_hero: {
    emoji: '📱',
    label: 'Mídia Social & CTA',
    sub: 'Seguir & Salvar',
    defaultUtensil: 'Cenário completo na bancada com prato final e espaço para legenda',
    continuityHint: 'Fechamento com CTA viral convidando a curtir, comentar e seguir',
    color: 'pink',
  },
};

const RECIPE_PROMPT_PRESETS = [
  '🍝 Macarrão ao Alho e Camarão (Tábua ➔ Frigideira ➔ Prato Fundo ➔ Garfada)',
  '🥔 Escondidinho de Batata Cremoso com Carne na Air Fryer',
  '🥩 Risoto de Cogumelos com Filé Mignon (Tábua ➔ Panela ➔ Frigideira ➔ Empratamento)',
  '🍫 Bolo Vulcão de Chocolate com Ganache Quente (Liquidificador ➔ Forma ➔ Forno)',
  '🧀 Pão de Queijo Recheado com Catupiry Dourado',
  '🍟 Batata Rústica Crocante com Páprica na Air Fryer',
];

/**
 * Extracts the last frame of an MP4/WebM video via Canvas, with guaranteed image fallback
 */
export function extractVideoLastFrame(videoUrl?: string, fallbackImageUrl?: string): Promise<string> {
  if (!videoUrl) return Promise.resolve(fallbackImageUrl || '');

  // If already a data url or image, resolve directly
  if (
    videoUrl.startsWith('data:image/') ||
    (!videoUrl.includes('.mp4') && !videoUrl.includes('/videos/') && !videoUrl.includes('sample/'))
  ) {
    return Promise.resolve(videoUrl);
  }

  return new Promise((resolve) => {
    let resolved = false;
    let attempts = 0;

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    // Use proxy for remote URLs to avoid CORS taint on canvas
    const proxyUrl = videoUrl.startsWith('http')
      ? `/api/proxy-media?url=${encodeURIComponent(videoUrl)}`
      : videoUrl;

    const finish = (result: string) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(safetyTimeout);
      video.pause();
      video.removeAttribute('src');
      video.load();
      resolve(result || fallbackImageUrl || '');
    };

    // 8s safety timeout - will fallback to image if network stalls
    const safetyTimeout = setTimeout(() => {
      finish(fallbackImageUrl || '');
    }, 8000);

    const captureFrame = () => {
      try {
        const vW = video.videoWidth || 720;
        const vH = video.videoHeight || 1280;
        if (vW > 0 && vH > 0) {
          const canvas = document.createElement('canvas');
          canvas.width = vW;
          canvas.height = vH;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, vW, vH);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.94);
            if (dataUrl && dataUrl.length > 500 && dataUrl.startsWith('data:image/')) {
              finish(dataUrl);
              return;
            }
          }
        }
      } catch (err) {
        console.warn('Canvas capture error on video last frame:', err);
      }

      if (attempts < 2) {
        attempts++;
        try {
          const dur = isFinite(video.duration) && video.duration > 0 ? video.duration : 3.0;
          video.currentTime = Math.max(0.01, dur - 0.15 * attempts);
          return;
        } catch (_) {}
      }

      finish(fallbackImageUrl || '');
    };

    const doSeekToLastFrame = () => {
      try {
        const dur = isFinite(video.duration) && video.duration > 0 ? video.duration : 3.0;
        // Seek precisely to the final valid frame (duration - 0.05 seconds)
        const targetTime = Math.max(0.01, dur - 0.05);
        if (Math.abs(video.currentTime - targetTime) < 0.02) {
          captureFrame();
        } else {
          video.currentTime = targetTime;
        }
      } catch (_) {
        finish(fallbackImageUrl || '');
      }
    };

    video.onloadedmetadata = () => {
      doSeekToLastFrame();
    };

    video.oncanplay = () => {
      if (video.currentTime === 0) {
        doSeekToLastFrame();
      }
    };

    video.onseeked = () => {
      captureFrame();
    };

    video.onerror = () => {
      finish(fallbackImageUrl || '');
    };

    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = proxyUrl;
  });
}

export const RecipeStudioView: React.FC<RecipeStudioViewProps> = ({
  recipe,
  onUpdateRecipe,
  apiKey,
  onOpenKeyModal,
  showToast,
  onNavigateToPlayer,
}) => {
  // Navigation inside recipe studio
  const [activeSubTab, setActiveSubTab] = useState<'pipeline' | 'chat' | 'player'>('pipeline');

  // AutoPilot Modal State
  const [isAutoPilotModalOpen, setIsAutoPilotModalOpen] = useState(false);

  // In-line Cascade Automation Runner State
  const [isCascadeRunning, setIsCascadeRunning] = useState(false);
  const [cascadeStepIdx, setCascadeStepIdx] = useState<number | null>(null);
  const [cascadeStatusText, setCascadeStatusText] = useState('');

  // Media view modes per step ('image' | 'video' | 'last_frame')
  const [stepViewModes, setStepViewModes] = useState<Record<string, 'image' | 'video' | 'last_frame'>>({});

  // Recently updated step for pulse highlight
  const [highlightedStepId, setHighlightedStepId] = useState<string | null>(null);

  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [stepTimer, setStepTimer] = useState(0);

  // Generation loading states
  const [generatingImages, setGeneratingImages] = useState<Record<string, boolean>>({});
  const [generatingVideos, setGeneratingVideos] = useState<Record<string, boolean>>({});
  const [extractingFrames, setExtractingFrames] = useState<Record<string, boolean>>({});
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);

  // Helper to determine active preview tab for a step
  const getStepViewMode = (step: RecipeStep): 'image' | 'video' | 'last_frame' => {
    if (stepViewModes[step.id]) return stepViewModes[step.id];
    // Default to image if image exists or if no video yet
    if (step.videoUrl) return 'video';
    return 'image';
  };

  // Helper to allow uploading user's own frame/photo
  const handleUploadCustomImage = (stepId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        onUpdateRecipe((prev) => {
          const stepIdx = prev.steps.findIndex((s) => s.id === stepId);
          return {
            ...prev,
            steps: prev.steps.map((s, idx) => {
              if (s.id === stepId) {
                return {
                  ...s,
                  imageUrl: dataUrl,
                  lastFrameUrl: dataUrl,
                  videoUrl: undefined,
                  status: 'completed' as const,
                };
              }
              if (idx === stepIdx + 1 && s.usesLastFrame) {
                return {
                  ...s,
                  referenceImageUrl: dataUrl,
                };
              }
              return s;
            }),
          };
        });
        setStepViewModes((prev) => ({ ...prev, [stepId]: 'image' }));
        showToast('Foto/Frame carregado com sucesso para este passo!', 'success');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Chat state
  const [chatMessages, setChatMessages] = useState<
    { id: string; role: 'user' | 'assistant'; text: string; recipeProposal?: any }[]
  >([
    {
      id: 'welcome_chef',
      role: 'assistant',
      text: 'Olá, Chef! Sou seu especialista em vídeos de receitas virais com a técnica do **Último Frame (Last-Frame Continuity)**. Que prato ou sobremesa você quer produzir hoje?',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [recipeChatStepCount, setRecipeChatStepCount] = useState<number>(8);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Current playing step
  const currentStep: RecipeStep | undefined = recipe.steps[currentStepIdx];
  const stepDuration = currentStep?.durationSeconds || 5;
  const totalRecipeDuration = recipe.steps.reduce((acc, s) => acc + (s.durationSeconds || 5), 0);

  // SFX and TTS Trigger on Step Change
  useEffect(() => {
    if (isPlaying && currentStep) {
      if (currentStep.sfx && currentStep.sfx !== 'none') {
        audioEngine.playSfx(currentStep.sfx);
      }
      if (recipe.enableTts && currentStep.voiceoverText) {
        audioEngine.speak(currentStep.voiceoverText);
      }
    } else {
      audioEngine.stopSpeech();
    }
  }, [isPlaying, currentStepIdx]);

  // Master Playback Timer - increments timer smoothly at 100ms
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setStepTimer((prev) => Math.round((prev + 0.1) * 10) / 10);
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Deterministic step advancement without double-triggering in StrictMode
  useEffect(() => {
    if (!isPlaying) return;
    if (stepTimer >= stepDuration) {
      setStepTimer(0);
      if (currentStepIdx < recipe.steps.length - 1) {
        setCurrentStepIdx((prev) => prev + 1);
      } else {
        // Reached end of recipe: stop and loop back to start
        setIsPlaying(false);
        setCurrentStepIdx(0);
      }
    }
  }, [stepTimer, stepDuration, isPlaying, recipe.steps.length, currentStepIdx]);

  // Sync HTML5 video element with isPlaying state and step changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.currentTime = 0;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Recipe video play notice:', err);
        });
      }
    } else {
      video.pause();
    }
  }, [isPlaying, currentStepIdx, currentStep?.videoUrl]);

  // Update a single step using functional state updater
  const handleUpdateStep = (updated: RecipeStep) => {
    onUpdateRecipe((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => (s.id === updated.id ? updated : s)),
    }));
  };

  // Add specific step type or station with tailored prompts and continuous framing
  const handleAddSpecificStep = (
    type: RecipeStepType = 'preparation',
    station?: EquipmentStation
  ) => {
    const nextNum = recipe.steps.length + 1;
    const prevStep = recipe.steps[recipe.steps.length - 1];
    const inheritedRef = prevStep?.lastFrameUrl || prevStep?.imageUrl;

    const handAnchor =
      recipe.fixedAnchors?.handAnchor ||
      recipe.handStyle ||
      'Mãos cuidadas do cozinheiro com unhas vermelhas e anel discreto';
    const countertopAnchor =
      recipe.fixedAnchors?.countertopAnchor ||
      recipe.surfaceStyle ||
      'Bancada de madeira rústica de carvalho com azulejos claros ao fundo';
    const lightingAnchor =
      recipe.fixedAnchors?.lightingAnchor ||
      'Iluminação suave difusa de janela matinal 5600K com reflexos dourados e vapor natural';
    const styleAnchor =
      recipe.fixedAnchors?.styleAnchor ||
      'Comercial gastronômico de alta gastronomia, apetitoso em altíssima definição 8k';

    let resolvedStation: EquipmentStation = station || 'bowl_prep';
    let actionTitle = `Passo ${String(nextNum).padStart(2, '0')}: Próxima Ação Culinária`;
    let instruction = 'Descreva a etapa culinária...';
    let voiceoverText = 'Agora acrescente o próximo ingrediente e misture delicadamente.';
    let sfx: CulinarySfx = 'stir';
    let utensil = 'Utensílio adequado para esta etapa';
    let continuityRule = 'Regra de Ouro: Ingrediente transferido mantendo mãos e luz 100% fiéis';
    let continuityNote = 'Continuidade da ação gastronômica da tomada anterior';

    if (type === 'prep_cutting' || station === 'cutting_board') {
      resolvedStation = 'cutting_board';
      type = 'prep_cutting';
      actionTitle = `Tomada ${nextNum}: Cortar Ingredientes (Tábua de Madeira)`;
      instruction = 'Fatie os ingredientes na tábua de madeira rústica com a faca de chef.';
      voiceoverText = 'Comece fatiando finamente os temperos frescos na nossa tábua de madeira.';
      sfx = 'chop';
      utensil = 'Tábua de corte de madeira rústica e faca de chef de inox';
      continuityRule = 'Ponto de partida visual: fixa mãos, unhas e bancada para as próximas tomadas';
      continuityNote = 'Corte de ingredientes que serão transferidos para o fogo na tomada seguinte';
    } else if (type === 'saute_frying' || station === 'pan_stove') {
      resolvedStation = 'pan_stove';
      type = 'saute_frying';
      actionTitle = `Tomada ${nextNum}: Transição para o Fogão (Frigideira no Fogo)`;
      instruction = 'Despeje o azeite e os ingredientes fatiados na frigideira quente no fogão aceso.';
      voiceoverText = 'Agora vamos para o fogão: azeite quente e os ingredientes para dourar e perfumar!';
      sfx = 'sizzle';
      utensil = 'Frigideira de inox / antiaderente sobre o fogão aceso com chama azul';
      continuityRule = 'Regra de Ouro: A IA pega o ingrediente fatiado do frame anterior e o joga na frigideira quente';
      continuityNote = 'Ingrediente fatiado transferido diretamente para a frigideira quente';
    } else if (type === 'boil_simmer' || station === 'pot_boiling') {
      resolvedStation = 'pot_boiling';
      type = 'boil_simmer';
      actionTitle = `Tomada ${nextNum}: Cozimento em Panela Alta (Fervura)`;
      instruction = 'Mergulhe os ingredientes na panela alta com água fervente borbulhante.';
      voiceoverText = 'Água fervendo com vigor, entram os ingredientes para o cozimento perfeito al dente!';
      sfx = 'stir';
      utensil = 'Panela alta com água fervendo borbulhante e vapor aromático';
      continuityRule = 'Regra de Ouro: Ingrediente cozinhando em água borbulhante mantendo o mesmo cozinheiro';
      continuityNote = 'Cozimento de massa ou caldo que será incorporado ao molho';
    } else if (type === 'blender_process' || station === 'blender') {
      resolvedStation = 'blender';
      type = 'blender_process';
      actionTitle = `Tomada ${nextNum}: Processar no Liquidificador`;
      instruction = 'Bata os ingredientes no liquidificador até obter um creme sedoso e homogêneo.';
      voiceoverText = 'Bata tudo no liquidificador até atingir essa textura super cremosa e aveludada!';
      sfx = 'stir';
      utensil = 'Jarra de vidro do liquidificador / processador em alta velocidade';
      continuityRule = 'Regra de Ouro: Ingredientes batidos transformando-se em creme líquido sedoso';
      continuityNote = 'Transformação da textura do alimento no liquidificador';
    } else if (type === 'appliance_enter' || station === 'oven_appliance') {
      resolvedStation = 'oven_appliance';
      type = 'appliance_enter';
      actionTitle = `Tomada ${nextNum}: Levando ao Forno / Air Fryer`;
      instruction = 'Coloque o prato dentro do micro-ondas, forno ou Air Fryer e feche com atenção ao último frame.';
      voiceoverText = 'Agora leve direto pro forno ou Air Fryer até gratinar e ficar borbulhante!';
      sfx = 'timer_ding';
      utensil = 'Interior aquecido e iluminado do forno / Air Fryer';
      continuityRule = 'Regra de Ouro: O frame final congela na entrada do aparelho para sair dourado no próximo';
      continuityNote = 'Entrada no aparelho: a próxima tomada começa abrindo com o prato já cozido e borbulhante';
    } else if (type === 'appliance_exit') {
      resolvedStation = 'oven_appliance';
      type = 'appliance_exit';
      actionTitle = `Tomada ${nextNum}: Retirando do Aparelho (Dourado & Fumegante)`;
      instruction = 'Abra o aparelho e retire o prato borbulhante e cozido de volta para a bancada.';
      voiceoverText = 'Olha só como sai: super quente, borbulhando e com um aroma que toma conta da cozinha!';
      sfx = 'sizzle';
      utensil = 'Interior do aparelho abrindo e prato saindo fumegante para a bancada';
      continuityRule = 'Regra de Ouro: Continuidade da saída do aparelho diretamente para a bancada de madeira';
      continuityNote = 'Retirada do prato quente de volta para a bancada com as mesmas mãos';
    } else if (type === 'plated_hero' || station === 'serving_plate') {
      resolvedStation = 'serving_plate';
      type = 'plated_hero';
      actionTitle = `Tomada ${nextNum}: Montagem do Prato (Prato Fundo de Cerâmica)`;
      instruction = 'Use a pinça culinária para retirar a comida da frigideira e empratar no prato fundo.';
      voiceoverText = 'Agora emprate com elegância em um prato fundo de cerâmica e finalize com ervas frescas.';
      sfx = 'stir';
      utensil = 'Pegador / pinça culinária transferindo comida da frigideira para o prato fundo de cerâmica';
      continuityRule = 'Regra de Ouro: Transferência da frigideira para o prato de servir usando pinça culinária';
      continuityNote = 'Mãos usando pegador para tirar o alimento da panela e empratar com estilo';
    } else if (type === 'tasting' || station === 'tasting_fork') {
      resolvedStation = 'tasting_fork';
      type = 'tasting';
      actionTitle = `Tomada ${nextNum}: Garfada & Degustação (Close-up Irresistível)`;
      instruction = 'Close-up no garfo levantando a porção fumegante com queijo esticando ou textura apetitosa.';
      voiceoverText = 'Agora a melhor hora: provar essa perfeição! Desmancha na boca, simplesmente divino.';
      sfx = 'sizzle';
      utensil = 'Garfo de inox levantando porção fumegante do prato pronto';
      continuityRule = 'Regra de Ouro: Garfada direta do prato finalizado da tomada anterior';
      continuityNote = 'Close-up macro na garfada saindo do prato montado com vapor suave';
    } else if (type === 'social_cta' || station === 'social_hero') {
      resolvedStation = 'social_hero';
      type = 'social_cta';
      actionTitle = `Tomada ${nextNum}: Chamada para Ação Viral (Seguir & Salvar)`;
      instruction = 'Encerramento com o prato na bancada convidando os seguidores para interagir.';
      voiceoverText = 'Gostou dessa receita prática? Já salva pra fazer hoje, comenta o que achou e me segue para mais dicas deliciosas!';
      sfx = 'timer_ding';
      utensil = 'Prato finalizado na bancada da cozinha com boa iluminação e espaço para CTA';
      continuityRule = 'Regra de Ouro: Prato pronto na bancada servindo de moldura para a chamada final';
      continuityNote = 'Tomada comercial de fechamento com engajamento nas redes sociais';
    }

    const builtPrompts = buildPromptWithFixedAnchors({
      handAnchor,
      countertopAnchor,
      lightingAnchor,
      styleAnchor,
      equipmentStation: resolvedStation,
      utensil,
      actionTitle,
      instruction,
      aspectRatio: recipe.aspectRatio,
      usesLastFrame: true,
    });

    const newStep: RecipeStep = {
      id: `r_step_${Date.now()}`,
      stepNumber: nextNum,
      stepType: type,
      equipmentStation: resolvedStation,
      utensil,
      continuityRule,
      continuityNote,
      actionTitle,
      instruction,
      voiceoverText,
      sfx,
      usesLastFrame: true,
      referenceImageUrl: inheritedRef,
      imagePrompt: builtPrompts.imagePrompt,
      videoPrompt: builtPrompts.videoPrompt,
      durationSeconds: 5,
      numFrames: 121,
      frameRate: 24,
      status: 'idle',
    };

    onUpdateRecipe((prev) => ({
      ...prev,
      steps: [...prev.steps, newStep],
    }));

    showToast(`Tomada ${nextNum} adicionada (${actionTitle.split(':')[1]?.trim() || actionTitle})!`, 'info');

    setTimeout(() => {
      const el = document.getElementById(newStep.id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  };

  // Re-harmonize all steps' prompts with current fixed anchors
  const handleReharmonizeAllPrompts = () => {
    const handAnchor =
      recipe.fixedAnchors?.handAnchor ||
      recipe.handStyle ||
      'Mãos cuidadas do cozinheiro com unhas vermelhas e anel discreto';
    const countertopAnchor =
      recipe.fixedAnchors?.countertopAnchor ||
      recipe.surfaceStyle ||
      'Bancada de carvalho rústico escuro na cozinha com azulejos claros ao fundo';
    const lightingAnchor =
      recipe.fixedAnchors?.lightingAnchor ||
      'Iluminação suave difusa de janela matinal 5600K com reflexos dourados e vapor natural';
    const styleAnchor =
      recipe.fixedAnchors?.styleAnchor ||
      'Comercial gastronômico de alta gastronomia, apetitoso em altíssima definição 8k';

    onUpdateRecipe((prev) => ({
      ...prev,
      steps: prev.steps.map((st, idx) => {
        const built = buildPromptWithFixedAnchors({
          handAnchor,
          countertopAnchor,
          lightingAnchor,
          styleAnchor,
          equipmentStation: st.equipmentStation,
          utensil: st.utensil,
          actionTitle: st.actionTitle,
          instruction: st.instruction,
          aspectRatio: prev.aspectRatio,
          usesLastFrame: idx > 0,
        });
        return {
          ...st,
          imagePrompt: built.imagePrompt,
          videoPrompt: built.videoPrompt,
        };
      }),
    }));

    showToast('✨ Todos os prompts re-harmonizados com as Âncoras Fixas e Utensílios Dinâmicos!', 'success');
  };

  // Re-harmonize a single step prompt
  const handleReharmonizeStepPrompt = (stepId: string) => {
    const step = recipe.steps.find((s) => s.id === stepId);
    if (!step) return;

    const handAnchor =
      recipe.fixedAnchors?.handAnchor ||
      recipe.handStyle ||
      'Mãos cuidadas do cozinheiro com unhas vermelhas e anel discreto';
    const countertopAnchor =
      recipe.fixedAnchors?.countertopAnchor ||
      recipe.surfaceStyle ||
      'Bancada de carvalho rústico escuro na cozinha com azulejos claros ao fundo';
    const lightingAnchor =
      recipe.fixedAnchors?.lightingAnchor ||
      'Iluminação suave difusa de janela matinal 5600K com reflexos dourados e vapor natural';
    const styleAnchor =
      recipe.fixedAnchors?.styleAnchor ||
      'Comercial gastronômico de alta gastronomia, apetitoso em altíssima definição 8k';

    const built = buildPromptWithFixedAnchors({
      handAnchor,
      countertopAnchor,
      lightingAnchor,
      styleAnchor,
      equipmentStation: step.equipmentStation,
      utensil: step.utensil,
      actionTitle: step.actionTitle,
      instruction: step.instruction,
      aspectRatio: recipe.aspectRatio,
      usesLastFrame: step.stepNumber > 1,
    });

    handleUpdateStep({
      ...step,
      imagePrompt: built.imagePrompt,
      videoPrompt: built.videoPrompt,
    });

    showToast(`Prompt da Tomada ${step.stepNumber} re-alinhado com as Âncoras Fixas!`, 'success');
  };

  // Add default step
  const handleAddStep = () => handleAddSpecificStep('preparation');

  // Delete step
  const handleDeleteStep = (stepId: string) => {
    if (recipe.steps.length <= 1) {
      showToast('A receita deve ter ao menos 1 passo.', 'error');
      return;
    }
    onUpdateRecipe((prev) => {
      const filtered = prev.steps.filter((s) => s.id !== stepId);
      const renumbered = filtered.map((s, idx) => ({ ...s, stepNumber: idx + 1 }));
      return { ...prev, steps: renumbered };
    });
    showToast('Passo removido.', 'info');
  };

  // 1. Generate Step Image (Atomic State Update)
  const handleGenerateStepImage = async (stepId: string) => {
    if (!apiKey) {
      onOpenKeyModal();
      showToast('Configure sua Agnes API Key para gerar imagens.', 'error');
      return;
    }

    const step = recipe.steps.find((s) => s.id === stepId);
    if (!step || !step.imagePrompt) return;

    setGeneratingImages((prev) => ({ ...prev, [stepId]: true }));
    handleUpdateStep({ ...step, status: 'image_generating', error: undefined });

    try {
      // If usesLastFrame and has reference, pass it for img2img continuity!
      const refImg = step.usesLastFrame ? step.referenceImageUrl : undefined;
      const imageUrl = await generateShotImage(step.imagePrompt, recipe.aspectRatio, refImg, apiKey);

      // ATOMIC UPDATE: updates this step with imageUrl and lastFrameUrl, and clears old videoUrl so new image stays visible
      onUpdateRecipe((prev) => {
        const stepIdx = prev.steps.findIndex((s) => s.id === stepId);
        const newSteps = prev.steps.map((s, idx) => {
          if (s.id === stepId) {
            return {
              ...s,
              imageUrl,
              lastFrameUrl: imageUrl,
              videoUrl: undefined, // Clear old video so new image is displayed and ready to animate!
              status: 'completed' as const,
              error: undefined,
            };
          }
          // Propagate to next step if it uses last frame
          if (idx === stepIdx + 1 && s.usesLastFrame) {
            return {
              ...s,
              referenceImageUrl: imageUrl,
            };
          }
          return s;
        });

        return {
          ...prev,
          steps: newSteps,
        };
      });

      // Switch view mode for this step to 'image' so it stays on screen!
      setStepViewModes((prev) => ({ ...prev, [stepId]: 'image' }));

      showToast(`Frame do Passo ${step.stepNumber} gerado e pronto! Clique em "2. Animar Ação Culinária em Vídeo".`, 'success');
    } catch (err: any) {
      console.error(err);
      handleUpdateStep({ ...step, status: 'failed', error: err.message });
      showToast(`Erro na imagem: ${err.message}`, 'error');
    } finally {
      setGeneratingImages((prev) => ({ ...prev, [stepId]: false }));
    }
  };

  // 2. Generate Step Video Action
  const handleGenerateStepVideo = async (stepId: string) => {
    if (!apiKey) {
      onOpenKeyModal();
      showToast('Configure sua Agnes API Key para gerar vídeos.', 'error');
      return;
    }

    const step = recipe.steps.find((s) => s.id === stepId);
    if (!step) return;
    const baseImg = step.imageUrl || step.referenceImageUrl;
    if (!baseImg) {
      showToast('Gere primeiro o frame de imagem do passo antes de criar o clipe.', 'error');
      return;
    }

    setGeneratingVideos((prev) => ({ ...prev, [stepId]: true }));
    handleUpdateStep({ ...step, status: 'video_generating', progress: 10, error: undefined });

    try {
      const task = await createVideoTask(
        {
          prompt: step.videoPrompt || 'Cinematic cooking action in slow motion',
          imageUrl: baseImg,
          numFrames: step.numFrames,
          frameRate: step.frameRate,
          aspectRatio: recipe.aspectRatio,
        },
        apiKey
      );

      const videoUrl = await pollVideoStatus(
        task.videoId,
        task.taskId,
        (prog) => {
          onUpdateRecipe((prev) => ({
            ...prev,
            steps: prev.steps.map((s) => (s.id === stepId ? { ...s, progress: prog } : s)),
          }));
        },
        apiKey
      );

      // Extract last frame from generated video automatically
      let lastFrameExtracted = baseImg;
      try {
        lastFrameExtracted = await extractVideoLastFrame(videoUrl, baseImg);
      } catch (e) {
        console.warn('Could not extract video last frame:', e);
      }

      // ATOMIC UPDATE FOR VIDEO & LAST FRAME PROPAGATION:
      onUpdateRecipe((prev) => {
        const stepIdx = prev.steps.findIndex((s) => s.id === stepId);
        const newSteps = prev.steps.map((s, idx) => {
          if (s.id === stepId) {
            return {
              ...s,
              videoUrl,
              lastFrameUrl: lastFrameExtracted,
              status: 'completed' as const,
              progress: 100,
            };
          }
          if (idx === stepIdx + 1 && s.usesLastFrame) {
            return {
              ...s,
              referenceImageUrl: lastFrameExtracted,
            };
          }
          return s;
        });

        return {
          ...prev,
          steps: newSteps,
        };
      });

      // Switch view mode to video so user can preview it immediately
      setStepViewModes((prev) => ({ ...prev, [stepId]: 'video' }));

      showToast(`Vídeo do Passo ${step.stepNumber} gerado e último frame extraído!`, 'success');
    } catch (err: any) {
      console.error(err);
      handleUpdateStep({ ...step, status: 'failed', error: err.message });
      showToast(`Erro no vídeo: ${err.message}`, 'error');
    } finally {
      setGeneratingVideos((prev) => ({ ...prev, [stepId]: false }));
    }
  };

  // 2.5. Sequential Cascade Automation Runner across all steps
  const handleRunCascadeAutomationOnCurrentSteps = async () => {
    if (!apiKey) {
      onOpenKeyModal();
      showToast('Configure sua Agnes API Key para executar a automação.', 'error');
      return;
    }

    setIsCascadeRunning(true);
    showToast('🚀 Iniciando Automação em Cascata de todas as tomadas!', 'info');

    try {
      let currentLastFrame: string | undefined = undefined;

      for (let i = 0; i < recipe.steps.length; i++) {
        setCascadeStepIdx(i);
        const step = recipe.steps[i];
        const stepNum = i + 1;

        // Propagate last frame from previous step if applicable
        if (i > 0 && currentLastFrame) {
          step.referenceImageUrl = currentLastFrame;
          step.usesLastFrame = true;
        }

        // 1. Image generation if missing
        let stepImage = step.imageUrl;
        if (!stepImage) {
          setCascadeStatusText(`Tomada ${stepNum}/${recipe.steps.length}: Gerando frame fotográfico...`);
          stepImage = await generateShotImage(
            step.imagePrompt,
            recipe.aspectRatio,
            step.usesLastFrame ? step.referenceImageUrl : undefined,
            apiKey
          );
          step.imageUrl = stepImage;
          step.lastFrameUrl = stepImage;
          onUpdateRecipe((prev) => ({
            ...prev,
            steps: prev.steps.map((s, idx) => (idx === i ? { ...s, imageUrl: stepImage, lastFrameUrl: stepImage } : s)),
          }));
        }

        // 2. Video generation if missing
        let stepVideo = step.videoUrl;
        if (!stepVideo && stepImage) {
          setCascadeStatusText(`Tomada ${stepNum}/${recipe.steps.length}: Animando vídeo culinário...`);
          const task = await createVideoTask(
            {
              prompt: step.videoPrompt || 'Cinematic cooking dynamics in slow motion',
              imageUrl: stepImage,
              numFrames: step.numFrames || 121,
              frameRate: step.frameRate || 24,
              aspectRatio: recipe.aspectRatio,
            },
            apiKey
          );
          stepVideo = await pollVideoStatus(task.videoId, task.taskId, undefined, apiKey);
          step.videoUrl = stepVideo;
          onUpdateRecipe((prev) => ({
            ...prev,
            steps: prev.steps.map((s, idx) => (idx === i ? { ...s, videoUrl: stepVideo, status: 'completed' } : s)),
          }));
        }

        // 3. Extract last frame from video or fallback to image
        setCascadeStatusText(`Tomada ${stepNum}/${recipe.steps.length}: Extraindo Último Frame com Canvas...`);
        let extracted = stepImage;
        if (stepVideo) {
          try {
            extracted = await extractVideoLastFrame(stepVideo, stepImage);
          } catch (_) {
            extracted = stepImage;
          }
        }
        step.lastFrameUrl = extracted;
        currentLastFrame = extracted;

        onUpdateRecipe((prev) => ({
          ...prev,
          steps: prev.steps.map((s, idx) => {
            if (idx === i) return { ...s, lastFrameUrl: extracted };
            if (idx === i + 1 && s.usesLastFrame) return { ...s, referenceImageUrl: extracted };
            return s;
          }),
        }));
      }

      showToast('🎉 Todas as tomadas foram geradas e encadeadas automaticamente com sucesso!', 'success');
    } catch (err: any) {
      console.error(err);
      showToast(`Erro na automação: ${err.message}`, 'error');
    } finally {
      setIsCascadeRunning(false);
      setCascadeStepIdx(null);
      setCascadeStatusText('');
    }
  };

  // 3. Robust Last-Frame Capturer & Sender to Next Step
  const handleCaptureAndSendToNext = async (stepId: string, captureCurrentInstant: boolean = false) => {
    const step = recipe.steps.find((s) => s.id === stepId);
    if (!step) return;

    const sourceAvailable = step.videoUrl || step.imageUrl || step.referenceImageUrl;
    if (!sourceAvailable) {
      showToast('Gere a imagem ou o vídeo primeiro para extrair o frame.', 'error');
      return;
    }

    setExtractingFrames((prev) => ({ ...prev, [stepId]: true }));
    try {
      let finalFrame = step.imageUrl || step.referenceImageUrl || '';

      // 1. Try direct DOM canvas capture from active <video> if available
      const activeVideoEl = document.querySelector(`video[data-step-id="${stepId}"]`) as HTMLVideoElement | null;
      let domCaptured = false;
      if (activeVideoEl && !activeVideoEl.error && activeVideoEl.videoWidth > 0) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = activeVideoEl.videoWidth;
          canvas.height = activeVideoEl.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(activeVideoEl, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
            if (dataUrl && dataUrl.startsWith('data:image/')) {
              finalFrame = dataUrl;
              domCaptured = true;
            }
          }
        } catch (e) {
          console.warn('Direct DOM video snapshot error:', e);
        }
      }

      // 2. If not captured from DOM and videoUrl exists:
      if (!domCaptured && step.videoUrl) {
        finalFrame = await extractVideoLastFrame(step.videoUrl, step.imageUrl || step.referenceImageUrl);
      }

      // Safety: NEVER allow .mp4 URL as a frame image!
      if (!finalFrame || finalFrame.endsWith('.mp4') || finalFrame.includes('/videos/')) {
        finalFrame = step.imageUrl || step.referenceImageUrl || finalFrame;
      }

      const stepIdx = recipe.steps.findIndex((s) => s.id === stepId);
      const isLastStep = stepIdx === recipe.steps.length - 1;

      if (isLastStep) {
        // Automatically create next step with the captured frame!
        const nextNum = recipe.steps.length + 1;
        const newStepId = `r_step_${Date.now()}`;
        const newStep: RecipeStep = {
          id: newStepId,
          stepNumber: nextNum,
          actionTitle: `Passo ${String(nextNum).padStart(2, '0')}: Próxima Ação Culinária`,
          instruction: 'Descreva a continuação do preparo...',
          voiceoverText: 'Agora acrescente o próximo ingrediente e continue misturando com carinho.',
          sfx: 'stir',
          usesLastFrame: true,
          referenceImageUrl: finalFrame,
          imageUrl: finalFrame, // Pre-loads into imageUrl so user sees it right away!
          lastFrameUrl: finalFrame,
          imagePrompt: `Cinematic culinary close-up shot continuing directly from previous step, ${recipe.handStyle} in ${recipe.bowlStyle} on ${recipe.surfaceStyle}, appetizing 8k`,
          videoPrompt: `Hands smoothly continuing preparation in the same bowl, natural culinary dynamics, steam rising`,
          durationSeconds: 5,
          numFrames: 121,
          frameRate: 24,
          status: 'idle',
        };

        onUpdateRecipe((prev) => ({
          ...prev,
          steps: [
            ...prev.steps.map((s) => (s.id === stepId ? { ...s, lastFrameUrl: finalFrame } : s)),
            newStep,
          ],
        }));

        setStepViewModes((prev) => ({ ...prev, [stepId]: 'last_frame', [newStepId]: 'image' }));
        setHighlightedStepId(newStepId);
        setTimeout(() => setHighlightedStepId(null), 4000);

        showToast(`🎯 Último frame capturado! Passo ${nextNum} criado automaticamente com o frame de continuidade.`, 'success');

        setTimeout(() => {
          const el = document.getElementById(newStepId);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
      } else {
        // Next step already exists: send frame directly to it!
        const nextStep = recipe.steps[stepIdx + 1];
        onUpdateRecipe((prev) => {
          return {
            ...prev,
            steps: prev.steps.map((s, idx) => {
              if (s.id === stepId) {
                return {
                  ...s,
                  lastFrameUrl: finalFrame,
                };
              }
              if (idx === stepIdx + 1) {
                return {
                  ...s,
                  usesLastFrame: true,
                  referenceImageUrl: finalFrame,
                  imageUrl: finalFrame, // Load directly so preview immediately shows it!
                  videoUrl: undefined, // Clear old video on next step so new frame is prominent and ready to animate!
                  lastFrameUrl: finalFrame,
                };
              }
              return s;
            }),
          };
        });

        setStepViewModes((prev) => ({ ...prev, [stepId]: 'last_frame', [nextStep.id]: 'image' }));
        setHighlightedStepId(nextStep.id);
        setTimeout(() => setHighlightedStepId(null), 4000);

        showToast(`🎯 Último frame capturado e enviado para o Passo ${nextStep.stepNumber}! A cena continua deste exato momento.`, 'success');

        setTimeout(() => {
          const el = document.getElementById(nextStep.id);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
      }
    } catch (err: any) {
      showToast(`Falha ao extrair frame: ${err.message}`, 'error');
    } finally {
      setExtractingFrames((prev) => ({ ...prev, [stepId]: false }));
    }
  };

  // Backwards compatible alias
  const handleExtractLastFrameManually = (stepId: string) => handleCaptureAndSendToNext(stepId, false);

  // Send Recipe Idea Chat Message to Agnes 2.5 Flash
  const handleSendRecipeChat = async (promptToSend?: string) => {
    const text = (promptToSend || chatInput).trim();
    if (!text || isChatLoading) return;

    const userMsg = { id: `u_${Date.now()}`, role: 'user' as const, text };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const res = await generateRecipeWorkflowWithAgnes(
        {
          recipeNameOrIdea: text,
          stepCount: recipeChatStepCount,
          aspectRatio: recipe.aspectRatio,
          handStyle: recipe.handStyle,
          bowlStyle: recipe.bowlStyle,
          surfaceStyle: recipe.surfaceStyle,
        },
        apiKey
      );

      const aiMsg = {
        id: `a_${Date.now()}`,
        role: 'assistant' as const,
        text: `Criei uma proposta completa para **${res.title}** (${res.category}, ${res.prepTime}) com ${res.steps.length} passos planejados pela técnica do Último Frame (incluindo prato pronto e chamada para redes sociais)!`,
        recipeProposal: res,
      };

      setChatMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      console.error(err);
      if (!apiKey && (err.message?.includes('chave') || err.message?.includes('key') || err.message?.includes('401'))) {
        onOpenKeyModal();
      }
      setChatMessages((prev) => [
        ...prev,
        {
          id: `a_err_${Date.now()}`,
          role: 'assistant' as const,
          text: `Erro ao gerar receita: ${err.message}. Verifique sua conexão ou configurações da API.`,
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Apply generated recipe to Studio
  const handleApplyRecipeProposal = (proposal: any) => {
    const totalCount = proposal.steps.length;
    const newSteps: RecipeStep[] = proposal.steps.map((st: any, idx: number) => {
      // Intelligently infer stepType if not provided
      let inferredType: RecipeStepType = st.stepType || 'preparation';
      if (!st.stepType) {
        if (idx === totalCount - 1) inferredType = 'social_cta';
        else if (idx === totalCount - 2) inferredType = 'tasting';
        else if (st.actionTitle?.toLowerCase().includes('micro-ondas') || st.actionTitle?.toLowerCase().includes('forno')) {
          inferredType = 'appliance_enter';
        } else if (st.actionTitle?.toLowerCase().includes('cortar') || st.actionTitle?.toLowerCase().includes('tábua')) {
          inferredType = 'prep_cutting';
        } else if (st.actionTitle?.toLowerCase().includes('frigideira') || st.actionTitle?.toLowerCase().includes('fogão')) {
          inferredType = 'saute_frying';
        }
      }

      let inferredStation: EquipmentStation = st.equipmentStation || 'bowl_prep';
      if (!st.equipmentStation) {
        if (inferredType === 'prep_cutting') inferredStation = 'cutting_board';
        else if (inferredType === 'saute_frying') inferredStation = 'pan_stove';
        else if (inferredType === 'boil_simmer') inferredStation = 'pot_boiling';
        else if (inferredType === 'blender_process') inferredStation = 'blender';
        else if (inferredType === 'appliance_enter' || inferredType === 'appliance_exit') inferredStation = 'oven_appliance';
        else if (inferredType === 'plated_hero') inferredStation = 'serving_plate';
        else if (inferredType === 'tasting') inferredStation = 'tasting_fork';
        else if (inferredType === 'social_cta') inferredStation = 'social_hero';
      }

      return {
        id: `r_step_${Date.now()}_${idx}`,
        stepNumber: idx + 1,
        stepType: inferredType,
        equipmentStation: inferredStation,
        utensil: st.utensil || STATION_CONFIG[inferredStation]?.defaultUtensil || 'Utensílio gourmet',
        continuityRule: st.continuityRule || 'Regra de Ouro: Ingrediente transferido mantendo mãos e luz 100% fiéis',
        continuityNote: st.continuityNote || 'Continuidade da etapa gastronômica anterior',
        actionTitle: st.actionTitle,
        instruction: st.instruction,
        voiceoverText: st.voiceoverText,
        sfx: st.sfx || 'stir',
        usesLastFrame: idx > 0,
        imagePrompt: st.imagePrompt,
        videoPrompt: st.videoPrompt,
        durationSeconds: st.durationSeconds || 5,
        numFrames: 121,
        frameRate: 24,
        status: 'idle',
      };
    });

    onUpdateRecipe((prev) => ({
      ...prev,
      title: proposal.title,
      category: proposal.category,
      prepTime: proposal.prepTime,
      fixedAnchors: proposal.fixedAnchors || prev.fixedAnchors || {
        handAnchor: proposal.handStyle || prev.handStyle,
        countertopAnchor: proposal.surfaceStyle || prev.surfaceStyle,
        lightingAnchor: 'Iluminação suave difusa de janela matinal 5600K com vapor natural',
        styleAnchor: 'Fotografia gastronômica comercial 8k, apetitosa e natural',
      },
      handStyle: proposal.handStyle || prev.handStyle,
      bowlStyle: proposal.bowlStyle || prev.bowlStyle,
      surfaceStyle: proposal.surfaceStyle || prev.surfaceStyle,
      steps: newSteps,
    }));

    setActiveSubTab('pipeline');
    showToast(`Receita "${proposal.title}" aplicada ao estúdio com ${newSteps.length} passos!`, 'success');
  };

  // Export full recipe long video
  const handleExportRecipeVideo = async () => {
    const validSteps = recipe.steps.filter((s) => s.imageUrl || s.videoUrl);
    if (validSteps.length === 0) {
      showToast('Gere os frames ou vídeos dos passos antes de exportar.', 'error');
      return;
    }

    setIsExporting(true);
    setExportProgress(10);

    try {
      const tempProject: any = {
        title: recipe.title,
        aspectRatio: recipe.aspectRatio,
        bgMusic: recipe.bgMusic || 'lofi_kitchen',
        shots: recipe.steps.map((s) => ({
          ...s,
          title: `Passo ${s.stepNumber}: ${s.actionTitle}`,
          transitionToNext: 'crossfade',
        })),
      };

      const blob = await stitchLongVideo(
        tempProject,
        (p) => {
          setExportProgress(p.percent);
        },
        {
          enableMusic: true,
          enableSfx: true,
          enableVoiceover: recipe.enableTts,
          musicVolume: 0.28,
          sfxVolume: 0.45,
        }
      );

      const url = URL.createObjectURL(blob);
      setExportedUrl(url);
      showToast('Vídeo final da receita compilado com sucesso!', 'success');
    } catch (err: any) {
      console.error(err);
      showToast(`Erro na compilação: ${err.message}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner explaining the Last-Frame Pipeline & Presets */}
      <div className="bg-[#0e1422] border border-amber-500/30 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        {/* Preset Selector Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-800/90">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Receitas Demonstrativas em Destaque:</span>
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                onUpdateRecipe(pastaShrimpRecipeProject);
                setCurrentStepIdx(0);
                setStepTimer(0);
                setIsPlaying(false);
                showToast('Demonstração Oficial carregada: Macarrão com Alho e Camarão (5 Tomadas Fluidas)!', 'success');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                recipe.id.includes('pasta_shrimp')
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-extrabold ring-1 ring-amber-300'
                  : 'bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-amber-400'
              }`}
            >
              <span>🍝</span>
              <span>Macarrão com Alho e Camarão (Múltiplos Utensílios ⭐)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onUpdateRecipe(escondidinhoAirfryerRecipeProject);
                setCurrentStepIdx(0);
                setStepTimer(0);
                setIsPlaying(false);
                showToast('Demonstração carregada: Escondidinho na Air Fryer!', 'info');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                recipe.id.includes('escondidinho')
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-extrabold ring-1 ring-amber-300'
                  : 'bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-amber-400'
              }`}
            >
              <span>🥔</span>
              <span>Escondidinho na Air Fryer</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
              <Utensils className="w-3.5 h-3.5" />
              <span>ESTÚDIO DE CULINÁRIA FLUIDA COM IA</span>
              <span>·</span>
              <span className="text-slate-400">{recipe.aspectRatio} Vertical</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 flex-wrap">
              <span>{recipe.title}</span>
              <span className="text-xs font-normal text-amber-300 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded-full">
                {recipe.category} ({recipe.prepTime})
              </span>
            </h2>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              <strong>Arquitetura Fluida e Natural:</strong> Para não prender o vídeo a uma única tigela, as <strong>Âncoras Fixas</strong> (mãos, bancada e iluminação) permanecem fiéis, enquanto os <strong>Utensílios Dinâmicos</strong> transitam naturalmente (tábua ➔ frigideira no fogão ➔ prato de servir ➔ degustação com CTA).
            </p>
          </div>

          {/* Quick Sub-Tabs */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => setIsAutoPilotModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-xl bg-gradient-to-r from-amber-400 via-orange-500 to-amber-300 text-slate-950 hover:brightness-110 shadow-lg shadow-amber-500/25 ring-2 ring-amber-300/80 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 fill-slate-950 animate-bounce" />
              <span>⚡ PILOTO AUTOMÁTICO</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('pipeline')}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-all ${
                activeSubTab === 'pipeline'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              Passos da Receita ({recipe.steps.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('chat')}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl border transition-all ${
                activeSubTab === 'chat'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 border-slate-800 text-amber-300 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chef IA (Novas Receitas)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveSubTab('player');
                setCurrentStepIdx(0);
                setStepTimer(0);
                setIsPlaying(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 hover:from-amber-300 hover:to-orange-300 transition-all shadow-md shadow-amber-500/10 cursor-pointer"
              title="Iniciar reprodução contínua da receita com vídeo e voz desde o primeiro passo"
            >
              <Play className="w-3.5 h-3.5 fill-slate-950" />
              <span>Ver Vídeo com Voz ({totalRecipeDuration}s)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (window.confirm('Deseja recarregar o projeto demonstrativo oficial com todos os 5 passos fluidos prontos?')) {
                  onUpdateRecipe(initialRecipeProject);
                  setCurrentStepIdx(0);
                  setStepTimer(0);
                  setIsPlaying(false);
                  showToast('Demonstração oficial restaurada com sucesso!', 'success');
                }
              }}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
              title="Restaurar Demonstração Oficial"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Presets Rápidos com Suporte a SynthID & Last-Frame Chain */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto text-[11px] pb-1">
          <span className="text-slate-400 font-bold shrink-0 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Presets Demonstrativos:</span>
          </span>

          <button
            type="button"
            onClick={() => {
              onUpdateRecipe(croquetesAirFryerRecipeProject);
              setCurrentStepIdx(0);
              setStepTimer(0);
              setIsPlaying(false);
              showToast('🍗 Preset Mestre "Croquetes de Frango na Air Fryer (8 Passos / Last-Frame Perfeito)" carregado!', 'success');
            }}
            className={`px-3 py-1 rounded-lg border font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              recipe.id === 'recipe_croquetes_airfryer_8steps'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                : 'bg-slate-900 border-slate-800 text-amber-300 hover:border-amber-500/80'
            }`}
          >
            <span>🍗 Croquetes Air Fryer (8 Passos Mestre / Last-Frame)</span>
            <span className="px-1.5 py-0.2 bg-amber-950/80 text-[10px] text-amber-300 rounded border border-amber-600/40">20s</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onUpdateRecipe(paoQueijoAirFryerRecipeProject);
              setCurrentStepIdx(0);
              setStepTimer(0);
              setIsPlaying(false);
              showToast('🧀 Preset "Pão de Queijo na Air Fryer (13s Viral / 7 Cenas)" carregado!', 'success');
            }}
            className={`px-3 py-1 rounded-lg border font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              recipe.id === 'recipe_pao_queijo_airfryer_7scenes'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                : 'bg-slate-900 border-slate-800 text-amber-300 hover:border-amber-600/60'
            }`}
          >
            <span>🧀 Pão de Queijo Air Fryer (13s / 7 Cenas SynthID)</span>
            <span className="px-1.5 py-0.2 bg-amber-950/80 text-[10px] text-amber-300 rounded border border-amber-600/40">13s</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onUpdateRecipe(pastaShrimpRecipeProject);
              setCurrentStepIdx(0);
              setStepTimer(0);
              setIsPlaying(false);
              showToast('🍝 Preset "Macarrão com Alho e Camarão (5 Postos)" carregado!', 'success');
            }}
            className={`px-3 py-1 rounded-lg border font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              recipe.id === 'recipe_pasta_shrimp_multi_utensil_01'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <span>🍝 Macarrão c/ Camarão (5 Postos)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onUpdateRecipe(escondidinhoAirfryerRecipeProject);
              setCurrentStepIdx(0);
              setStepTimer(0);
              setIsPlaying(false);
              showToast('🥔 Preset "Escondidinho na Air Fryer" carregado!', 'success');
            }}
            className={`px-3 py-1 rounded-lg border font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              recipe.id === 'recipe_escondidinho_airfryer_01'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <span>🥔 Escondidinho Air Fryer</span>
          </button>
        </div>

        {/* Visual Pipeline Flowchart: Multi-Utensil Station Progression */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto text-[11px] font-mono text-slate-400 pb-1">
          <span className="text-amber-400 font-bold shrink-0">Progressão de Postos:</span>
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 shrink-0 text-amber-300">
            🪵 1. Tábua de Corte
          </span>
          <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 shrink-0 text-orange-300">
            🔥 2. Frigideira no Fogão
          </span>
          <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 shrink-0 text-orange-300">
            🍤 3. Adicionar Proteína
          </span>
          <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 shrink-0 text-emerald-300">
            🍽️ 4. Empratamento Fundo
          </span>
          <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
          <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-700/80 text-amber-300 font-bold shrink-0">
            🍴 5. Garfada + CTA Viral
          </span>
        </div>
      </div>

      {/* SUB-TAB 1: RECIPE PIPELINE & STEP CARDS */}
      {activeSubTab === 'pipeline' && (
        <div className="space-y-6">
          {/* Consistency Anchor Settings & Dynamic Utensils Card */}
          <div className="bg-[#0e1422] border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-2">
                  <Link className="w-3.5 h-3.5 text-amber-400" />
                  <span>Âncoras Fixas vs. Utensílios Dinâmicos (Arquitetura Fluida)</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  As âncoras fixas permanecem em 100% dos prompts, garantindo as mesmas mãos e a mesma iluminação enquanto os utensílios mudam organicamente.
                </p>
              </div>

              <button
                type="button"
                onClick={handleReharmonizeAllPrompts}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm shrink-0"
                title="Aplica as âncoras fixas atuais a todos os prompts da receita"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Re-harmonizar Todos os Prompts</span>
              </button>
            </div>

            {/* Anchors Editor Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-amber-300/90 mb-1 flex items-center gap-1">
                  <span>🔒 1. Mãos do Cozinheiro (Fixas)</span>
                </label>
                <input
                  type="text"
                  value={recipe.fixedAnchors?.handAnchor || recipe.handStyle}
                  onChange={(e) => {
                    const val = e.target.value;
                    onUpdateRecipe((prev) => ({
                      ...prev,
                      handStyle: val,
                      fixedAnchors: {
                        ...(prev.fixedAnchors || {
                          handAnchor: val,
                          countertopAnchor: prev.surfaceStyle,
                          lightingAnchor: 'Iluminação suave difusa 5600K',
                          styleAnchor: 'Gastronômico 8k',
                        }),
                        handAnchor: val,
                      },
                    }));
                  }}
                  placeholder="Ex: Mãos cuidadas com unhas vermelhas e anel dourado discreto"
                  className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700/80 rounded-xl text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-amber-300/90 mb-1 flex items-center gap-1">
                  <span>🔒 2. Bancada da Cozinha (Fixa)</span>
                </label>
                <input
                  type="text"
                  value={recipe.fixedAnchors?.countertopAnchor || recipe.surfaceStyle}
                  onChange={(e) => {
                    const val = e.target.value;
                    onUpdateRecipe((prev) => ({
                      ...prev,
                      surfaceStyle: val,
                      fixedAnchors: {
                        ...(prev.fixedAnchors || {
                          handAnchor: prev.handStyle,
                          countertopAnchor: val,
                          lightingAnchor: 'Iluminação suave difusa 5600K',
                          styleAnchor: 'Gastronômico 8k',
                        }),
                        countertopAnchor: val,
                      },
                    }));
                  }}
                  placeholder="Ex: Bancada de carvalho rústico escuro com azulejos claros"
                  className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700/80 rounded-xl text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-amber-300/90 mb-1 flex items-center gap-1">
                  <span>🔒 3. Iluminação & Atmosfera (Fixa)</span>
                </label>
                <input
                  type="text"
                  value={
                    recipe.fixedAnchors?.lightingAnchor ||
                    'Iluminação suave difusa de janela matinal 5600K com reflexos quentes'
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    onUpdateRecipe((prev) => ({
                      ...prev,
                      fixedAnchors: {
                        ...(prev.fixedAnchors || {
                          handAnchor: prev.handStyle,
                          countertopAnchor: prev.surfaceStyle,
                          lightingAnchor: val,
                          styleAnchor: 'Gastronômico 8k',
                        }),
                        lightingAnchor: val,
                      },
                    }));
                  }}
                  placeholder="Ex: Iluminação suave difusa 5600K com vapor natural"
                  className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700/80 rounded-xl text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>

            {/* Golden Rule Educational Callout */}
            <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-200/90 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-300 block mb-0.5">
                  🌟 A Regra de Ouro da Continuidade por Last-Frame:
                </span>
                <span>
                  O último frame de cada tomada deve ser ancorado quando o ingrediente é <strong>transferido</strong> ou <strong>transformado</strong> (ex: da tábua de corte para a frigideira quente, ou da frigideira para o prato de massa), preservando 100% das mãos, unhas e iluminação do ambiente!
                </span>
              </div>
            </div>
          </div>

          {/* Quick Automation Banner */}
          <div className="bg-gradient-to-r from-amber-950/40 via-orange-950/30 to-amber-950/40 border border-amber-500/50 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-slate-950 font-bold shrink-0 shadow-lg shadow-amber-500/20">
                <Zap className="w-5 h-5 fill-slate-950" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    Automação Ponta a Ponta (1-Clique)
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Cascata Inteligente
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Gere todas as tomadas em sequência autônoma: a IA extrai o último frame de cada clipe e o injeta como semente da tomada seguinte sem intervenção manual!
                </p>
                {isCascadeRunning && (
                  <div className="text-[11px] text-amber-400 font-mono flex items-center gap-1.5 pt-1 animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{cascadeStatusText || 'Processando automação sequencial...'}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 flex-wrap">
              <button
                type="button"
                onClick={handleRunCascadeAutomationOnCurrentSteps}
                disabled={isCascadeRunning}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                title="Gera imagens, vídeos e extrai frames automaticamente em todas as tomadas atuais"
              >
                <Play className="w-3.5 h-3.5 fill-current text-amber-400" />
                <span>{isCascadeRunning ? 'Executando...' : 'Rodar nos Passos Atuais'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAutoPilotModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <Zap className="w-4 h-4 fill-slate-950" />
                <span>Piloto Automático (Criar Nova)</span>
              </button>
            </div>
          </div>

          {/* Steps List */}
          <div className="space-y-6">
            {recipe.steps.map((step, idx) => {
              const currentMode = getStepViewMode(step);
              const isLastStep = idx === recipe.steps.length - 1;
              const nextStepNum = idx + 2;

              return (
                <div
                  key={step.id}
                  id={step.id}
                  className={`bg-[#0e1422] border rounded-2xl overflow-hidden shadow-lg transition-all duration-300 ${
                    highlightedStepId === step.id
                      ? 'border-emerald-400 ring-2 ring-emerald-500/50 shadow-emerald-500/20'
                      : 'border-slate-800'
                  }`}
                >
                  {/* Highlight notification if frame was just sent to this step */}
                  {highlightedStepId === step.id && (
                    <div className="bg-emerald-950/90 border-b border-emerald-500/50 px-5 py-2.5 text-xs text-emerald-200 flex items-center justify-between animate-pulse">
                      <div className="flex items-center gap-2 font-semibold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>🎯 Último Frame de Continuidade recebido! A imagem abaixo agora é o ponto de partida desta cena.</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-300 bg-emerald-900/80 px-2 py-0.5 rounded border border-emerald-700/60">
                        Continuidade Ativa
                      </span>
                    </div>
                  )}

                  {/* Step Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-slate-900/80 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 font-mono text-xs font-bold border border-amber-500/30">
                        P{String(step.stepNumber).padStart(2, '0')}
                      </span>
                      <input
                        type="text"
                        value={step.actionTitle}
                        onChange={(e) => handleUpdateStep({ ...step, actionTitle: e.target.value })}
                        className="text-sm font-semibold text-white bg-transparent border-b border-transparent hover:border-slate-700 focus:border-amber-500 focus:outline-none px-1"
                      />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Continuity indicator tag */}
                      {step.usesLastFrame ? (
                        <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Link className="w-3 h-3" />
                          <span>🔗 Vinculado ao Último Frame do Passo {step.stepNumber - 1}</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded-md">
                          Imagem Base Inicial
                        </span>
                      )}

                      {/* SFX Selector */}
                      <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs">
                        <Volume2 className="w-3 h-3 text-slate-400" />
                        <select
                          value={step.sfx}
                          onChange={(e) =>
                            handleUpdateStep({ ...step, sfx: e.target.value as CulinarySfx })
                          }
                          className="bg-transparent text-slate-200 text-xs focus:outline-none"
                        >
                          <option value="none">Sem SFX</option>
                          <option value="sizzle">Fritura / Sizzle</option>
                          <option value="chop">Picar / Corte</option>
                          <option value="stir">Mexer / Bowl</option>
                          <option value="pour">Despejar Líquido</option>
                          <option value="timer_ding">Ding do Forno</option>
                        </select>
                        {step.sfx !== 'none' && (
                          <button
                            type="button"
                            onClick={() => audioEngine.playSfx(step.sfx)}
                            className="text-[10px] text-amber-400 hover:text-amber-300 ml-1"
                            title="Testar som"
                          >
                            Tocar
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteStep(step.id)}
                        className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                        title="Excluir passo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Step Error Banner if failed or limit */}
                  {step.error && (
                    <div className="mx-5 my-2.5 px-4 py-2.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>{step.error}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleGenerateStepVideo(step.id)}
                        className="px-2.5 py-1 rounded-lg bg-rose-900/60 hover:bg-rose-800 border border-rose-500/50 text-white font-semibold text-[11px] cursor-pointer shrink-0 transition-colors"
                      >
                        Tentar Novamente
                      </button>
                    </div>
                  )}

                  {/* Step Metadata & Equipment Station Bar */}
                  <div className="px-5 py-2.5 bg-slate-950/80 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                        <span>Posto / Equipamento:</span>
                      </span>

                      {/* Equipment Station Selector */}
                      <select
                        value={step.equipmentStation || 'bowl_prep'}
                        onChange={(e) => {
                          const newStation = e.target.value as EquipmentStation;
                          const cfg = STATION_CONFIG[newStation];
                          handleUpdateStep({
                            ...step,
                            equipmentStation: newStation,
                            utensil: step.utensil || cfg?.defaultUtensil,
                          });
                        }}
                        className="bg-slate-900 border border-slate-700/80 text-amber-300 font-semibold text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-amber-400 cursor-pointer"
                      >
                        {Object.entries(STATION_CONFIG).map(([key, cfg]) => (
                          <option key={key} value={key}>
                            {cfg.emoji} {cfg.label} ({cfg.sub})
                          </option>
                        ))}
                      </select>

                      {/* Specific Utensil input */}
                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/60 rounded-lg px-2 py-0.5">
                        <Utensils className="w-3 h-3 text-slate-400 shrink-0" />
                        <input
                          type="text"
                          value={step.utensil || ''}
                          onChange={(e) => handleUpdateStep({ ...step, utensil: e.target.value })}
                          placeholder="Utensílio (ex: Frigideira inox no fogão aceso)"
                          className="bg-transparent text-[11px] text-slate-200 placeholder:text-slate-500 focus:outline-none w-48 sm:w-64 font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleReharmonizeStepPrompt(step.id)}
                        className="text-[10px] text-amber-300 hover:text-amber-200 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/60 px-2 py-1 rounded-md flex items-center gap-1 transition-colors cursor-pointer"
                        title="Re-gera o prompt desta tomada com base nas âncoras fixas e no utensílio selecionado"
                      >
                        <Wand2 className="w-3 h-3 text-amber-400" />
                        <span>Re-alinhar Prompt</span>
                      </button>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                        <span>{step.durationSeconds}s</span>
                        <span>·</span>
                        <span>121 frames (24fps)</span>
                      </div>
                    </div>
                  </div>

                  {/* Continuity Rule & Transfer Explanation Bar */}
                  <div className="px-5 py-2 bg-slate-900/40 border-b border-slate-800/60 text-xs flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap text-[11px]">
                      <span className="font-bold text-emerald-400 flex items-center gap-1">
                        <Link className="w-3 h-3" />
                        <span>Continuidade Last-Frame:</span>
                      </span>
                      <input
                        type="text"
                        value={step.continuityNote || ''}
                        onChange={(e) => handleUpdateStep({ ...step, continuityNote: e.target.value })}
                        placeholder="Ex: A IA pega o alho já fatiado da tábua e joga na frigideira quente"
                        className="bg-slate-950/70 border border-slate-800 rounded px-2 py-0.5 text-slate-300 text-[11px] focus:outline-none focus:border-emerald-400 w-72 sm:w-96 font-sans"
                      />
                    </div>

                    {step.continuityRule && (
                      <span className="text-[10px] text-amber-300/80 font-mono bg-amber-950/30 px-2 py-0.5 rounded border border-amber-800/40">
                        {step.continuityRule}
                      </span>
                    )}
                  </div>

                  {/* Contextual Guidance Banners per Station & Type */}
                  {(step.stepType === 'prep_cutting' || step.equipmentStation === 'cutting_board') && (
                    <div className="mx-5 mt-4 p-3 rounded-xl bg-amber-950/30 border border-amber-600/40 text-xs text-amber-200/90 flex items-start gap-2.5">
                      <Utensils className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-amber-300 block mb-0.5">
                          🪵 Tomada 1: Corte na Tábua de Madeira (Preparo Inicial)
                        </span>
                        <span>
                          Faca de chef cortando lâminas finas sobre a tábua de madeira rústica na bancada. Esta tomada estabelece o estilo das mãos do cozinheiro, unhas e a luz do cenário que serão preservadas nas próximas tomadas!
                        </span>
                      </div>
                    </div>
                  )}

                  {(step.stepType === 'saute_frying' || step.equipmentStation === 'pan_stove') && (
                    <div className="mx-5 mt-4 p-3 rounded-xl bg-orange-950/30 border border-orange-600/40 text-xs text-orange-200/90 flex items-start gap-2.5">
                      <Flame className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-orange-300 block mb-0.5">
                          🔥 Transição para o Fogão (Frigideira Inox / Fogo Vivo)
                        </span>
                        <span>
                          <strong>Continuidade do Last-Frame:</strong> As mesmas mãos pegam o ingrediente fatiado na tábua e o transferem para o azeite quente na frigideira sobre a chama do fogão. Sizzle e borbulhas com vapor aromático!
                        </span>
                      </div>
                    </div>
                  )}

                  {(step.stepType === 'boil_simmer' || step.equipmentStation === 'pot_boiling') && (
                    <div className="mx-5 mt-4 p-3 rounded-xl bg-sky-950/30 border border-sky-600/40 text-xs text-sky-200/90 flex items-start gap-2.5">
                      <Sparkles className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-sky-300 block mb-0.5">
                          🍲 Cozimento em Panela Alta (Fervura & Água Borbulhante)
                        </span>
                        <span>
                          Panela alta com água fervente vigorosa cozinhando macarrão, caldos ou legumes. O vapor sobe suavemente enquanto a massa atinge o ponto al dente antes de ser transferida para o molho!
                        </span>
                      </div>
                    </div>
                  )}

                  {(step.stepType === 'plated_hero' || step.equipmentStation === 'serving_plate') && (
                    <div className="mx-5 mt-4 p-3 rounded-xl bg-emerald-950/30 border border-emerald-600/40 text-xs text-emerald-200/90 flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-emerald-300 block mb-0.5">
                          🍽️ Montagem & Empratamento Final (Prato Fundo de Cerâmica)
                        </span>
                        <span>
                          <strong>Ação de Transferência:</strong> Mãos com pinça/pegador culinário transferindo a massa fumegante e os camarões da frigideira para o prato fundo de cerâmica artesanal na bancada. Visual sofisticado digno de alta gastronomia!
                        </span>
                      </div>
                    </div>
                  )}

                  {(step.stepType === 'tasting' || step.equipmentStation === 'tasting_fork') && (
                    <div className="mx-5 mt-4 p-3 rounded-xl bg-purple-950/30 border border-purple-600/40 text-xs text-purple-200/90 flex items-start gap-2.5">
                      <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-purple-300 block mb-0.5">
                          🍴 Garfada / Degustação Irresistível (Cheese Pull / Macro Shot)
                        </span>
                        <span>
                          O clímax gastronômico! Garfo enrolando o macarrão fumegante com o camarão suculento em close-up apetitoso que desperta desejo imediato no espectador.
                        </span>
                      </div>
                    </div>
                  )}

                  {(step.stepType === 'social_cta' || step.equipmentStation === 'social_hero') && (
                    <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-950/30 border border-rose-600/40 text-xs text-rose-200/90 flex items-start gap-2.5">
                      <Share2 className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-rose-300 block mb-0.5">
                          📱 Mídia Social & Chamada para Ação Viral (CTA)
                        </span>
                        <span>
                          Prato finalizado na bancada com enquadramento perfeito para Reels e TikTok. A locução convida diretamente os seguidores para salvar a receita, comentar e seguir o canal!
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Step Body */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-5">
                    {/* Left Column: Visual Media Display */}
                    <div className="lg:col-span-5 flex flex-col gap-2.5">
                      {/* Media View Mode Switcher Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded-xl text-[11px]">
                          <button
                            type="button"
                            onClick={() => setStepViewModes((prev) => ({ ...prev, [step.id]: 'image' }))}
                            className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                              currentMode === 'image'
                                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            <Camera className="w-3 h-3" />
                            <span>Frame / Imagem</span>
                            {step.imageUrl && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => setStepViewModes((prev) => ({ ...prev, [step.id]: 'video' }))}
                            className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                              currentMode === 'video'
                                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            <Film className="w-3 h-3" />
                            <span>Vídeo Animado</span>
                            {step.videoUrl && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                          </button>

                          {step.lastFrameUrl && (
                            <button
                              type="button"
                              onClick={() => setStepViewModes((prev) => ({ ...prev, [step.id]: 'last_frame' }))}
                              className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                                currentMode === 'last_frame'
                                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              <Zap className="w-3 h-3" />
                              <span>Último Frame</span>
                            </button>
                          )}
                        </div>

                        {/* Custom Image Upload */}
                        <label
                          className="text-[10px] text-slate-400 hover:text-amber-300 cursor-pointer flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 transition-colors"
                          title="Fazer upload de foto ou frame próprio"
                        >
                          <Upload className="w-3 h-3" />
                          <span>Foto Própria</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleUploadCustomImage(step.id, e)}
                          />
                        </label>
                      </div>

                      {/* Main Media Screen */}
                      <div className="relative aspect-video rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner group">
                        {/* 1. Video Mode */}
                        {currentMode === 'video' && step.videoUrl ? (
                          <div className="relative w-full h-full">
                            <video
                              data-step-id={step.id}
                              src={step.videoUrl}
                              controls
                              loop
                              playsInline
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-2 left-2 pointer-events-none">
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-950/80 border border-purple-700/60 text-purple-300 font-semibold shadow">
                                🎬 Clipe de Vídeo (Agnes Video V2.0)
                              </span>
                            </div>
                          </div>
                        ) : currentMode === 'last_frame' && step.lastFrameUrl ? (
                          /* 2. Last Frame Extracted Mode */
                          <div className="relative w-full h-full">
                            <img
                              src={step.lastFrameUrl}
                              alt="Último Frame Extraído"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-2 left-2">
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-950/90 border border-emerald-700/60 text-emerald-300 font-semibold shadow">
                                🎯 Último Frame (Continuidade do Próximo Passo)
                              </span>
                            </div>
                          </div>
                        ) : step.imageUrl ? (
                          /* 3. Step Generated Image Mode */
                          <div className="relative w-full h-full">
                            <img
                              src={step.imageUrl}
                              alt={step.actionTitle}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-2 left-2">
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-950/90 border border-amber-700/60 text-amber-300 font-semibold shadow">
                                📷 Frame Inicial Pronto para Animar
                              </span>
                            </div>
                          </div>
                        ) : step.referenceImageUrl ? (
                          /* 4. Inherited Reference Image Mode */
                          <div className="relative w-full h-full">
                            <img
                              src={step.referenceImageUrl}
                              alt="Frame de Referência Herdado"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover opacity-75"
                            />
                            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center p-3 text-center text-xs text-amber-300">
                              <span className="font-bold bg-slate-950/80 px-2.5 py-1 rounded-lg border border-amber-500/40">
                                🔗 Último Frame do Passo {step.stepNumber - 1} Carregado
                              </span>
                              <span className="text-[11px] text-slate-200 mt-1 max-w-xs drop-shadow">
                                Clique em "1. Gerar Imagem do Passo" para renderizar esta etapa ou anime diretamente!
                              </span>
                            </div>
                          </div>
                        ) : (
                          /* 5. Empty State */
                          <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500">
                            <Utensils className="w-8 h-8 mb-1 stroke-1 text-slate-600" />
                            <p className="text-xs font-medium text-slate-300">Frame do passo não gerado</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {step.usesLastFrame
                                ? 'Será continuado a partir do último frame da etapa anterior'
                                : 'Gere a imagem inicial ou faça upload'}
                            </p>
                          </div>
                        )}

                        {/* Loading Overlays */}
                        {generatingImages[step.id] && (
                          <div className="absolute inset-0 bg-black/85 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-xs text-amber-300 z-20">
                            <Loader2 className="w-7 h-7 animate-spin text-amber-400" />
                            <span className="font-semibold">Gerando Frame com Agnes Image 2.0...</span>
                            <span className="text-[10px] text-slate-400">Mantendo consistência do bowl e mãos</span>
                          </div>
                        )}
                        {generatingVideos[step.id] && (
                          <div className="absolute inset-0 bg-black/85 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-xs text-purple-300 z-20">
                            <Loader2 className="w-7 h-7 animate-spin text-purple-400" />
                            <span className="font-semibold">Animando Ação com Agnes Video V2.0...</span>
                            <span className="text-[10px] text-slate-300 font-mono">
                              {step.progress !== undefined ? `Renderizando: ${step.progress}%` : 'Na fila de processamento...'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Last Frame Continuity Status & Send to Next Step Action Bar */}
                      <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] space-y-2.5 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-mono">Status da Continuidade:</span>
                          <span className="font-bold text-amber-300 flex items-center gap-1">
                            {step.videoUrl ? (
                              <span className="text-purple-300 flex items-center gap-1">
                                <Film className="w-3 h-3" />
                                <span>Vídeo Animado Pronto</span>
                              </span>
                            ) : step.imageUrl ? (
                              <span className="text-emerald-300 flex items-center gap-1">
                                <Camera className="w-3 h-3" />
                                <span>Frame Pronto para Animar</span>
                              </span>
                            ) : (
                              <span className="text-slate-500">Aguardando Imagem</span>
                            )}
                          </span>
                        </div>

                        {/* Direct Capture & Send to Next Step Trigger */}
                        <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2">
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            {step.lastFrameUrl ? (
                              <span className="text-emerald-400 flex items-center gap-1 font-medium">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Último frame pronto para envio</span>
                              </span>
                            ) : (
                              <span>Capture o frame para continuar a cena</span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCaptureAndSendToNext(step.id)}
                            disabled={extractingFrames[step.id] || (!step.videoUrl && !step.imageUrl && !step.referenceImageUrl)}
                            className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all disabled:opacity-40"
                          >
                            {extractingFrames[step.id] ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Capturando Frame...</span>
                              </>
                            ) : (
                              <>
                                <Zap className="w-3.5 h-3.5 fill-slate-950" />
                                <span>
                                  {isLastStep
                                    ? 'Capturar & Criar Próximo Passo'
                                    : `Capturar & Enviar ao Passo ${nextStepNum}`}
                                </span>
                                <ArrowRight className="w-3 h-3" />
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Prompts, Voiceover & Generation Buttons */}
                    <div className="lg:col-span-7 flex flex-col justify-between space-y-3">
                      <div className="space-y-2.5">
                        {/* Voiceover text (Locução por IA) */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-medium text-amber-300 flex items-center gap-1">
                              <Mic className="w-3.5 h-3.5 text-amber-400" />
                              <span>Locução de Voz / Narração (Text-to-Speech)</span>
                            </label>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => audioEngine.playSfx(step.sfx)}
                                className="text-[10px] text-amber-300 hover:text-amber-200 flex items-center gap-1 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-700/50 cursor-pointer"
                                title="Ouvir efeito sonoro culinário desta etapa"
                              >
                                <Sparkles className="w-3 h-3 text-amber-400" />
                                <span>SFX ({step.sfx})</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => audioEngine.previewStep(step.sfx, step.voiceoverText)}
                                className="text-[10px] text-emerald-300 hover:text-emerald-200 flex items-center gap-1 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-700/50 cursor-pointer font-bold"
                                title="Ouvir efeito culinário + locução do chef"
                              >
                                <Volume2 className="w-3 h-3 text-emerald-400" />
                                <span>Ouvir Tomada</span>
                              </button>
                            </div>
                          </div>
                          <input
                            type="text"
                            value={step.voiceoverText}
                            onChange={(e) => handleUpdateStep({ ...step, voiceoverText: e.target.value })}
                            placeholder="Ex: Comece amassando bem as batatas cozidas ainda quentes..."
                            className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700/80 rounded-xl text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        {/* Image Prompt */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1">
                              <Camera className="w-3 h-3 text-cyan-400" />
                              <span>Prompt de Imagem (Agnes Image 2.0 Flash)</span>
                            </label>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {recipe.aspectRatio}
                            </span>
                          </div>
                          <textarea
                            rows={2}
                            value={step.imagePrompt}
                            onChange={(e) => handleUpdateStep({ ...step, imagePrompt: e.target.value })}
                            className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700/80 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500 font-mono resize-none leading-relaxed"
                          />
                        </div>

                        {/* Video Motion Prompt */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1">
                              <Film className="w-3 h-3 text-purple-400" />
                              <span>Prompt de Ação do Vídeo (Agnes Video V2.0)</span>
                            </label>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {step.durationSeconds}s ({step.numFrames}f)
                            </span>
                          </div>
                          <input
                            type="text"
                            value={step.videoPrompt}
                            onChange={(e) => handleUpdateStep({ ...step, videoPrompt: e.target.value })}
                            placeholder="Ex: Hands spooning seasoned ground beef directly into the bowl, steam rising..."
                            className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700/80 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500 font-mono"
                          />
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-2 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => handleGenerateStepImage(step.id)}
                          disabled={generatingImages[step.id]}
                          className="py-2.5 px-3 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          {generatingImages[step.id] ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Gerando Frame...</span>
                            </>
                          ) : (
                            <>
                              <Camera className="w-3.5 h-3.5" />
                              <span>{step.imageUrl ? 'Recriar Imagem do Passo' : '1. Gerar Imagem do Passo'}</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleGenerateStepVideo(step.id)}
                          disabled={generatingVideos[step.id] || (!step.imageUrl && !step.referenceImageUrl)}
                          className="py-2.5 px-3 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-slate-950 disabled:opacity-40 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20"
                        >
                          {generatingVideos[step.id] ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Animando Vídeo...</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 fill-slate-950" />
                              <span>{step.videoUrl ? 'Reanimar Ação em Vídeo' : '2. Animar Ação Culinária'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Step Specialized Toolbar: Dynamic Stations */}
          <div className="bg-[#0e1422] border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <Plus className="w-4 h-4 text-amber-400" />
                  <span>Adicionar Nova Tomada por Posto & Equipamento Gastronômico</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Selecione o equipamento culinário desta etapa para injetar automaticamente a transição lógica de utensílios, mantendo mãos e luz consistentes:
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-2">
              <button
                type="button"
                onClick={() => handleAddSpecificStep('prep_cutting', 'cutting_board')}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/60 hover:bg-slate-800/80 text-slate-200 hover:text-amber-300 transition-all text-center gap-1 cursor-pointer shadow-sm group"
                title="Tábua de corte de madeira na bancada fatiando com faca de chef"
              >
                <span className="text-xl group-hover:scale-110 transition-transform">🪵</span>
                <span className="text-[11px] font-bold leading-tight">Tábua de Corte</span>
                <span className="text-[9px] text-amber-400/90 font-mono">Preparo & Fatiar</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddSpecificStep('saute_frying', 'pan_stove')}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-orange-500/60 hover:bg-slate-800/80 text-slate-200 hover:text-orange-300 transition-all text-center gap-1 cursor-pointer shadow-sm group"
                title="Frigideira no fogão aceso: alho dourando, camarões salteando, vapor e sizzle"
              >
                <span className="text-xl group-hover:scale-110 transition-transform">🔥</span>
                <span className="text-[11px] font-bold leading-tight">Frigideira no Fogão</span>
                <span className="text-[9px] text-orange-400/90 font-mono">Refogado & Fritura</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddSpecificStep('boil_simmer', 'pot_boiling')}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-sky-500/60 hover:bg-slate-800/80 text-slate-200 hover:text-sky-300 transition-all text-center gap-1 cursor-pointer shadow-sm group"
                title="Panela alta com água fervente vigorosa borbulhando para massas e caldos"
              >
                <span className="text-xl group-hover:scale-110 transition-transform">🍲</span>
                <span className="text-[11px] font-bold leading-tight">Panela Alta</span>
                <span className="text-[9px] text-sky-400/90 font-mono">Fervura & Massa</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddSpecificStep('blender_process', 'blender')}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-teal-500/60 hover:bg-slate-800/80 text-slate-200 hover:text-teal-300 transition-all text-center gap-1 cursor-pointer shadow-sm group"
                title="Jarra de vidro do liquidificador ou processador triturando em alta velocidade"
              >
                <span className="text-xl group-hover:scale-110 transition-transform">🌪️</span>
                <span className="text-[11px] font-bold leading-tight">Liquidificador</span>
                <span className="text-[9px] text-teal-400/90 font-mono">Processar Cremes</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddSpecificStep('appliance_enter', 'oven_appliance')}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-rose-500/60 hover:bg-slate-800/80 text-slate-200 hover:text-rose-300 transition-all text-center gap-1 cursor-pointer shadow-sm group"
                title="Levando ao Forno, Air Fryer ou Micro-ondas (atenção ao último frame)"
              >
                <span className="text-xl group-hover:scale-110 transition-transform">♨️</span>
                <span className="text-[11px] font-bold leading-tight">Forno / Air Fryer</span>
                <span className="text-[9px] text-rose-400/90 font-mono">Entrada no Aparelho</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddSpecificStep('plated_hero', 'serving_plate')}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/60 hover:bg-slate-800/80 text-slate-200 hover:text-emerald-300 transition-all text-center gap-1 cursor-pointer shadow-sm group"
                title="Prato de servir final na bancada: pinça transferindo o macarrão da frigideira para o prato fundo"
              >
                <span className="text-xl group-hover:scale-110 transition-transform">🍽️</span>
                <span className="text-[11px] font-bold leading-tight">Prato Fundo / Servir</span>
                <span className="text-[9px] text-emerald-400/90 font-mono">Montagem & Hero</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddSpecificStep('tasting', 'tasting_fork')}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-purple-500/60 hover:bg-slate-800/80 text-slate-200 hover:text-purple-300 transition-all text-center gap-1 cursor-pointer shadow-sm group"
                title="Garfo levantando a porção em close-up apetitoso (garfada / cheese pull)"
              >
                <span className="text-xl group-hover:scale-110 transition-transform">🍴</span>
                <span className="text-[11px] font-bold leading-tight">Garfada / Prova</span>
                <span className="text-[9px] text-purple-400/90 font-mono">Degustação Macro</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddSpecificStep('social_cta', 'social_hero')}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-pink-500/60 hover:bg-slate-800/80 text-slate-200 hover:text-pink-300 transition-all text-center gap-1 cursor-pointer shadow-sm group"
                title="Encerramento estratégico para redes sociais convidando a curtir, comentar e seguir"
              >
                <span className="text-xl group-hover:scale-110 transition-transform">📱</span>
                <span className="text-[11px] font-bold leading-tight">CTA Redes Sociais</span>
                <span className="text-[9px] text-pink-400/90 font-mono">Seguir & Salvar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: INTERACTIVE RECIPE SUGGESTIONS CHAT */}
      {activeSubTab === 'chat' && (
        <div className="bg-[#0e1422] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-amber-400" />
              <span>Chat de Sugestões de Receitas (Agnes 2.5 Flash)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Peça ideias de receitas práticas, virais ou sofisticadas, e a Agnes AI criará a decupagem de passos pronta com prato pronto e chamada para redes sociais.
            </p>
          </div>

          {/* Recipe Size Selector for Social Media */}
          <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Quantidade de Passos / Tomadas Dinâmicas:</span>
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { count: 5, label: '5 Passos (Reels Clássico)' },
                { count: 7, label: '7 Passos (Dinâmico)' },
                { count: 8, label: '8 Passos (Mestre ⭐ Ultra-Fluido)' },
                { count: 10, label: '10 Passos (Cortes Rápidos)' },
              ].map((item) => (
                <button
                  key={item.count}
                  type="button"
                  onClick={() => setRecipeChatStepCount(item.count)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    recipeChatStepCount === item.count
                      ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold ring-1 ring-amber-300'
                      : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Recipe Chips */}
          <div className="space-y-1.5">
            <span className="text-[11px] text-slate-400">Sugestões rápidas de pratos:</span>
            <div className="flex flex-wrap gap-1.5">
              {RECIPE_PROMPT_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendRecipeChat(preset)}
                  disabled={isChatLoading}
                  className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:border-amber-500/50 hover:text-amber-300 transition-colors disabled:opacity-50"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Stream */}
          <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1 pt-2">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-amber-600/30 border border-amber-500/40 text-amber-100 rounded-tr-xs'
                      : 'bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-xs shadow-md'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.text}</div>

                  {/* Render Recipe Proposal Card with Rich Manual Step Details */}
                  {msg.recipeProposal && (
                    <div className="mt-3 pt-3 border-t border-slate-800 space-y-3 bg-slate-950/70 p-3.5 rounded-xl border border-amber-500/30">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-bold text-amber-300 text-sm block">
                            {msg.recipeProposal.title}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {msg.recipeProposal.category} · {msg.recipeProposal.prepTime}
                          </span>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold border border-amber-500/40">
                          {msg.recipeProposal.steps.length} Tomadas Rápidas
                        </span>
                      </div>

                      {/* Detailed Manual Step Preview List */}
                      <div className="space-y-2 pt-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                          Decupagem Técnica de Passos (Roteiro Completo):
                        </span>
                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                          {msg.recipeProposal.steps.map((st: any, i: number) => (
                            <div
                              key={i}
                              className="p-2 rounded-lg bg-slate-900 border border-slate-800/80 text-[11px] space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-white flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono text-[10px]">
                                    Passo {i + 1}
                                  </span>
                                  <span>{st.actionTitle}</span>
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">
                                  {st.durationSeconds || 3}s · {st.sfx ? `SFX: ${st.sfx}` : 'SFX: stir'}
                                </span>
                              </div>
                              <p className="text-slate-300 text-[10px] leading-tight">
                                {st.instruction || st.actionTitle}
                              </p>
                              {st.voiceoverText && (
                                <p className="text-amber-200/80 text-[10px] italic">
                                  🗣️ "{st.voiceoverText}"
                                </p>
                              )}
                              {st.utensil && (
                                <div className="text-[9px] text-slate-400 font-mono flex items-center gap-1">
                                  <span>📍 Utensílio:</span>
                                  <span className="text-slate-300">{st.utensil}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action Buttons: Configure Manual Steps vs AutoPilot */}
                      <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleApplyRecipeProposal(msg.recipeProposal)}
                          className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                          <Wand2 className="w-3.5 h-3.5" />
                          <span>Configurar Manualmente no Estúdio</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            handleApplyRecipeProposal(msg.recipeProposal);
                            setIsAutoPilotModalOpen(true);
                          }}
                          className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-orange-500 via-amber-400 to-amber-300 hover:brightness-110 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                          <Zap className="w-3.5 h-3.5 fill-slate-950" />
                          <span>Executar no Piloto Automático</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isChatLoading && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-amber-300">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>Agnes AI está criando sua receita com continuidade de cena...</span>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendRecipeChat();
            }}
            className="flex items-center gap-2 pt-2 border-t border-slate-800"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Digite o prato desejado (ex: Sobremesa fácil de banana com canela e calda)..."
              disabled={isChatLoading}
              className="flex-1 px-3.5 py-2.5 text-xs bg-slate-900 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              disabled={isChatLoading || !chatInput.trim()}
              className="p-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold transition-colors disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* SUB-TAB 3: MASTER RECIPE CONTINUOUS PLAYER */}
      {activeSubTab === 'player' && (
        <div className="space-y-6">
          <div className="bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col justify-between max-w-xl mx-auto">
            {/* Viewport Screen with true 9:16 vertical ratio */}
            <div className="relative aspect-[9/16] w-full max-h-[70vh] bg-slate-950 flex items-center justify-center overflow-hidden mx-auto">
              {currentStep?.videoUrl ? (
                <video
                  key={currentStep?.id || currentStepIdx}
                  ref={videoRef}
                  src={currentStep.videoUrl}
                  autoPlay={isPlaying}
                  loop
                  muted
                  playsInline
                  onCanPlay={(e) => {
                    if (isPlaying) {
                      (e.target as HTMLVideoElement).play().catch(() => {});
                    }
                  }}
                  className="w-full h-full object-cover"
                />
              ) : currentStep?.imageUrl ? (
                <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-slate-950">
                  <img
                    src={currentStep.imageUrl}
                    alt={currentStep.actionTitle}
                    referrerPolicy="no-referrer"
                    className={`w-full h-full object-cover transition-transform duration-[4000ms] ease-out ${
                      isPlaying ? 'scale-105' : 'scale-100'
                    }`}
                  />
                  <div className="absolute top-14 left-4 px-2.5 py-1 rounded-md bg-black/80 backdrop-blur-md border border-amber-500/40 text-[10px] text-amber-300 font-mono flex items-center gap-1.5 shadow-lg pointer-events-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span>Passo com Foto Base</span>
                  </div>
                </div>
              ) : (
                <div className="text-center text-slate-500 p-8">
                  <Utensils className="w-10 h-10 mx-auto mb-2 text-slate-700 stroke-1" />
                  <p className="text-xs">Nenhum frame neste passo</p>
                </div>
              )}

              {/* Automatic Subtitle Overlay (Legenda da Receita) */}
              {recipe.enableCaptions && currentStep?.voiceoverText && (
                <div className="absolute bottom-5 inset-x-8 text-center pointer-events-none">
                  <span className="inline-block px-4 py-2 rounded-xl bg-black/80 backdrop-blur-md border border-white/10 text-white font-semibold text-xs sm:text-sm shadow-2xl leading-relaxed">
                    {currentStep.voiceoverText}
                  </span>
                </div>
              )}

              {/* Top Header Overlay */}
              <div className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between text-xs font-mono text-amber-300 pointer-events-none">
                <div>
                  <span className="bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/40">
                    PASSO {currentStepIdx + 1} DE {recipe.steps.length}
                  </span>
                  <h4 className="text-sm font-bold text-white mt-1 drop-shadow">
                    {currentStep?.actionTitle}
                  </h4>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 font-mono">
                    SFX: {currentStep?.sfx !== 'none' ? currentStep?.sfx : 'Mudo'}
                  </span>
                </div>
              </div>

              {/* Tap to Play/Pause */}
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="absolute inset-0 flex items-center justify-center bg-transparent group focus:outline-none"
              >
                <div
                  className={`w-14 h-14 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all ${
                    isPlaying ? 'opacity-0 group-hover:opacity-80 scale-90' : 'opacity-90 scale-100 shadow-2xl'
                  }`}
                >
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 fill-white translate-x-0.5" />}
                </div>
              </button>
            </div>

            {/* Scrubber & Controls */}
            <div className="bg-[#0b0f19] px-6 py-4 border-t border-slate-800 space-y-3">
              {/* Segmented Timeline */}
              <div className="w-full h-7 bg-slate-900 rounded-lg overflow-hidden flex border border-slate-800 p-0.5 gap-1">
                {recipe.steps.map((st, idx) => {
                  const isActive = idx === currentStepIdx;
                  return (
                    <div
                      key={st.id}
                      onClick={() => {
                        setCurrentStepIdx(idx);
                        setStepTimer(0);
                      }}
                      className={`flex-1 rounded cursor-pointer transition-all flex items-center justify-between px-2 text-[10px] font-mono select-none ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-950 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <span>Passo {idx + 1}</span>
                      <span>{st.durationSeconds}s</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-9 h-9 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center justify-center font-bold"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-slate-950" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCurrentStepIdx(0);
                      setStepTimer(0);
                    }}
                    className="p-1.5 rounded text-slate-400 hover:text-white"
                    title="Reiniciar receita"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <span className="text-xs font-mono text-slate-400">
                    Duração Total: {totalRecipeDuration} segundos
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recipe.enableTts}
                      onChange={(e) => onUpdateRecipe((prev) => ({ ...prev, enableTts: e.target.checked }))}
                      className="rounded accent-amber-500"
                    />
                    <span>Locução de Voz (TTS)</span>
                  </label>

                  <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recipe.enableCaptions}
                      onChange={(e) => onUpdateRecipe((prev) => ({ ...prev, enableCaptions: e.target.checked }))}
                      className="rounded accent-amber-500"
                    />
                    <span>Legendas na Tela</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Export Recipe Button */}
          <div className="bg-[#0e1422] border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold text-white">Compilar Vídeo Completo da Receita</h4>
              <p className="text-[11px] text-slate-400">
                Gera o arquivo contínuo com todos os passos sequenciados para postar nas redes.
              </p>
            </div>

            <button
              type="button"
              onClick={handleExportRecipeVideo}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 font-bold text-xs shadow-md disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Compilando ({exportProgress}%)...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Baixar Vídeo Final da Receita</span>
                </>
              )}
            </button>
          </div>

          {exportedUrl && (
            <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-600/40 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-300">
                <span className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>Vídeo contínuo compilado com sucesso com todas as tomadas em movimento!</span>
                </span>
                <a
                  href={exportedUrl}
                  download={`${(recipe?.title || 'video_receita').toLowerCase().replace(/\s+/g, '_')}.webm`}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 font-bold hover:from-emerald-300 hover:to-teal-300 flex items-center justify-center gap-2 shadow-md transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar Vídeo (.webm)</span>
                </a>
              </div>

              {/* Video Player Preview */}
              <div className="rounded-xl overflow-hidden bg-black/90 border border-emerald-900/60 shadow-inner flex flex-col items-center p-2">
                <span className="text-[11px] font-mono text-emerald-400/80 mb-2 self-start flex items-center gap-1.5">
                  <Play className="w-3 h-3 fill-emerald-400" />
                  Prévia do Arquivo Gerado:
                </span>
                <video
                  src={exportedUrl}
                  controls
                  playsInline
                  autoPlay
                  className="w-full max-h-96 rounded-lg object-contain bg-slate-950"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* AutoPilot 1-Click Autonomous Modal */}
      <AutoPilotModal
        isOpen={isAutoPilotModalOpen}
        onClose={() => setIsAutoPilotModalOpen(false)}
        recipe={recipe}
        onApplyRecipe={(newRec) => onUpdateRecipe(newRec)}
        apiKey={apiKey}
        onOpenKeyModal={onOpenKeyModal}
        showToast={showToast}
        onNavigateToPlayer={() => {
          setActiveSubTab('player');
          setCurrentStepIdx(0);
          setStepTimer(0);
          setIsPlaying(true);
          if (onNavigateToPlayer) onNavigateToPlayer();
        }}
      />
    </div>
  );
};
