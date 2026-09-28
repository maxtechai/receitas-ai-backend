/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ShotCard } from './components/ShotCard';
import { StoryboardView } from './components/StoryboardView';
import { ContinuousPlayer } from './components/ContinuousPlayer';
import { ExporterView } from './components/ExporterView';
import { RecipeStudioView } from './components/RecipeStudioView';
import { ApiKeyModal } from './components/ApiKeyModal';
import { ElevenLabsModal } from './components/ElevenLabsModal';
import { ScriptGeneratorModal } from './components/ScriptGeneratorModal';
import { FilmProject, SceneShot, RecipeProject } from './types';
import { initialProject } from './data/sampleProjects';
import { initialRecipeProject } from './data/sampleRecipes';
import {
  generateShotImage,
  createVideoTask,
  pollVideoStatus,
} from './services/agnesApi';
import {
  Clapperboard,
  Sparkles,
  Plus,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Utensils,
  LayoutGrid,
  Download,
} from 'lucide-react';

const STORAGE_KEY_PROJECT = 'agnes_cineforge_project_v1';
const STORAGE_KEY_RECIPE = 'agnes_cineforge_recipe_v2';
const STORAGE_KEY_API = 'agnes_api_key';
const STORAGE_KEY_ELEVENLABS = 'elevenlabs_api_key';
const STORAGE_KEY_ELEVEN_VOICE = 'elevenlabs_voice_id';

export default function App() {
  const [project, setProject] = useState<FilmProject>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PROJECT);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (_) {}
    return initialProject;
  });

  const [recipeProject, setRecipeProject] = useState<RecipeProject>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RECIPE);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (_) {}
    return initialRecipeProject;
  });

  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_API) || '';
  });

  const [elevenLabsKey, setElevenLabsKey] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_ELEVENLABS) || '';
  });

  const [elevenLabsVoiceId, setElevenLabsVoiceId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_ELEVEN_VOICE) || '21m00Tcm4TlvDq8ikWAM';
  });

  const [isElevenLabsModalOpen, setIsElevenLabsModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<'shots' | 'recipe' | 'storyboard' | 'player' | 'exporter'>(() => {
    try {
      const saved = localStorage.getItem('agnes_active_tab');
      if (saved) return saved as any;
    } catch (_) {}
    return 'recipe'; // Default to the requested recipe video studio!
  });

  useEffect(() => {
    try {
      localStorage.setItem('agnes_active_tab', activeTab);
    } catch (_) {}
  }, [activeTab]);

  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);

  // Status maps for generation jobs
  const [generatingImages, setGeneratingImages] = useState<Record<string, boolean>>({});
  const [generatingVideos, setGeneratingVideos] = useState<Record<string, boolean>>({});
  const [isBatchGeneratingImages, setIsBatchGeneratingImages] = useState(false);
  const [isBatchGeneratingVideos, setIsBatchGeneratingVideos] = useState(false);

  // Global flash notification banner
  const [banner, setBanner] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

  // Persist project changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PROJECT, JSON.stringify(project));
    } catch (_) {}
  }, [project]);

  // Persist recipe project changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_RECIPE, JSON.stringify(recipeProject));
    } catch (_) {}
  }, [recipeProject]);

  const showBanner = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    setBanner({ type, message });
    setTimeout(() => {
      setBanner(null);
    }, 4500);
  };

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem(STORAGE_KEY_API, key);
    showBanner('Agnes API Key salva com sucesso!', 'success');
  };

  const handleSaveElevenLabsKey = (key: string, voiceId?: string) => {
    setElevenLabsKey(key);
    localStorage.setItem(STORAGE_KEY_ELEVENLABS, key);
    if (voiceId) {
      setElevenLabsVoiceId(voiceId);
      localStorage.setItem(STORAGE_KEY_ELEVEN_VOICE, voiceId);
    }
    if (key.trim()) {
      showBanner('ElevenLabs conectada com sucesso! Vozes hiper-realistas ativadas com fallback suave.', 'success');
    } else {
      showBanner('Chave ElevenLabs removida. Sistema operando em modo Gemini TTS / navegador.', 'info');
    }
  };

  const handleResetToDemo = () => {
    if (window.confirm('Deseja recarregar o projeto demonstrativo original com todos os frames e vídeos?')) {
      setProject(initialProject);
      showBanner('Projeto demonstrativo recarregado!', 'info');
    }
  };

  // Add a new scene shot
  const handleAddShot = () => {
    const nextOrder = project.shots.length + 1;
    const newShot: SceneShot = {
      id: `shot_${Date.now()}`,
      order: nextOrder,
      title: `Tomada ${String(nextOrder).padStart(2, '0')}: Nova Cena`,
      shotType: 'medium_shot',
      cameraMotion: 'cinematic_tracking',
      narrativeDescription: 'Descreva a ação dramática e elementos visuais desta tomada.',
      imagePrompt: 'Cinematic wide angle shot, dramatic film lighting, atmospheric depth, 8k resolution',
      videoPrompt: 'Smooth cinematic camera movement, realistic motion dynamics, 24fps',
      aspectRatio: project.aspectRatio,
      durationSeconds: 5,
      numFrames: 121,
      frameRate: 24,
      imageStatus: 'idle',
      videoStatus: 'idle',
      transitionToNext: 'crossfade',
    };

    setProject((prev) => ({
      ...prev,
      shots: [...prev.shots, newShot],
      updatedAt: new Date().toISOString(),
    }));

    showBanner(`Nova Tomada ${nextOrder} adicionada!`, 'info');
  };

  // Update shot
  const handleUpdateShot = (updatedShot: SceneShot) => {
    setProject((prev) => ({
      ...prev,
      shots: prev.shots.map((s) => (s.id === updatedShot.id ? updatedShot : s)),
      updatedAt: new Date().toISOString(),
    }));
  };

  // Delete shot
  const handleDeleteShot = (shotId: string) => {
    if (project.shots.length <= 1) {
      showBanner('O projeto deve ter ao menos 1 cena.', 'error');
      return;
    }
    setProject((prev) => {
      const filtered = prev.shots.filter((s) => s.id !== shotId);
      // Re-number orders
      const renumbered = filtered.map((s, idx) => ({ ...s, order: idx + 1 }));
      return {
        ...prev,
        shots: renumbered,
        updatedAt: new Date().toISOString(),
      };
    });
    showBanner('Cena removida.', 'info');
  };

  // Move shot up / down
  const handleMoveShot = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= project.shots.length) return;

    setProject((prev) => {
      const newShots = [...prev.shots];
      const temp = newShots[index];
      newShots[index] = newShots[targetIndex];
      newShots[targetIndex] = temp;

      const renumbered = newShots.map((s, idx) => ({ ...s, order: idx + 1 }));
      return { ...prev, shots: renumbered, updatedAt: new Date().toISOString() };
    });
  };

  // Duplicate shot
  const handleDuplicateShot = (shot: SceneShot) => {
    const clone: SceneShot = {
      ...shot,
      id: `shot_${Date.now()}`,
      order: shot.order + 1,
      title: `${shot.title} (Cópia)`,
      videoStatus: 'idle',
      videoUrl: undefined,
      videoProgress: undefined,
    };

    setProject((prev) => {
      const index = prev.shots.findIndex((s) => s.id === shot.id);
      const newShots = [...prev.shots];
      newShots.splice(index + 1, 0, clone);
      const renumbered = newShots.map((s, idx) => ({ ...s, order: idx + 1 }));
      return { ...prev, shots: renumbered, updatedAt: new Date().toISOString() };
    });

    showBanner('Cena duplicada com sucesso.', 'info');
  };

  // 1. Generate Image for single shot (Agnes Image 2.0 Flash)
  const handleGenerateShotImage = async (shotId: string) => {
    if (!apiKey) {
      setIsKeyModalOpen(true);
      showBanner('Por favor, informe sua Agnes API Key para gerar imagens.', 'error');
      return;
    }

    const shot = project.shots.find((s) => s.id === shotId);
    if (!shot || !shot.imagePrompt.trim()) return;

    setGeneratingImages((prev) => ({ ...prev, [shotId]: true }));
    handleUpdateShot({ ...shot, imageStatus: 'generating' });

    try {
      const imageUrl = await generateShotImage(
        shot.imagePrompt,
        shot.aspectRatio,
        undefined,
        apiKey
      );

      handleUpdateShot({
        ...shot,
        imageUrl,
        imageStatus: 'completed',
        imageError: undefined,
      });
      showBanner(`Frame gerado com sucesso para ${shot.title}!`, 'success');
    } catch (err: any) {
      console.error(err);
      handleUpdateShot({
        ...shot,
        imageStatus: 'failed',
        imageError: err.message,
      });
      showBanner(`Erro na geração do frame: ${err.message}`, 'error');
    } finally {
      setGeneratingImages((prev) => ({ ...prev, [shotId]: false }));
    }
  };

  // 2. Generate Video for single shot (Agnes Video V2.0)
  const handleGenerateShotVideo = async (shotId: string) => {
    if (!apiKey) {
      setIsKeyModalOpen(true);
      showBanner('Por favor, informe sua Agnes API Key para gerar vídeos.', 'error');
      return;
    }

    const shot = project.shots.find((s) => s.id === shotId);
    if (!shot) return;
    if (!shot.imageUrl) {
      showBanner('Gere primeiro o frame de imagem antes de criar o vídeo.', 'error');
      return;
    }

    setGeneratingVideos((prev) => ({ ...prev, [shotId]: true }));
    handleUpdateShot({
      ...shot,
      videoStatus: 'queued',
      videoProgress: 0,
      videoError: undefined,
    });

    try {
      // Find if next shot has keyframe for continuous blend
      const shotIndex = project.shots.findIndex((s) => s.id === shotId);
      const nextShot = shotIndex < project.shots.length - 1 ? project.shots[shotIndex + 1] : null;
      const useKeyframeTransition = shot.transitionToNext === 'keyframe_blend' && nextShot?.imageUrl;

      const task = await createVideoTask(
        {
          prompt: shot.videoPrompt || 'Cinematic tracking shot, photorealistic motion',
          imageUrl: shot.imageUrl,
          secondKeyframeUrl: useKeyframeTransition ? nextShot?.imageUrl : undefined,
          numFrames: shot.numFrames,
          frameRate: shot.frameRate,
          aspectRatio: shot.aspectRatio,
        },
        apiKey
      );

      handleUpdateShot({
        ...shot,
        videoId: task.videoId,
        videoTaskId: task.taskId,
        videoStatus: 'in_progress',
        videoProgress: 15,
        videoSeconds: task.seconds,
      });

      // Poll until video is ready
      const finalVideoUrl = await pollVideoStatus(
        task.videoId,
        task.taskId,
        (progress, status) => {
          setProject((prev) => ({
            ...prev,
            shots: prev.shots.map((s) =>
              s.id === shotId
                ? {
                    ...s,
                    videoStatus: status as any,
                    videoProgress: progress,
                  }
                : s
            ),
          }));
        },
        apiKey
      );

      handleUpdateShot({
        ...shot,
        videoUrl: finalVideoUrl,
        videoStatus: 'completed',
        videoProgress: 100,
      });

      showBanner(`Clipe de vídeo gerado para ${shot.title}!`, 'success');
    } catch (err: any) {
      console.error(err);
      handleUpdateShot({
        ...shot,
        videoStatus: 'failed',
        videoError: err.message,
      });
      showBanner(`Erro na renderização do vídeo: ${err.message}`, 'error');
    } finally {
      setGeneratingVideos((prev) => ({ ...prev, [shotId]: false }));
    }
  };

  // Batch Image Generation
  const handleBatchGenerateImages = async () => {
    if (!apiKey) {
      setIsKeyModalOpen(true);
      showBanner('Configure sua Agnes API Key primeiro.', 'error');
      return;
    }

    const pendingShots = project.shots.filter((s) => !s.imageUrl);
    if (pendingShots.length === 0) {
      showBanner('Todas as cenas já possuem imagem!', 'info');
      return;
    }

    setIsBatchGeneratingImages(true);
    showBanner(`Iniciando geração em lote de ${pendingShots.length} imagens...`, 'info');

    for (const shot of pendingShots) {
      await handleGenerateShotImage(shot.id);
    }

    setIsBatchGeneratingImages(false);
    showBanner('Geração em lote de imagens concluída!', 'success');
  };

  // Batch Video Generation
  const handleBatchGenerateVideos = async () => {
    if (!apiKey) {
      setIsKeyModalOpen(true);
      showBanner('Configure sua Agnes API Key primeiro.', 'error');
      return;
    }

    const eligibleShots = project.shots.filter((s) => s.imageUrl && !s.videoUrl);
    if (eligibleShots.length === 0) {
      showBanner('Nenhuma cena elegível pendente de vídeo.', 'info');
      return;
    }

    setIsBatchGeneratingVideos(true);
    showBanner(`Iniciando renderização de ${eligibleShots.length} clipes de vídeo...`, 'info');

    for (const shot of eligibleShots) {
      await handleGenerateShotVideo(shot.id);
    }

    setIsBatchGeneratingVideos(false);
    showBanner('Renderização de todos os clipes concluída!', 'success');
  };

  // Handle AI Script Generation replacement
  const handleScriptGenerated = (
    newShotsPartial: Partial<SceneShot>[],
    newTitle: string,
    newSynopsis: string,
    newGenre: string
  ) => {
    const fullShots: SceneShot[] = newShotsPartial.map((p, idx) => ({
      id: `shot_${Date.now()}_${idx}`,
      order: idx + 1,
      title: p.title || `Tomada ${String(idx + 1).padStart(2, '0')}`,
      shotType: p.shotType || 'medium_shot',
      cameraMotion: p.cameraMotion || 'cinematic_tracking',
      narrativeDescription: p.narrativeDescription || '',
      imagePrompt: p.imagePrompt || '',
      videoPrompt: p.videoPrompt || '',
      aspectRatio: project.aspectRatio,
      durationSeconds: p.durationSeconds || 5,
      numFrames: p.numFrames || 121,
      frameRate: 24,
      imageStatus: 'idle',
      videoStatus: 'idle',
      transitionToNext: 'crossfade',
    }));

    setProject((prev) => ({
      ...prev,
      title: newTitle,
      synopsis: newSynopsis,
      genre: newGenre,
      shots: fullShots,
      updatedAt: new Date().toISOString(),
    }));

    setActiveTab('shots');
    showBanner(`Roteiro "${newTitle}" gerado com ${fullShots.length} cenas!`, 'success');
  };

  const totalDuration = project.shots.reduce((acc, s) => acc + (s.durationSeconds || 5), 0);

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans">
      {/* Top Bar Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenKeyModal={() => setIsKeyModalOpen(true)}
        onOpenElevenLabsModal={() => setIsElevenLabsModalOpen(true)}
        onOpenScriptModal={() => setIsScriptModalOpen(true)}
        onAddShot={handleAddShot}
        hasApiKey={Boolean(apiKey)}
        hasElevenLabsKey={Boolean(elevenLabsKey)}
        totalDurationSeconds={totalDuration}
      />

      {/* Prominent High-Visibility Mode Selector Banner */}
      <div className="w-full bg-[#0c1220] border-b border-slate-800 px-3 sm:px-6 py-2 shadow-inner">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('recipe')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition-all border ${
                activeTab === 'recipe'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/25 ring-1 ring-amber-400/50'
                  : 'bg-slate-900/90 text-amber-300 border-amber-700/60 hover:bg-slate-800 hover:border-amber-500'
              }`}
            >
              <Utensils className="w-4 h-4" />
              <span>🍳 Vídeos de Receitas (Last-Frame)</span>
              {activeTab === 'recipe' && (
                <span className="text-[10px] bg-black/40 text-amber-200 px-1.5 py-0.2 rounded font-mono">
                  Ativo
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('shots')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition-all border ${
                activeTab !== 'recipe'
                  ? 'bg-slate-800 text-cyan-300 border-cyan-500/50 shadow-sm'
                  : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              <Clapperboard className="w-4 h-4" />
              <span>🎬 Cenas & Ficção</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400 font-mono hidden md:flex items-center gap-2">
            {activeTab === 'recipe' ? (
              <span className="text-amber-400/90 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>Modo Receitas: Passo a Passo com Consistência por Último Frame</span>
              </span>
            ) : (
              <span className="text-cyan-400/90 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span>Modo Cinema: Decupagem e Sequenciamento de Longo Vídeo</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Flash Banner */}
      {banner && (
        <div
          className={`sticky top-[57px] z-30 px-6 py-2.5 text-xs font-medium flex items-center justify-between border-b ${
            banner.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-600/40 text-emerald-200'
              : banner.type === 'error'
              ? 'bg-rose-950/90 border-rose-600/40 text-rose-200'
              : 'bg-cyan-950/90 border-cyan-600/40 text-cyan-200'
          }`}
        >
          <div className="max-w-7xl mx-auto w-full flex items-center gap-2">
            {banner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : banner.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            ) : (
              <Sparkles className="w-4 h-4 text-cyan-400" />
            )}
            <span>{banner.message}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
        {/* TAB 1: SHOTS & SCENE EDITOR */}
        {activeTab === 'shots' && (
          <div className="space-y-6">
            {/* Project Summary Banner */}
            <div className="bg-[#0e1422] border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
                  <span>{project.genre}</span>
                  <span>·</span>
                  <span>Aspect {project.aspectRatio}</span>
                  <span>·</span>
                  <span className="text-slate-400">{project.shots.length} Tomadas</span>
                </div>
                <input
                  type="text"
                  value={project.title}
                  onChange={(e) => setProject({ ...project, title: e.target.value })}
                  className="text-lg font-bold text-white bg-transparent border-b border-transparent hover:border-slate-700 focus:border-cyan-500 focus:outline-none w-full max-w-xl"
                />
                <textarea
                  rows={2}
                  value={project.synopsis}
                  onChange={(e) => setProject({ ...project, synopsis: e.target.value })}
                  placeholder="Sinopse geral do projeto..."
                  className="text-xs text-slate-400 bg-transparent border-b border-transparent hover:border-slate-700 focus:border-cyan-500 focus:outline-none w-full max-w-2xl mt-1 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleResetToDemo}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800 transition-colors"
                  title="Recarregar projeto demonstrativo"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Recarregar Demo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('player')}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors shadow-sm"
                >
                  <Play className="w-3.5 h-3.5 fill-slate-950" />
                  <span>Ver Vídeo Longo ({totalDuration}s)</span>
                </button>
              </div>
            </div>

            {/* Shots List */}
            <div className="space-y-4">
              {project.shots.map((shot, idx) => (
                <ShotCard
                  key={shot.id}
                  shot={shot}
                  isFirst={idx === 0}
                  isLast={idx === project.shots.length - 1}
                  onUpdate={handleUpdateShot}
                  onDelete={() => handleDeleteShot(shot.id)}
                  onMoveUp={() => handleMoveShot(idx, 'up')}
                  onMoveDown={() => handleMoveShot(idx, 'down')}
                  onDuplicate={() => handleDuplicateShot(shot)}
                  onGenerateImage={handleGenerateShotImage}
                  onGenerateVideo={handleGenerateShotVideo}
                  isGeneratingImage={Boolean(generatingImages[shot.id])}
                  isGeneratingVideo={Boolean(generatingVideos[shot.id])}
                />
              ))}
            </div>

            {/* Bottom Add Scene Button */}
            <div className="pt-2 flex items-center justify-center">
              <button
                type="button"
                onClick={handleAddShot}
                className="flex items-center gap-2 px-5 py-3 rounded-xl border border-dashed border-slate-700 hover:border-cyan-500 bg-slate-900/40 hover:bg-slate-900/80 text-xs font-semibold text-slate-300 hover:text-cyan-300 transition-all w-full justify-center"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Adicionar Próxima Tomada à Linha do Tempo</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: DEDICATED RECIPE STUDIO (LAST-FRAME CONTINUITY) */}
        {activeTab === 'recipe' && (
          <RecipeStudioView
            recipe={recipeProject}
            onUpdateRecipe={setRecipeProject}
            apiKey={apiKey}
            onOpenKeyModal={() => setIsKeyModalOpen(true)}
            onOpenElevenLabsModal={() => setIsElevenLabsModalOpen(true)}
            showToast={showBanner}
            onNavigateToPlayer={() => setActiveTab('player')}
          />
        )}

        {/* TAB 3: STORYBOARD MATRIX */}
        {activeTab === 'storyboard' && (
          <StoryboardView
            project={project}
            onSelectShot={(shotId) => {
              setActiveTab('shots');
              // scroll to shot
            }}
            onBatchGenerateImages={handleBatchGenerateImages}
            onBatchGenerateVideos={handleBatchGenerateVideos}
            isBatchGeneratingImages={isBatchGeneratingImages}
            isBatchGeneratingVideos={isBatchGeneratingVideos}
            onPlayContinuous={() => setActiveTab('player')}
          />
        )}

        {/* TAB 3: MASTER CONTINUOUS VIDEO PLAYER */}
        {activeTab === 'player' && (
          <ContinuousPlayer
            project={project}
            onEditShot={(shotId) => {
              setActiveTab('shots');
            }}
          />
        )}

        {/* TAB 4: EXPORTER & STITCHER */}
        {activeTab === 'exporter' && <ExporterView project={project} />}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-800/80 py-4 px-6 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto mb-16 lg:mb-0">
        <p>Agnes CineForge · Criação de Cenas & Vídeos Longos via Agnes AI API</p>
        <div className="flex items-center gap-4 text-[11px] text-slate-400">
          <span>Modelos: agnes-2.5-flash · agnes-image-2.0-flash · agnes-video-v2.0</span>
        </div>
      </footer>

      {/* Fixed Mobile Bottom Navigation Bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#090d16]/95 backdrop-blur-md border-t border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-2xl">
        <button
          onClick={() => setActiveTab('recipe')}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-lg text-[10px] font-medium transition-colors ${
            activeTab === 'recipe'
              ? 'text-amber-400 font-bold bg-amber-500/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>Receitas</span>
        </button>

        <button
          onClick={() => setActiveTab('shots')}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-lg text-[10px] font-medium transition-colors ${
            activeTab === 'shots'
              ? 'text-cyan-400 font-bold bg-cyan-500/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clapperboard className="w-4 h-4" />
          <span>Cenas</span>
        </button>

        <button
          onClick={() => setActiveTab('storyboard')}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-lg text-[10px] font-medium transition-colors ${
            activeTab === 'storyboard'
              ? 'text-cyan-400 font-bold bg-cyan-500/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          <span>Storyboard</span>
        </button>

        <button
          onClick={() => setActiveTab('player')}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-lg text-[10px] font-medium transition-colors ${
            activeTab === 'player'
              ? 'text-cyan-400 font-bold bg-cyan-500/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Play className="w-4 h-4" />
          <span>Player</span>
        </button>

        <button
          onClick={() => setActiveTab('exporter')}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-lg text-[10px] font-medium transition-colors ${
            activeTab === 'exporter'
              ? 'text-cyan-400 font-bold bg-cyan-500/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>Exportar</span>
        </button>
      </div>

      {/* Modals */}
      <ApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        apiKey={apiKey}
        onSaveKey={handleSaveApiKey}
      />

      <ElevenLabsModal
        isOpen={isElevenLabsModalOpen}
        onClose={() => setIsElevenLabsModalOpen(false)}
        apiKey={elevenLabsKey}
        selectedVoiceId={elevenLabsVoiceId}
        onSaveKey={handleSaveElevenLabsKey}
      />

      <ScriptGeneratorModal
        isOpen={isScriptModalOpen}
        onClose={() => setIsScriptModalOpen(false)}
        onScriptGenerated={handleScriptGenerated}
        apiKey={apiKey}
        onOpenKeyModal={() => {
          setIsScriptModalOpen(false);
          setIsKeyModalOpen(true);
        }}
      />
    </div>
  );
}
