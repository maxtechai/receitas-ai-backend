import React from 'react';
import {
  Film,
  Play,
  Sparkles,
  ImageIcon,
  Video,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { FilmProject, SceneShot } from '../types';

interface StoryboardViewProps {
  project: FilmProject;
  onSelectShot: (shotId: string) => void;
  onBatchGenerateImages: () => void;
  onBatchGenerateVideos: () => void;
  isBatchGeneratingImages: boolean;
  isBatchGeneratingVideos: boolean;
  onPlayContinuous: () => void;
}

export const StoryboardView: React.FC<StoryboardViewProps> = ({
  project,
  onSelectShot,
  onBatchGenerateImages,
  onBatchGenerateVideos,
  isBatchGeneratingImages,
  isBatchGeneratingVideos,
  onPlayContinuous,
}) => {
  const totalDuration = project.shots.reduce((acc, s) => acc + (s.durationSeconds || 5), 0);
  const imagesReadyCount = project.shots.filter((s) => s.imageUrl).length;
  const videosReadyCount = project.shots.filter((s) => s.videoUrl).length;

  return (
    <div className="space-y-6">
      {/* Top Overview & Batch Action Bar */}
      <div className="bg-[#0e1422] border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
              <span>{project.genre}</span>
              <span>·</span>
              <span>Formato {project.aspectRatio}</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">{project.title}</h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              {project.synopsis}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onPlayContinuous}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-950 bg-gradient-to-r from-cyan-400 to-blue-400 hover:from-cyan-300 hover:to-blue-300 transition-all shadow-md shadow-cyan-500/10"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>Reproduzir Vídeo Longo ({totalDuration}s)</span>
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[11px] text-slate-400 block mb-1">Total de Tomadas</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold font-mono text-white">{project.shots.length}</span>
              <span className="text-xs text-slate-500">cenas</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[11px] text-slate-400 block mb-1">Duração Total</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold font-mono text-cyan-400">{totalDuration}</span>
              <span className="text-xs text-slate-500">segundos</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[11px] text-slate-400 block mb-1">Frames Concluídos</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold font-mono text-emerald-400">{imagesReadyCount}</span>
              <span className="text-xs text-slate-500">de {project.shots.length}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[11px] text-slate-400 block mb-1">Clipes de Vídeo</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold font-mono text-purple-400">{videosReadyCount}</span>
              <span className="text-xs text-slate-500">renderizados</span>
            </div>
          </div>
        </div>

        {/* Batch Operations */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-4 border-t border-slate-800/80 text-xs">
          <span className="text-slate-400">Ações em lote para o pipeline:</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBatchGenerateImages}
              disabled={isBatchGeneratingImages || imagesReadyCount === project.shots.length}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 disabled:opacity-40 transition-colors"
            >
              {isBatchGeneratingImages ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Gerando Imagens...</span>
                </>
              ) : (
                <>
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Gerar Imagens Faltantes ({project.shots.length - imagesReadyCount})</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onBatchGenerateVideos}
              disabled={isBatchGeneratingVideos || imagesReadyCount === 0 || videosReadyCount === project.shots.length}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-900/40 hover:bg-purple-800/50 text-purple-300 border border-purple-700/50 disabled:opacity-40 transition-colors"
            >
              {isBatchGeneratingVideos ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Renderizando Clipes...</span>
                </>
              ) : (
                <>
                  <Video className="w-3.5 h-3.5" />
                  <span>Animar Todos os Vídeos ({imagesReadyCount - videosReadyCount})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Storyboard Grid Matrix */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>Matriz de Cenas em Sequência Cronológica</span>
          </h3>
          <span className="text-xs text-slate-500">Clique em qualquer cena para editar detalhes</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {project.shots.map((shot, idx) => (
            <div
              key={shot.id}
              onClick={() => onSelectShot(shot.id)}
              className="group cursor-pointer bg-[#0e1422] border border-slate-800 hover:border-cyan-500/50 rounded-2xl overflow-hidden shadow-md transition-all hover:scale-[1.01]"
            >
              {/* Media Thumbnail */}
              <div className="relative aspect-video bg-slate-950 overflow-hidden">
                {shot.imageUrl ? (
                  <img
                    src={shot.imageUrl}
                    alt={shot.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 p-4">
                    <ImageIcon className="w-8 h-8 mb-1 stroke-1" />
                    <span className="text-[10px]">Frame pendente</span>
                  </div>
                )}

                {/* Badges on Thumbnail */}
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-[10px] font-mono text-cyan-300 border border-white/10">
                  {String(shot.order).padStart(2, '0')} · {shot.durationSeconds}s
                </div>

                <div className="absolute top-2 right-2 flex items-center gap-1">
                  {shot.videoUrl && (
                    <span className="px-1.5 py-0.5 rounded bg-purple-600/90 text-[10px] text-white flex items-center gap-1">
                      <Video className="w-2.5 h-2.5" />
                      <span>Vídeo</span>
                    </span>
                  )}
                  {shot.imageUrl && !shot.videoUrl && (
                    <span className="px-1.5 py-0.5 rounded bg-cyan-600/90 text-[10px] text-white flex items-center gap-1">
                      <ImageIcon className="w-2.5 h-2.5" />
                      <span>Frame</span>
                    </span>
                  )}
                </div>

                {/* Hover Play / Edit overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="px-3 py-1 rounded-lg bg-cyan-500 text-slate-950 text-xs font-semibold shadow-lg">
                    Editar Cena
                  </span>
                </div>
              </div>

              {/* Shot Meta */}
              <div className="p-3.5 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-mono text-cyan-400">{(shot.shotType || 'medium_shot').replace(/_/g, ' ')}</span>
                  <span>{(shot.cameraMotion || 'static_tripod').replace(/_/g, ' ')}</span>
                </div>

                <h4 className="text-xs font-semibold text-white truncate">{shot.title}</h4>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {shot.narrativeDescription || shot.imagePrompt}
                </p>

                {/* Transition marker */}
                {idx < project.shots.length - 1 && (
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
                    <span>Próxima transição:</span>
                    <span className="font-mono text-slate-400">{shot.transitionToNext}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
