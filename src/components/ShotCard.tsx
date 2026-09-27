import React, { useState } from 'react';
import {
  Image as ImageIcon,
  Video,
  Play,
  RotateCw,
  Loader2,
  ChevronUp,
  ChevronDown,
  Trash2,
  Copy,
  Sliders,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Film,
  Sparkles,
} from 'lucide-react';
import { SceneShot, ShotType, CameraMotion, TransitionType } from '../types';

interface ShotCardProps {
  shot: SceneShot;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (updated: SceneShot) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onGenerateImage: (shotId: string) => void;
  onGenerateVideo: (shotId: string) => void;
  isGeneratingImage: boolean;
  isGeneratingVideo: boolean;
}

const SHOT_TYPES: { id: ShotType; label: string }[] = [
  { id: 'establishing_wide', label: 'Plano Geral / Estabelecedor' },
  { id: 'wide_shot', label: 'Plano Aberto (Wide)' },
  { id: 'medium_shot', label: 'Plano Médio' },
  { id: 'close_up', label: 'Close-Up' },
  { id: 'extreme_close_up', label: 'Super Close-Up / Detalhe' },
  { id: 'drone_aerial', label: 'Aéreo / Drone' },
  { id: 'pov', label: 'Primeira Pessoa (POV)' },
  { id: 'over_the_shoulder', label: 'Sobre o Ombro' },
];

const CAMERA_MOTIONS: { id: CameraMotion; label: string }[] = [
  { id: 'cinematic_tracking', label: 'Tracking / Travelling Contínuo' },
  { id: 'pan_left', label: 'Panorâmica para Esquerda' },
  { id: 'pan_right', label: 'Panorâmica para Direita' },
  { id: 'zoom_in', label: 'Zoom In / Avanço' },
  { id: 'zoom_out', label: 'Zoom Out / Recuo' },
  { id: 'tilt_up', label: 'Tilt para Cima' },
  { id: 'tilt_down', label: 'Tilt para Baixo' },
  { id: 'orbit_360', label: 'Órbita 360°' },
  { id: 'static_tripod', label: 'Câmera Estática' },
];

const TRANSITIONS: { id: TransitionType; label: string }[] = [
  { id: 'crossfade', label: 'Crossfade (Dissolução Suave)' },
  { id: 'keyframe_blend', label: 'Interpolação de Keyframes' },
  { id: 'cut', label: 'Corte Seco (Hard Cut)' },
  { id: 'fade_black', label: 'Fade para Preto' },
];

export const ShotCard: React.FC<ShotCardProps> = ({
  shot,
  isFirst,
  isLast,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onGenerateImage,
  onGenerateVideo,
  isGeneratingImage,
  isGeneratingVideo,
}) => {
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleDurationChange = (sec: number) => {
    const framesMap: Record<number, number> = {
      3: 81,
      5: 121,
      10: 241,
      18: 441,
    };
    onUpdate({
      ...shot,
      durationSeconds: sec,
      numFrames: framesMap[sec] || 121,
    });
  };

  return (
    <div className="bg-[#0e1422] border border-slate-800 rounded-2xl overflow-hidden shadow-lg hover:border-slate-700/80 transition-all">
      {/* Top Shot Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-900/70 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-400 font-mono text-xs font-bold border border-cyan-500/30">
            {String(shot.order).padStart(2, '0')}
          </span>
          <input
            type="text"
            value={shot.title}
            onChange={(e) => onUpdate({ ...shot, title: e.target.value })}
            className="text-sm font-semibold text-white bg-transparent border-b border-transparent hover:border-slate-700 focus:border-cyan-500 focus:outline-none px-1 py-0.5"
          />
        </div>

        {/* Shot Configuration Dropdowns */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={shot.shotType}
            onChange={(e) => onUpdate({ ...shot, shotType: e.target.value as ShotType })}
            className="text-xs bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            {SHOT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>

          <select
            value={shot.cameraMotion}
            onChange={(e) => onUpdate({ ...shot, cameraMotion: e.target.value as CameraMotion })}
            className="text-xs bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            {CAMERA_MOTIONS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>

          {/* Duration Selector */}
          <div className="flex items-center bg-slate-800/80 border border-slate-700 rounded-lg p-0.5 text-xs font-mono">
            {[3, 5, 10, 18].map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => handleDurationChange(sec)}
                className={`px-2 py-1 rounded-md transition-colors ${
                  shot.durationSeconds === sec
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
                title={`${sec}s (${sec === 3 ? '81' : sec === 5 ? '121' : sec === 10 ? '241' : '441'} frames)`}
              >
                {sec}s
              </button>
            ))}
          </div>

          {/* Action Icons */}
          <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
            <button
              onClick={onMoveUp}
              disabled={isFirst}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30"
              title="Mover para cima"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={onMoveDown}
              disabled={isLast}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30"
              title="Mover para baixo"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <button
              onClick={onDuplicate}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              title="Duplicar cena"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800"
              title="Remover cena"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area: Left Viewport (Image or Video) + Right Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-5">
        {/* Left Column: Visual Viewport (6 cols) */}
        <div className="lg:col-span-6 flex flex-col gap-2.5">
          {/* Subtabs for Viewport: Frame de Imagem vs Clipe de Vídeo */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('image')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === 'image'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>1. Frame de Imagem</span>
                {shot.imageUrl && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('video')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === 'video'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>2. Clipe de Vídeo</span>
                {shot.videoUrl && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
              </button>
            </div>

            <span className="text-[11px] font-mono text-slate-500">
              {shot.aspectRatio} · {shot.durationSeconds}s
            </span>
          </div>

          {/* Media Display Screen */}
          <div className="relative aspect-video w-full rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center group shadow-inner">
            {activeTab === 'image' ? (
              // IMAGE VIEW
              shot.imageUrl ? (
                <div className="relative w-full h-full">
                  <img
                    src={shot.imageUrl}
                    alt={shot.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                    <span className="text-xs text-slate-200 truncate">
                      {shot.imagePrompt}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500">
                  <ImageIcon className="w-10 h-10 mb-2 stroke-1 text-slate-600" />
                  <p className="text-xs font-medium text-slate-400">Nenhum frame gerado ainda</p>
                  <p className="text-[11px] text-slate-600 mt-1 max-w-xs">
                    Edite o prompt ao lado e clique em "Gerar Imagem" com Agnes Image 2.0 Flash
                  </p>
                </div>
              )
            ) : (
              // VIDEO VIEW
              shot.videoUrl ? (
                <div className="relative w-full h-full">
                  <video
                    src={shot.videoUrl}
                    controls
                    loop
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : isGeneratingVideo ? (
                <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                  <div>
                    <p className="text-xs font-semibold text-purple-300">
                      Renderizando Vídeo com Agnes Video V2.0...
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {shot.videoProgress !== undefined ? `Progresso: ${shot.videoProgress}%` : 'Na fila de processamento...'}
                    </p>
                  </div>
                  {shot.videoProgress !== undefined && (
                    <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 transition-all duration-300"
                        style={{ width: `${shot.videoProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500">
                  <Video className="w-10 h-10 mb-2 stroke-1 text-slate-600" />
                  <p className="text-xs font-medium text-slate-400">Nenhum clipe gerado ainda</p>
                  <p className="text-[11px] text-slate-600 mt-1 max-w-xs">
                    Gere primeiro a imagem base, depois clique em "Gerar Vídeo" para animar este frame com Agnes Video.
                  </p>
                </div>
              )
            )}

            {/* Loading Overlay for Image Generation */}
            {isGeneratingImage && activeTab === 'image' && (
              <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-7 h-7 text-cyan-400 animate-spin" />
                <span className="text-xs font-medium text-cyan-300">
                  Criando imagem com Agnes Image 2.0...
                </span>
              </div>
            )}
          </div>

          {/* Quick Status Bar */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  shot.videoStatus === 'completed'
                    ? 'bg-emerald-400'
                    : shot.imageStatus === 'completed'
                    ? 'bg-cyan-400'
                    : 'bg-slate-600'
                }`}
              />
              <span>
                {shot.videoStatus === 'completed'
                  ? 'Clipe pronto'
                  : shot.imageStatus === 'completed'
                  ? 'Frame pronto para animar'
                  : 'Aguardando geração'}
              </span>
            </span>

            {shot.imageUrl && (
              <a
                href={shot.imageUrl}
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:underline flex items-center gap-1"
              >
                <span>Ver frame HD</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* Right Column: Prompts & Generator Controls (6 cols) */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
          <div className="space-y-3.5">
            {/* Narrative description */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Contexto Narrativo da Tomada
              </label>
              <input
                type="text"
                value={shot.narrativeDescription}
                onChange={(e) => onUpdate({ ...shot, narrativeDescription: e.target.value })}
                placeholder="Ex: O protagonista avança pela ponte sob chuva torrencial..."
                className="w-full px-3 py-1.5 text-xs bg-slate-900/90 border border-slate-700/80 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Prompt for Agnes Image 2.0 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-cyan-300 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Prompt de Imagem (Agnes Image 2.0 Flash)</span>
                </label>
                <span className="text-[10px] text-slate-500">Gera a cena estática base</span>
              </div>
              <textarea
                rows={3}
                value={shot.imagePrompt}
                onChange={(e) => onUpdate({ ...shot, imagePrompt: e.target.value })}
                placeholder="Prompt descritivo em inglês para geração de frame cinematográfico..."
                className="w-full px-3 py-2 text-xs bg-slate-900/90 border border-slate-700/80 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500 font-mono leading-relaxed resize-none"
              />
            </div>

            {/* Prompt for Agnes Video V2.0 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-purple-300 flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5" />
                  <span>Prompt de Vídeo & Câmera (Agnes Video V2.0)</span>
                </label>
                <span className="text-[10px] text-slate-500">Descreve ação e movimento</span>
              </div>
              <textarea
                rows={2}
                value={shot.videoPrompt}
                onChange={(e) => onUpdate({ ...shot, videoPrompt: e.target.value })}
                placeholder="Ex: Slow cinematic tracking camera movement, rain drops falling in slow motion..."
                className="w-full px-3 py-2 text-xs bg-slate-900/90 border border-slate-700/80 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500 font-mono leading-relaxed resize-none"
              />
            </div>

            {/* Transition to next shot selector */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
              <span className="text-slate-400">Transição para próxima tomada:</span>
              <select
                value={shot.transitionToNext}
                onChange={(e) =>
                  onUpdate({ ...shot, transitionToNext: e.target.value as TransitionType })
                }
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
              >
                {TRANSITIONS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Buttons: Generate Image & Generate Video */}
          <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onGenerateImage(shot.id)}
              disabled={isGeneratingImage || !shot.imagePrompt.trim()}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 disabled:opacity-40 transition-colors shadow-sm"
            >
              {isGeneratingImage ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Criando Frame...</span>
                </>
              ) : (
                <>
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>{shot.imageUrl ? 'Recriar Imagem' : '1. Gerar Imagem'}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => onGenerateVideo(shot.id)}
              disabled={isGeneratingVideo || !shot.imageUrl}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-semibold rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white disabled:opacity-40 transition-all shadow-md shadow-purple-900/20"
            >
              {isGeneratingVideo ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Animando Clipe...</span>
                </>
              ) : (
                <>
                  <Video className="w-3.5 h-3.5" />
                  <span>{shot.videoUrl ? 'Reanimar Vídeo' : '2. Gerar Vídeo IA'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
