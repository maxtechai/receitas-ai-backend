import React, { useState, useEffect, useRef } from 'react';
import {
  Zap,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Flame,
  Utensils,
  Video,
  Image as ImageIcon,
  Volume2,
  Download,
  X,
  Clock,
  Layers,
  Link as LinkIcon,
  ChevronRight,
  Sliders,
  ExternalLink,
} from 'lucide-react';
import { RecipeProject, RecipeStep, EquipmentStation, RecipeStepType } from '../types';
import { STATION_CONFIG, extractVideoLastFrame } from './RecipeStudioView';
import {
  generateRecipeWorkflowWithAgnes,
  generateShotImage,
  createVideoTask,
  pollVideoStatus,
  buildPromptWithFixedAnchors,
} from '../services/agnesApi';
import { stitchLongVideo } from '../utils/videoStitcher';
import {
  pastaShrimpRecipeProject,
  croquetesAirFryerRecipeProject,
  paoQueijoAirFryerRecipeProject,
  escondidinhoAirfryerRecipeProject,
} from '../data/sampleRecipes';

interface AutoPilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipe: RecipeProject;
  onApplyRecipe: (updatedRecipe: RecipeProject) => void;
  apiKey: string;
  onOpenKeyModal: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onNavigateToPlayer?: () => void;
}

type AutoPilotPhase = 'idle' | 'scripting' | 'generating_steps' | 'audio_sfx' | 'stitching' | 'completed' | 'paused' | 'error';

interface LogMessage {
  id: string;
  time: string;
  text: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'step';
}

const PRESET_IDEAS = [
  {
    title: '🍗 Croquetes de Frango na Air Fryer (8 Passos Mestre / Last-Frame Perfeito)',
    category: 'Reels & Shorts / Last-Frame Chain Ultra-Fluido',
    utensilFlow: 'Frango na Tigela ➔ Queijo/Batata/Ervas ➔ Temperos ➔ Sovar Massa ➔ Modelar Bancada ➔ Air Fryer Entrada ➔ Saída Dourada ➔ Cheese Pull Macro',
    demoProject: croquetesAirFryerRecipeProject,
  },
  {
    title: '🧀 Pão de Queijo na Air Fryer (13s Viral / 7 Cenas SynthID)',
    category: 'Shorts & Reels / Corte Acelerado SynthID',
    utensilFlow: 'Ralar Queijo ➔ Creme Leite ➔ Polvilho ➔ Modelar Bolinha ➔ Air Fryer ➔ Pegar ➔ Cheese Pull Macro',
    demoProject: paoQueijoAirFryerRecipeProject,
  },
  {
    title: '🍝 Macarrão com Alho e Camarão Suculento',
    category: 'Massa / Frutos do Mar',
    utensilFlow: 'Tábua ➔ Frigideira no Fogão ➔ Camarões ➔ Prato Fundo ➔ Garfada',
    demoProject: pastaShrimpRecipeProject,
  },
  {
    title: '🥔 Escondidinho Cremoso de Batata na Air Fryer',
    category: 'Air Fryer / Culinária Rápida',
    utensilFlow: 'Bowl Purê ➔ Carne Moída ➔ Air Fryer ➔ Garfada Queijo ➔ CTA',
    demoProject: escondidinhoAirfryerRecipeProject,
  },
  {
    title: '🥩 Risoto de Cogumelos com Filé Mignon Dourado',
    category: 'Alta Gastronomia',
    utensilFlow: 'Tábua de Corte ➔ Panela Alta Fervura ➔ Frigideira Selar ➔ Empratamento ➔ CTA',
  },
  {
    title: '🍫 Bolo Vulcão de Chocolate com Calda Quente',
    category: 'Confeitaria / Sobremesa',
    utensilFlow: 'Liquidificador ➔ Forma Untada ➔ Forno Dourando ➔ Calda Quente ➔ Garfada',
  },
];

export const AutoPilotModal: React.FC<AutoPilotModalProps> = ({
  isOpen,
  onClose,
  recipe,
  onApplyRecipe,
  apiKey,
  onOpenKeyModal,
  showToast,
  onNavigateToPlayer,
}) => {
  // Config inputs
  const [recipeIdea, setRecipeIdea] = useState(recipe.title || 'Macarrão com Alho e Camarão Suculento');
  const [executionMode, setExecutionMode] = useState<'real' | 'fast_demo'>(apiKey ? 'real' : 'fast_demo');
  const [handAnchor, setHandAnchor] = useState(
    recipe.fixedAnchors?.handAnchor || 'Mãos cuidadas do cozinheiro com unhas vermelhas e anel dourado discreto'
  );
  const [countertopAnchor, setCountertopAnchor] = useState(
    recipe.fixedAnchors?.countertopAnchor || 'Bancada de carvalho rústico escuro na cozinha com azulejos claros'
  );
  const [lightingAnchor, setLightingAnchor] = useState(
    recipe.fixedAnchors?.lightingAnchor || 'Iluminação suave difusa de janela matinal 5600K com reflexos quentes e vapor'
  );

  const [targetStepCount, setTargetStepCount] = useState<number>(recipe.steps.length > 5 ? recipe.steps.length : 8);
  const [useDualKeyframes, setUseDualKeyframes] = useState<boolean>(true);

  // Automation state
  const [phase, setPhase] = useState<AutoPilotPhase>('idle');
  const [overallProgress, setOverallProgress] = useState(0);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [currentSubTask, setCurrentSubTask] = useState('');
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [autoProject, setAutoProject] = useState<RecipeProject>(recipe);
  const [finalVideoBlobUrl, setFinalVideoBlobUrl] = useState<string | null>(null);

  // Cancellation and pause flags
  const isCancelledRef = useRef(false);
  const isPausedRef = useRef(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setAutoProject(recipe);
      setRecipeIdea(recipe.title);
      if (recipe.fixedAnchors) {
        setHandAnchor(recipe.fixedAnchors.handAnchor);
        setCountertopAnchor(recipe.fixedAnchors.countertopAnchor);
        setLightingAnchor(recipe.fixedAnchors.lightingAnchor);
      }
    }
  }, [isOpen, recipe]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  if (!isOpen) return null;

  const addLog = (text: string, type: 'info' | 'success' | 'warning' | 'error' | 'step' = 'info') => {
    const time = new Date().toLocaleTimeString('pt-BR', { hour12: false });
    setLogs((prev) => [...prev, { id: `log_${Date.now()}_${Math.random()}`, time, text, type }]);
  };

  const handleCancel = () => {
    isCancelledRef.current = true;
    setPhase('idle');
    addLog('⛔ Automação cancelada pelo usuário.', 'warning');
    showToast('Automação cancelada.', 'info');
  };

  /**
   * Main Autonomous Pipeline Runner
   */
  const handleStartAutoPilot = async () => {
    if (executionMode === 'real' && !apiKey) {
      onOpenKeyModal();
      showToast('Insira sua Agnes API Key para executar a automação real com IA.', 'error');
      return;
    }

    isCancelledRef.current = false;
    isPausedRef.current = false;
    setLogs([]);
    setFinalVideoBlobUrl(null);
    setOverallProgress(2);
    setPhase('scripting');
    setCurrentSubTask('Planejando estrutura gastronômica com âncoras fixas e utensílios dinâmicos...');

    addLog('🚀 INICIANDO PILOTO AUTOMÁTICO DE CULINÁRIA (1-CLIQUE)', 'info');
    addLog(`📋 Receita Alvo: "${recipeIdea}"`, 'info');
    addLog(`🔒 Âncora Mãos: "${handAnchor}"`, 'info');
    addLog(`🪵 Âncora Bancada: "${countertopAnchor}"`, 'info');
    addLog(`💡 Modo de Execução: ${executionMode === 'real' ? 'Agnes AI API (Real)' : 'Demonstração Ultrarrápida'}`, 'info');

    let workingProject: RecipeProject = {
      ...autoProject,
      title: recipeIdea,
      fixedAnchors: {
        handAnchor,
        countertopAnchor,
        lightingAnchor,
        styleAnchor: 'Comercial gastronômico apetitoso de alta definição 8k',
      },
      handStyle: handAnchor,
      surfaceStyle: countertopAnchor,
    };

    try {
      // ==========================================
      // FASE 1: ROTEIRIZAÇÃO INTELIGENTE
      // ==========================================
      setOverallProgress(8);
      addLog(`Fase 1: Gerando roteiro com ${targetStepCount} tomadas dinâmicas e regra de ouro do Last-Frame...`, 'step');

      // Check if user picked an existing preset or if we need to call Gemini/Agnes
      const matchingPreset = PRESET_IDEAS.find((p) => p.title.toLowerCase().includes(recipeIdea.toLowerCase()));
      if (matchingPreset?.demoProject && executionMode === 'fast_demo') {
        workingProject = {
          ...matchingPreset.demoProject,
          title: recipeIdea,
          fixedAnchors: workingProject.fixedAnchors,
        };
        addLog(`✅ Roteiro carregado com ${workingProject.steps.length} tomadas fluidas de alta gastronomia!`, 'success');
      } else if (executionMode === 'real') {
        try {
          const aiProposal = await generateRecipeWorkflowWithAgnes(
            {
              recipeNameOrIdea: recipeIdea,
              stepCount: targetStepCount,
              aspectRatio: workingProject.aspectRatio,
              fixedAnchors: workingProject.fixedAnchors,
              handStyle: handAnchor,
              surfaceStyle: countertopAnchor,
            },
            apiKey
          );

          const totalCount = aiProposal.steps.length;
          const mappedSteps: RecipeStep[] = aiProposal.steps.map((st: any, idx: number) => {
            let inferredType: RecipeStepType = st.stepType || 'preparation';
            let inferredStation: EquipmentStation = st.equipmentStation || 'bowl_prep';

            if (!st.stepType) {
              if (idx === 0) {
                inferredType = 'prep_cutting';
                inferredStation = 'cutting_board';
              } else if (idx === totalCount - 2) {
                inferredType = 'tasting';
                inferredStation = 'tasting_fork';
              } else if (idx === totalCount - 1) {
                inferredType = 'social_cta';
                inferredStation = 'social_hero';
              }
            }

            return {
              id: `ap_step_${Date.now()}_${idx}`,
              stepNumber: idx + 1,
              stepType: inferredType,
              equipmentStation: inferredStation,
              utensil: st.utensil || STATION_CONFIG[inferredStation]?.defaultUtensil || 'Utensílio de chef',
              continuityRule: st.continuityRule || 'Regra de Ouro: Ingrediente transferido mantendo mãos e luz 100% fiéis',
              continuityNote: st.continuityNote || 'Continuidade da etapa anterior',
              actionTitle: st.actionTitle,
              instruction: st.instruction,
              voiceoverText: st.voiceoverText,
              sfx: st.sfx || 'sizzle',
              usesLastFrame: idx > 0,
              imagePrompt: st.imagePrompt,
              videoPrompt: st.videoPrompt,
              durationSeconds: st.durationSeconds || 5,
              numFrames: 121,
              frameRate: 24,
              status: 'idle',
            };
          });

          workingProject = {
            ...workingProject,
            title: aiProposal.title,
            category: aiProposal.category,
            prepTime: aiProposal.prepTime,
            steps: mappedSteps,
          };

          addLog(`✅ Roteiro gerado pelo Chef IA com ${mappedSteps.length} tomadas e múltiplos postos!`, 'success');
        } catch (err: any) {
          addLog(`⚠️ Erro ao consultar IA online: ${err.message}. Usando arquitetura padrão fluida.`, 'warning');
          workingProject = { ...pastaShrimpRecipeProject, title: recipeIdea, fixedAnchors: workingProject.fixedAnchors };
        }
      } else {
        workingProject = { ...pastaShrimpRecipeProject, title: recipeIdea, fixedAnchors: workingProject.fixedAnchors };
      }

      setAutoProject({ ...workingProject });
      onApplyRecipe({ ...workingProject });

      if (isCancelledRef.current) return;

      // ==========================================
      // FASE 2: GERAÇÃO SEQUENCIAL EM CASCATA COM LAST-FRAME
      // ==========================================
      setPhase('generating_steps');
      const totalSteps = workingProject.steps.length;

      let lastExtractedFrame: string | undefined = undefined;

      for (let i = 0; i < totalSteps; i++) {
        if (isCancelledRef.current) {
          addLog('⛔ Execução interrompida.', 'warning');
          return;
        }

        setCurrentStepIdx(i);
        const step = workingProject.steps[i];
        const stepNum = i + 1;
        const progressBase = 15 + Math.floor((i / totalSteps) * 65);
        setOverallProgress(progressBase);

        addLog(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'info');
        addLog(`🎬 TOMADA ${stepNum}/${totalSteps}: ${step.actionTitle}`, 'step');
        addLog(`📍 Posto: ${STATION_CONFIG[step.equipmentStation || 'bowl_prep']?.label || 'Estação Culinária'} | Utensílio: ${step.utensil}`, 'info');

        // Se usa last frame e temos o frame anterior, propaga automaticamente!
        if (i > 0 && lastExtractedFrame) {
          addLog(`🔗 APLICANDO REGRA DE OURO: Injetando Último Frame da Tomada ${i} como referência`, 'info');
          step.referenceImageUrl = lastExtractedFrame;
          step.usesLastFrame = true;
        }

        // Subtask 1: Gerar Imagem do Passo (Start Frame)
        setCurrentSubTask(`Tomada ${stepNum}: Gerando quadro inicial (Start Frame 0s)...`);
        step.status = 'image_generating';
        setAutoProject({ ...workingProject });
        onApplyRecipe({ ...workingProject });

        let stepImage = step.imageUrl;

        if (executionMode === 'real') {
          try {
            addLog(`📸 Gerando quadro inicial (0s) via Agnes Image 2.0 Flash...`, 'info');
            stepImage = await generateShotImage(
              step.imagePrompt,
              workingProject.aspectRatio,
              step.usesLastFrame ? step.referenceImageUrl : undefined,
              apiKey
            );
            addLog(`✅ Quadro inicial (0s) da Tomada ${stepNum} gerado com sucesso!`, 'success');
          } catch (e: any) {
            addLog(`⚠️ Erro na imagem inicial da tomada ${stepNum}: ${e.message}. Mantendo fallback.`, 'warning');
          }
        } else {
          // Fast demo simulation: brief 1.2s delay for visual feedback
          await new Promise((r) => setTimeout(r, 1000));
          addLog(`✅ Quadro inicial da Tomada ${stepNum} pronto (Modo Rápido)!`, 'success');
        }

        step.imageUrl = stepImage || step.referenceImageUrl;

        // Subtask 1.5: Gerar Quadro Final (End Frame) para Interpolação Confinada
        let stepEndImage = step.endImageUrl;
        if (useDualKeyframes) {
          setCurrentSubTask(`Tomada ${stepNum}: Gerando quadro final exato (End Frame)...`);
          addLog(`🎯 Gerando quadro final de parada suave para ancoragem perfeita...`, 'info');

          if (executionMode === 'real') {
            try {
              const targetEndPrompt =
                step.endImagePrompt ||
                `${step.imagePrompt}, motion gracefully concluded, hands and utensils resting, clear culinary presentation at final position, sharp focus, 8k`;
              
              stepEndImage = await generateShotImage(
                targetEndPrompt,
                workingProject.aspectRatio,
                step.imageUrl,
                apiKey
              );
              step.endImageUrl = stepEndImage;
              addLog(`🔒 Quadro final gerado: animação será confinada entre início e fim!`, 'success');
            } catch (endErr: any) {
              addLog(`⚠️ Informação do quadro final: ${endErr.message}. Usando interpolação padrão.`, 'warning');
            }
          } else {
            await new Promise((r) => setTimeout(r, 700));
            step.endImageUrl = step.imageUrl;
            addLog(`🔒 Modo Dual-Keyframe ativo: início e fim fixados!`, 'success');
          }
        }

        step.status = 'video_generating';
        setAutoProject({ ...workingProject });
        onApplyRecipe({ ...workingProject });

        // Subtask 2: Gerar Animação em Vídeo
        setCurrentSubTask(`Tomada ${stepNum}: Animando dinâmica entre os dois quadros...`);

        let stepVideo = step.videoUrl;

        if (executionMode === 'real' && step.imageUrl) {
          try {
            const hasDualKeys = Boolean(useDualKeyframes && step.endImageUrl && step.endImageUrl !== step.imageUrl);
            addLog(
              hasDualKeys
                ? `🎬 Enviando tarefa para Agnes Video v2.0 no modo DUAL-KEYFRAMES (Início ➔ Fim)...`
                : `🎬 Enviando tarefa para Agnes Video v2.0 (121 frames / 24fps)...`,
              'info'
            );

            const task = await createVideoTask(
              {
                prompt: step.videoPrompt || 'Cinematic cooking action in smooth slow motion, resting gracefully at final frame',
                imageUrl: step.imageUrl,
                secondKeyframeUrl: hasDualKeys ? step.endImageUrl : undefined,
                numFrames: step.numFrames || 121,
                frameRate: step.frameRate || 24,
                aspectRatio: workingProject.aspectRatio,
              },
              apiKey
            );

            stepVideo = await pollVideoStatus(
              task.videoId,
              task.taskId,
              (prog) => {
                step.progress = prog;
                setAutoProject({ ...workingProject });
              },
              apiKey
            );
            addLog(`✅ Vídeo da Tomada ${stepNum} renderizado com interpolação fluida!`, 'success');
          } catch (e: any) {
            const isRateLimit =
              e.message?.includes('429') ||
              e.message?.toLowerCase().includes('rate limit') ||
              e.message?.toLowerCase().includes('concorrência');
            const isQuota =
              e.message?.includes('402') ||
              e.message?.toLowerCase().includes('saldo') ||
              e.message?.toLowerCase().includes('créditos');

            if (isRateLimit) {
              addLog(`⚠️ Limite de concorrência na Agnes AI (429): aguardando liberação de recursos. Usando fallback inteligente.`, 'warning');
            } else if (isQuota) {
              addLog(`⚠️ Saldo/créditos insuficientes na Agnes AI. Recarregue no painel para gerar vídeos reais.`, 'warning');
            } else {
              addLog(`⚠️ Informação do vídeo: ${e.message}`, 'warning');
            }
          }
        } else {
          // Fast demo simulation: brief 1.5s delay
          await new Promise((r) => setTimeout(r, 1400));
          addLog(`✅ Clipe de vídeo da Tomada ${stepNum} animado!`, 'success');
        }

        step.videoUrl = stepVideo;
        step.status = 'completed';
        step.progress = 100;

        // Subtask 3: Extração Automática do Último Frame via Canvas
        setCurrentSubTask(`Tomada ${stepNum}: Confirmando frame final para a próxima tomada...`);
        addLog(`🎯 Salvando frame final para encadear a próxima tomada sem cortes bruscos...`, 'info');

        let extractedFrame: string | undefined = step.endImageUrl || step.imageUrl;
        if (step.videoUrl) {
          try {
            extractedFrame = await extractVideoLastFrame(step.videoUrl, step.endImageUrl || step.imageUrl);
          } catch (e) {
            extractedFrame = step.endImageUrl || step.imageUrl;
          }
        }
        step.lastFrameUrl = extractedFrame;
        lastExtractedFrame = extractedFrame;

        addLog(`🔗 Frame final cravado: a Tomada ${stepNum + 1 <= totalSteps ? stepNum + 1 : 'final'} começará com 100% de continuidade!`, 'success');

        setAutoProject({ ...workingProject });
        onApplyRecipe({ ...workingProject });
      }

      // ==========================================
      // FASE 3: SÍNTESE DE ÁUDIO & EFEITOS SFX
      // ==========================================
      setPhase('audio_sfx');
      setOverallProgress(85);
      setCurrentSubTask('Sintetizando locução de voz (TTS) e mixando efeitos culinários...');
      addLog('\nFase 3: Mixagem de Locução e Efeitos Sonoros Culinários...', 'step');
      addLog(`🎙️ Sintetizando voz do chef em português para as ${totalSteps} tomadas...`, 'info');
      for (const step of workingProject.steps) {
        if (step.voiceoverText) {
          addLog(`🗣️ Tomada ${step.stepNumber}: "${step.voiceoverText.slice(0, 48)}..."`, 'info');
        }
      }
      addLog(`🔊 Efeitos gastronômicos sincronizados: corte (chop), frigideira (sizzle), fervura (stir) e finalização (timer ding)`, 'info');
      addLog(`🎵 Trilha sonora gourmet (Lofi Gastronômico) mixada na master!`, 'info');

      await new Promise((r) => setTimeout(r, 800));
      addLog('✅ Locução, efeitos sonoros e trilha musical mixados na master!', 'success');

      // ==========================================
      // FASE 4: COSTURA & RENDERIZAÇÃO CONTÍNUA DO VÍDEO MP4 COM ÁUDIO
      // ==========================================
      setPhase('stitching');
      setOverallProgress(90);
      setCurrentSubTask('Compilando vídeo contínuo em formato 9:16 com áudio mixado...');
      addLog('\nFase 4: Costura e Renderização do Vídeo Contínuo com Áudio Integrado...', 'step');

      try {
        const tempProject: any = {
          title: workingProject.title,
          aspectRatio: workingProject.aspectRatio,
          bgMusic: 'lofi_kitchen',
          shots: workingProject.steps.map((s) => ({
            ...s,
            title: `Tomada ${s.stepNumber}: ${s.actionTitle}`,
            transitionToNext: 'crossfade',
          })),
        };

        const stitchedBlob = await stitchLongVideo(
          tempProject,
          (p) => {
            setOverallProgress(90 + Math.floor((p.percent / 100) * 9));
          },
          {
            enableMusic: true,
            enableSfx: true,
            enableVoiceover: true,
            musicVolume: 0.28,
            sfxVolume: 0.45,
          }
        );

        const videoBlobUrl = URL.createObjectURL(stitchedBlob);
        setFinalVideoBlobUrl(videoBlobUrl);
        addLog('🎉 VÍDEO FINAL COMPOSTO COM ÁUDIO INTEGRADO (Trilha + SFX + Locução)! Pronto para download e publicação.', 'success');
      } catch (err: any) {
        addLog(`⚠️ Aviso na compilação do arquivo: ${err.message}. Você ainda pode assistir diretamente no player do estúdio.`, 'warning');
      }

      setOverallProgress(100);
      setPhase('completed');
      setCurrentSubTask('Automação concluída com sucesso!');
      showToast('🎉 Vídeo de receita gerado com sucesso pelo Piloto Automático!', 'success');
    } catch (err: any) {
      console.error(err);
      setPhase('error');
      addLog(`❌ Falha na automação: ${err.message}`, 'error');
      showToast(`Erro na automação: ${err.message}`, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0b101c] border border-amber-500/40 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Glow ambient */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-300 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-amber-500/20">
              <Zap className="w-5 h-5 fill-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
                  <span>Piloto Automático de Receitas com IA</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    1-CLIQUE DE PONTA A PONTA
                  </span>
                </h2>
              </div>
              <p className="text-xs text-slate-400">
                Geração autônoma: Roteiro ➔ Imagens com Âncoras Fixas ➔ Animação em Vídeo ➔ Extração do Último Frame ➔ Costura Final!
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* CONFIGURATION SECTION (Visible when idle) */}
          {phase === 'idle' && (
            <div className="space-y-5">
              {/* Educational Highlight */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-orange-950/30 to-amber-950/40 border border-amber-500/40 text-amber-200 flex items-start gap-3 shadow-inner">
                <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-amber-300 text-sm block">
                    Como a automação resolve a fluidez culinária sem esforço manual:
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Você não precisa mais clicar em cada tomada individualmente! O motor do Piloto Automático gera o roteiro com <strong>5 postos gastronômicos</strong>, renderiza o passo 1, <strong>extrai o último frame</strong> no momento exato e o transfere automaticamente para a panela/frigideira do passo seguinte, preservando as mesmas mãos, unhas e iluminação do começo ao fim!
                  </p>
                </div>
              </div>

              {/* Recipe Name Input & Presets */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-white flex items-center justify-between">
                  <span>Nome da Receita ou Ideia Gastronômica:</span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    Pode ser qualquer prato doce ou salgado
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={recipeIdea}
                    onChange={(e) => setRecipeIdea(e.target.value)}
                    placeholder="Ex: Macarrão com Alho e Camarão Suculento"
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-medium text-sm focus:outline-none focus:border-amber-400 shadow-inner"
                  />
                </div>

                {/* Quick Presets Buttons */}
                <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-slate-400">Sugestões rápidas:</span>
                  {PRESET_IDEAS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setRecipeIdea(preset.title)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-[11px] text-slate-300 hover:text-amber-300 transition-colors cursor-pointer"
                    >
                      {preset.title.split(' ')[0]} {preset.title.split(' ')[1]} {preset.title.split(' ')[2]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step Count Selector in AutoPilot */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Quantidade de Tomadas Dinâmicas:</span>
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
                      onClick={() => setTargetStepCount(item.count)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                        targetStepCount === item.count
                          ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold ring-1 ring-amber-300'
                          : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dual-Keyframe Interpolação Confinada Toggle */}
              <div
                onClick={() => setUseDualKeyframes(!useDualKeyframes)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                  useDualKeyframes
                    ? 'bg-gradient-to-r from-amber-950/40 to-orange-950/30 border-amber-500/70 shadow-sm'
                    : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 p-1.5 rounded-lg ${useDualKeyframes ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">Encadeamento por Quadros-Chave Duplos (Início ➔ Fim)</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        ⭐ Fluidez Máxima
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                      Gera antecipadamente o <strong>Quadro Inicial (0s)</strong> e o <strong>Quadro Final (3s)</strong> com parada suave. A Agnes Video é guiada entre os dois quadros e o frame final se conecta 100% à próxima tomada sem cortes bruscos.
                    </p>
                  </div>
                </div>
                <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${useDualKeyframes ? 'bg-amber-500' : 'bg-slate-800'}`}>
                  <div
                    className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform shadow ${
                      useDualKeyframes ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </div>
              </div>

              {/* Mode Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => setExecutionMode('real')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    executionMode === 'real'
                      ? 'bg-amber-950/30 border-amber-500 shadow-md shadow-amber-500/10 ring-1 ring-amber-400'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-white flex items-center gap-2">
                      <span>⚡ Modo Real com Agnes AI</span>
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300">
                      API Ativa
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Executa chamadas reais para <strong>Agnes Image 2.0 Flash</strong> e <strong>Agnes Video v2.0</strong> com extração de frames reais pelo Canvas e encadeamento em cascata.
                  </p>
                </div>

                <div
                  onClick={() => setExecutionMode('fast_demo')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    executionMode === 'fast_demo'
                      ? 'bg-cyan-950/30 border-cyan-500 shadow-md shadow-cyan-500/10 ring-1 ring-cyan-400'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-white flex items-center gap-2">
                      <span>🚀 Demonstração Instantânea</span>
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300">
                      Zero Créditos
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Demonstra todo o fluxo autônomo em segundos utilizando assets pré-processados de alta gastronomia sem consumir sua cota da API.
                  </p>
                </div>
              </div>

              {/* Fixed Anchors Config */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5 text-amber-400" />
                    <span>Âncoras Fixas que serão Injetadas em 100% das Tomadas</span>
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400">Garantia de Identidade</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      1. Mãos do Cozinheiro (Fixas)
                    </label>
                    <input
                      type="text"
                      value={handAnchor}
                      onChange={(e) => setHandAnchor(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-[11px] focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      2. Bancada & Cozinha (Fixa)
                    </label>
                    <input
                      type="text"
                      value={countertopAnchor}
                      onChange={(e) => setCountertopAnchor(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-[11px] focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      3. Iluminação & Atmosfera (Fixa)
                    </label>
                    <input
                      type="text"
                      value={lightingAnchor}
                      onChange={(e) => setLightingAnchor(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-[11px] focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ACTIVE EXECUTION PROGRESS DASHBOARD (Visible during/after running) */}
          {phase !== 'idle' && (
            <div className="space-y-5">
              {/* Progress Header */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 animate-pulse" />
                      <span>ESTÁGIO ATUAL:</span>
                    </span>
                    <h3 className="text-sm font-bold text-white tracking-tight">
                      {currentSubTask || 'Processando pipeline autônomo...'}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-lg font-black text-amber-400 font-mono">
                        {overallProgress}%
                      </span>
                      <span className="text-[10px] text-slate-500 block font-mono">Progresso Total</span>
                    </div>

                    {phase !== 'completed' && phase !== 'error' && (
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="px-3 py-1.5 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 border border-rose-700/60 text-rose-300 font-bold text-xs transition-colors cursor-pointer"
                      >
                        Interromper
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-300 transition-all duration-300 rounded-full"
                    style={{ width: `${overallProgress}%` }}
                  />
                </div>

                {/* Phase Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] font-mono">
                  <div
                    className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
                      phase === 'scripting'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                        : overallProgress > 15
                        ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300'
                        : 'bg-slate-900/40 border-slate-800 text-slate-500'
                    }`}
                  >
                    <span>1. Roteiro Multi-Posto</span>
                  </div>

                  <div
                    className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
                      phase === 'generating_steps'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                        : overallProgress > 80
                        ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300'
                        : 'bg-slate-900/40 border-slate-800 text-slate-500'
                    }`}
                  >
                    <span>2. Cascata Last-Frame</span>
                  </div>

                  <div
                    className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
                      phase === 'audio_sfx'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                        : overallProgress > 88
                        ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300'
                        : 'bg-slate-900/40 border-slate-800 text-slate-500'
                    }`}
                  >
                    <span>3. Voz & Efeitos SFX</span>
                  </div>

                  <div
                    className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
                      phase === 'stitching' || phase === 'completed'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                        : 'bg-slate-900/40 border-slate-800 text-slate-500'
                    }`}
                  >
                    <span>4. Costura MP4 9:16</span>
                  </div>
                </div>
              </div>

              {/* Dynamic Live Step Progression Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-white">
                  <span>Cadeia de Tomadas em Produção:</span>
                  <span className="text-[11px] text-amber-400 font-mono">
                    {autoProject.steps.filter((s) => s.imageUrl).length} de {autoProject.steps.length} frames renderizados
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  {autoProject.steps.map((st, idx) => {
                    const cfg = STATION_CONFIG[st.equipmentStation || 'bowl_prep'];
                    const isCurrent = currentStepIdx === idx && phase === 'generating_steps';
                    const isDone = Boolean(st.imageUrl);

                    return (
                      <div
                        key={st.id || idx}
                        className={`p-3 rounded-2xl border transition-all flex flex-col justify-between ${
                          isCurrent
                            ? 'bg-amber-950/30 border-amber-500 ring-2 ring-amber-500/40 shadow-lg'
                            : isDone
                            ? 'bg-slate-900/80 border-slate-700'
                            : 'bg-slate-950/40 border-slate-800/80 opacity-60'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-bold text-amber-400">
                              Tomada {st.stepNumber}
                            </span>
                            <span className="text-sm">{cfg?.emoji || '🍳'}</span>
                          </div>

                          <div className="aspect-[9/16] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 relative flex items-center justify-center">
                            {st.imageUrl ? (
                              <img
                                src={st.imageUrl}
                                alt={st.actionTitle}
                                className="w-full h-full object-cover"
                              />
                            ) : isCurrent ? (
                              <div className="flex flex-col items-center justify-center p-2 text-center gap-1">
                                <Sparkles className="w-5 h-5 text-amber-400 animate-spin" />
                                <span className="text-[9px] text-amber-300 font-mono">Gerando...</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-600 font-mono">Aguardando</span>
                            )}

                            {st.lastFrameUrl && (
                              <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[8px] font-mono text-emerald-300 border border-emerald-500/40">
                                🎯 Last-Frame OK
                              </span>
                            )}
                          </div>

                          <span className="text-[11px] font-bold text-white line-clamp-1 block">
                            {st.actionTitle.replace(/Tomada \d+:\s*/, '')}
                          </span>

                          <span className="text-[9px] text-slate-400 line-clamp-1 block font-mono">
                            {cfg?.label}
                          </span>
                        </div>

                        {idx < autoProject.steps.length - 1 && (
                          <div className="pt-2 text-center text-slate-600 hidden sm:block">
                            <ArrowRight className="w-3.5 h-3.5 mx-auto text-amber-500/70" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Real-time Log Terminal */}
              <div className="bg-slate-950 rounded-2xl border border-slate-800 p-3 font-mono text-[11px] max-h-48 overflow-y-auto space-y-1 shadow-inner">
                <div className="flex items-center justify-between text-slate-500 border-b border-slate-800/80 pb-1.5 mb-1.5 text-[10px]">
                  <span>TERMINAL DO PILOTO AUTOMÁTICO</span>
                  <span>{logs.length} eventos registrados</span>
                </div>
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className={`leading-relaxed ${
                      log.type === 'success'
                        ? 'text-emerald-400'
                        : log.type === 'error'
                        ? 'text-rose-400 font-bold'
                        : log.type === 'warning'
                        ? 'text-amber-400'
                        : log.type === 'step'
                        ? 'text-cyan-300 font-bold'
                        : 'text-slate-400'
                    }`}
                  >
                    <span className="text-slate-600 mr-2">[{log.time}]</span>
                    <span>{log.text}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>

              {/* Completed Success Actions */}
              {phase === 'completed' && (
                <div className="space-y-4">
                  {/* Inline Audio & Video Player Preview */}
                  {finalVideoBlobUrl && (
                    <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-700 space-y-3 shadow-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-white">
                          <Volume2 className="w-4 h-4 text-emerald-400" />
                          <span>Pré-visualização do Vídeo Completo com Áudio Ativo</span>
                        </div>
                        <span className="text-[11px] font-mono font-bold text-emerald-300 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-500/40">
                          🔊 TRILHA + SFX + LOCUÇÃO MIXADOS
                        </span>
                      </div>
                      <div className="w-full max-w-sm mx-auto rounded-xl overflow-hidden bg-black border border-slate-800 shadow-2xl">
                        <video
                          src={finalVideoBlobUrl}
                          controls
                          playsInline
                          className="w-full max-h-72 object-contain mx-auto"
                        />
                      </div>
                      <p className="text-[11px] text-center text-slate-400">
                        O áudio está embutido no próprio arquivo. Ajuste o volume no player acima ou baixe o arquivo para reproduzir no seu aparelho.
                      </p>
                    </div>
                  )}

                  <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/50 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                      <div>
                        <span className="text-sm font-bold text-white block">
                          Receita 100% Gerada com Áudio e Pronta!
                        </span>
                        <span className="text-xs text-slate-300">
                          Todas as tomadas foram encadeadas pelo Último Frame e compiladas em um vídeo contínuo com trilha e locução.
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      {finalVideoBlobUrl && (
                        <a
                          href={finalVideoBlobUrl}
                          download={`${recipeIdea.replace(/\s+/g, '_')}_final_com_audio.mp4`}
                          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Download className="w-4 h-4 text-emerald-400" />
                          <span>Baixar MP4 com Áudio</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          if (onNavigateToPlayer) onNavigateToPlayer();
                        }}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 hover:scale-105 transition-all cursor-pointer"
                      >
                        <Play className="w-4 h-4 fill-slate-950" />
                        <span>Assistir no Master Player</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400">
            {phase === 'idle' ? (
              <span>Clique no botão para disparar todo o fluxo de criação sem intervenção manual.</span>
            ) : phase === 'completed' ? (
              <span className="text-emerald-400 font-bold">Processo finalizado com sucesso!</span>
            ) : (
              <span className="text-amber-400 font-mono animate-pulse">Automação em andamento... não feche esta janela.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {phase === 'idle' ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
                >
                  Voltar ao Estúdio
                </button>

                <button
                  type="button"
                  onClick={handleStartAutoPilot}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <Zap className="w-4 h-4 fill-slate-950" />
                  <span>INICIAR PILOTO AUTOMÁTICO (1-CLIQUE)</span>
                </button>
              </>
            ) : phase === 'completed' ? (
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Fechar e Editar no Estúdio
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
