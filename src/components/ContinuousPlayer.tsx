import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Film,
  Music,
  Clapperboard,
  SlidersHorizontal,
  Mic,
  Sparkles,
} from 'lucide-react';
import { FilmProject, SceneShot, CulinarySfx } from '../types';
import { audioEngine } from '../utils/audioSynth';

interface ContinuousPlayerProps {
  project: FilmProject;
  onEditShot: (shotId: string) => void;
}

function inferSfxFromShot(shot: any): CulinarySfx {
  if (shot.sfx && shot.sfx !== 'none') return shot.sfx;
  const station = shot.equipmentStation || '';
  const text = `${shot.title || ''} ${shot.actionTitle || ''} ${shot.narrativeDescription || ''}`.toLowerCase();

  if (station === 'cutting_board' || text.includes('cort') || text.includes('pic') || text.includes('tábua')) {
    return 'chop';
  }
  if (station === 'pan_stove' || text.includes('frigideira') || text.includes('azeite') || text.includes('frit') || text.includes('dour')) {
    return 'sizzle';
  }
  if (station === 'pot_boiling' || text.includes('ferv') || text.includes('coz') || text.includes('panela')) {
    return 'stir';
  }
  if (station === 'oven_appliance' || text.includes('forno') || text.includes('air fryer')) {
    return 'timer_ding';
  }
  return 'sizzle';
}

export const ContinuousPlayer: React.FC<ContinuousPlayerProps> = ({ project, onEditShot }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentShotIdx, setCurrentShotIdx] = useState(0);
  const [shotTime, setShotTime] = useState(0); // seconds within current shot
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Audio system controls
  const [isMuted, setIsMuted] = useState(false);
  const [audioAmbientOn, setAudioAmbientOn] = useState(true);
  const [enableSfx, setEnableSfx] = useState(true);
  const [enableVoiceover, setEnableVoiceover] = useState(true);
  const [audioVolume, setAudioVolume] = useState(0.5);

  const isRecipeProject =
    (project as any).steps !== undefined ||
    project.shots.some((s) => (s as any).stepNumber !== undefined) ||
    project.title.toLowerCase().includes('macarrão') ||
    project.title.toLowerCase().includes('receita');

  const [ambientType, setAmbientType] = useState<
    'lofi_kitchen' | 'bossa_gourmet' | 'acoustic_cooking' | 'cyberpunk_synth' | 'cinematic_drone' | 'deep_space'
  >(isRecipeProject ? 'lofi_kitchen' : (project.ambientAudio as any) || 'cinematic_drone');

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const shots = project.shots;
  const currentShot: SceneShot | undefined = shots[currentShotIdx];
  const shotDuration = currentShot?.durationSeconds || 5;

  // Calculate total movie duration
  const totalMovieSeconds = shots.reduce((acc, s) => acc + (s.durationSeconds || 5), 0);

  // Calculate elapsed movie seconds up to current shot + shotTime
  const priorSeconds = shots.slice(0, currentShotIdx).reduce((acc, s) => acc + (s.durationSeconds || 5), 0);
  const currentTotalSeconds = Math.min(totalMovieSeconds, priorSeconds + shotTime);

  // Audio atmosphere controller
  useEffect(() => {
    if (audioAmbientOn && isPlaying && !isMuted) {
      audioEngine.start(ambientType, audioVolume);
    } else {
      audioEngine.stop();
    }
    return () => {
      audioEngine.stop();
    };
  }, [audioAmbientOn, isPlaying, ambientType, isMuted]);

  useEffect(() => {
    audioEngine.setVolume(isMuted ? 0 : audioVolume);
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : audioVolume;
      videoRef.current.muted = isMuted;
    }
  }, [audioVolume, isMuted]);

  // Main playback timer ticker (runs at 100ms)
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setShotTime((prev) => Math.round((prev + 0.1) * 10) / 10);
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Trigger synchronized SFX and Voiceover narration when shot changes during active play
  useEffect(() => {
    if (!isPlaying || isMuted || !currentShot) return;

    // Trigger SFX
    if (enableSfx) {
      const sfx = inferSfxFromShot(currentShot);
      audioEngine.playSfx(sfx);
    }

    // Trigger voiceover TTS
    const voiceoverText = (currentShot as any).voiceoverText;
    if (enableVoiceover && voiceoverText) {
      setTimeout(() => {
        if (isPlaying && !isMuted) {
          audioEngine.speak(voiceoverText);
        }
      }, 350);
    }
  }, [currentShotIdx, isPlaying, isMuted, enableSfx, enableVoiceover]);

  // Advance shot when shotTime reaches duration
  useEffect(() => {
    if (!isPlaying) return;
    if (shotTime >= shotDuration) {
      setShotTime(0);
      if (currentShotIdx < shots.length - 1) {
        setCurrentShotIdx((prev) => prev + 1);
      } else {
        setIsPlaying(false);
        setCurrentShotIdx(0);
        audioEngine.stop();
      }
    }
  }, [shotTime, shotDuration, isPlaying, shots.length, currentShotIdx]);

  // Sync video element with play/pause state and shot changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.currentTime = 0;
      video.muted = isMuted;
      video.volume = isMuted ? 0 : audioVolume;
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isPlaying, currentShotIdx, currentShot?.videoUrl, isMuted, audioVolume]);

  const togglePlay = () => {
    setIsPlaying((prev) => {
      const next = !prev;
      if (!next) {
        audioEngine.stop();
        audioEngine.stopSpeech();
      }
      return next;
    });
  };

  const handleNextShot = () => {
    audioEngine.stopSpeech();
    if (currentShotIdx < shots.length - 1) {
      setCurrentShotIdx((c) => c + 1);
      setShotTime(0);
    }
  };

  const handlePrevShot = () => {
    audioEngine.stopSpeech();
    if (shotTime > 1) {
      setShotTime(0);
      if (videoRef.current) videoRef.current.currentTime = 0;
    } else if (currentShotIdx > 0) {
      setCurrentShotIdx((c) => c - 1);
      setShotTime(0);
    }
  };

  const handleTimelineClick = (shotIdx: number, offsetRatio = 0) => {
    audioEngine.stopSpeech();
    setCurrentShotIdx(shotIdx);
    const targetShotDuration = shots[shotIdx]?.durationSeconds || 5;
    setShotTime(targetShotDuration * offsetRatio);
    if (videoRef.current) {
      videoRef.current.currentTime = targetShotDuration * offsetRatio;
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Format seconds to MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Cinematic Master Player Container */}
      <div
        ref={containerRef}
        className="relative bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col justify-between"
      >
        {/* Aspect Ratio Screen Viewport */}
        <div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center overflow-hidden">
          {/* Active Shot Display */}
          {currentShot?.videoUrl ? (
            <video
              key={currentShot?.id || currentShotIdx}
              ref={videoRef}
              src={currentShot.videoUrl}
              autoPlay={isPlaying}
              loop
              muted={isMuted}
              playsInline
              onCanPlay={(e) => {
                if (isPlaying) {
                  (e.target as HTMLVideoElement).play().catch(() => {});
                }
              }}
              className="w-full h-full object-cover"
            />
          ) : currentShot?.imageUrl ? (
            // Image with subtle cinematic pan/zoom animation
            <div className="relative w-full h-full overflow-hidden">
              <img
                src={currentShot.imageUrl}
                alt={currentShot.title}
                referrerPolicy="no-referrer"
                className={`w-full h-full object-cover transition-transform duration-[6000ms] ease-out ${
                  isPlaying ? 'scale-108 translate-x-1' : 'scale-100'
                }`}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-500 p-8 text-center">
              <Film className="w-12 h-12 stroke-1 text-slate-700 mb-2" />
              <p className="text-sm font-medium text-slate-400">Esta cena ainda não possui frame gerado.</p>
              <button
                type="button"
                onClick={() => onEditShot(currentShot.id)}
                className="mt-3 px-3 py-1.5 rounded-lg bg-slate-800 text-amber-300 text-xs hover:bg-slate-700"
              >
                Gerar com Agnes Image
              </button>
            </div>
          )}

          {/* Cinematic Overlay Details (Top) */}
          <div className="absolute top-0 inset-x-0 p-5 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-start justify-between pointer-events-none">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span>MASTER SEQUENCE CONTÍNUA</span>
                <span>·</span>
                <span>TOMADA {currentShotIdx + 1} DE {shots.length}</span>
              </div>
              <h3 className="text-base font-semibold text-white mt-1 drop-shadow-md">
                {currentShot?.title || (currentShot as any)?.actionTitle}
              </h3>
              <p className="text-xs text-slate-300 max-w-lg mt-0.5 line-clamp-1 drop-shadow">
                {(currentShot as any)?.voiceoverText || currentShot?.narrativeDescription}
              </p>
            </div>

            <div className="text-right font-mono">
              <div className="text-base font-bold text-white tracking-wider tabular-nums">
                {formatTime(currentTotalSeconds)} <span className="text-slate-500">/</span> {formatTime(totalMovieSeconds)}
              </div>
              <div className="flex items-center gap-1.5 justify-end mt-0.5">
                <span className="text-[11px] text-amber-400/90 flex items-center gap-1">
                  {!isMuted ? <Volume2 className="w-3 h-3 text-emerald-400" /> : <VolumeX className="w-3 h-3 text-rose-400" />}
                  <span>{!isMuted ? 'ÁUDIO ATIVO' : 'MUDO'}</span>
                </span>
                <span className="text-[11px] text-slate-400">· 24 FPS</span>
              </div>
            </div>
          </div>

          {/* Subtitle / Voiceover Banner at Bottom of Screen */}
          {(currentShot as any)?.voiceoverText && (
            <div className="absolute bottom-4 inset-x-6 z-10 pointer-events-none">
              <div className="bg-black/75 backdrop-blur-md border border-white/10 rounded-xl px-4 py-2 text-center max-w-xl mx-auto shadow-2xl">
                <span className="text-xs font-medium text-amber-200 block">
                  "{((currentShot as any).voiceoverText || '').trim()}"
                </span>
              </div>
            </div>
          )}

          {/* Center Play/Pause Watermark Tap */}
          <button
            type="button"
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-transparent group focus:outline-none cursor-pointer"
          >
            <div
              className={`w-16 h-16 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all transform ${
                isPlaying ? 'opacity-0 group-hover:opacity-80 scale-90' : 'opacity-90 scale-100 shadow-2xl'
              }`}
            >
              {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 fill-white translate-x-0.5" />}
            </div>
          </button>
        </div>

        {/* Timeline Multi-Shot Scrubber Track */}
        <div className="bg-[#0b0f19] px-6 py-4 border-t border-slate-800 space-y-3">
          {/* Segmented Timeline Bar */}
          <div className="relative w-full h-8 bg-slate-900/90 rounded-xl overflow-hidden flex border border-slate-800 p-1 gap-1">
            {shots.map((shot, idx) => {
              const shotSec = shot.durationSeconds || 5;
              const widthPercent = (shotSec / totalMovieSeconds) * 100;
              const isActive = idx === currentShotIdx;
              const isPast = idx < currentShotIdx;
              const progressWithin = isActive ? (shotTime / shotSec) * 100 : isPast ? 100 : 0;

              return (
                <div
                  key={shot.id}
                  onClick={() => handleTimelineClick(idx)}
                  style={{ width: `${widthPercent}%` }}
                  className={`relative h-full rounded-lg overflow-hidden cursor-pointer transition-all border ${
                    isActive
                      ? 'border-amber-500/80 shadow-md ring-1 ring-amber-500/50'
                      : 'border-slate-800 hover:border-slate-700 bg-slate-950/60'
                  }`}
                  title={`${shot.title} (${shotSec}s)`}
                >
                  <div
                    className={`h-full transition-all duration-100 ${
                      isActive
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                        : isPast
                        ? 'bg-slate-700'
                        : 'bg-transparent'
                    }`}
                    style={{ width: `${progressWithin}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-between px-2 text-[10px] font-mono font-bold text-white/80 pointer-events-none truncate">
                    <span>T{idx + 1}</span>
                    <span className="text-[9px] text-white/50">{shotSec}s</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Player Toolbar Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Left: Transport Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevShot}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Tomada anterior"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                className="w-10 h-10 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold flex items-center justify-center transition-all shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-slate-950" /> : <Play className="w-5 h-5 fill-slate-950 translate-x-0.5" />}
              </button>

              <button
                type="button"
                onClick={handleNextShot}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Próxima tomada"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  audioEngine.stopSpeech();
                  setCurrentShotIdx(0);
                  setShotTime(0);
                }}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Reiniciar vídeo do início"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Timecode counter */}
              <div className="font-mono text-xs text-slate-300 ml-2 border-l border-slate-800 pl-3">
                <span className="text-white font-bold">{formatTime(currentTotalSeconds)}</span>
                <span className="text-slate-500"> / {formatTime(totalMovieSeconds)}</span>
              </div>
            </div>

            {/* Right: Audio Atmosphere, SFX, Narrator & Fullscreen */}
            <div className="flex items-center gap-2.5">
              {/* Master Mute / Unmute Button */}
              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className={`p-2 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
                  !isMuted
                    ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-300 shadow-sm'
                    : 'bg-rose-950/40 border-rose-500/60 text-rose-300'
                }`}
                title={!isMuted ? 'Mutar Áudio' : 'Desmutar Áudio'}
              >
                {!isMuted ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
                <span className="hidden sm:inline">{!isMuted ? 'Áudio Ativo' : 'Mudo'}</span>
              </button>

              {/* Volume Slider */}
              <div className="hidden md:flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : audioVolume}
                  onChange={(e) => {
                    setAudioVolume(parseFloat(e.target.value));
                    if (isMuted) setIsMuted(false);
                  }}
                  className="w-16 h-1 accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Atmosphere Audio Synth Control */}
              <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setAudioAmbientOn(!audioAmbientOn)}
                  className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                    audioAmbientOn && !isMuted ? 'text-amber-400 font-bold' : 'text-slate-500 hover:text-slate-300'
                  }`}
                  title="Trilha musical gourmet em tempo real"
                >
                  <Music className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Trilha</span>
                </button>

                <select
                  value={ambientType}
                  onChange={(e) => setAmbientType(e.target.value as any)}
                  className="bg-slate-800 border border-slate-700 rounded-md px-1.5 py-0.5 text-[11px] text-slate-200 focus:outline-none"
                >
                  <option value="lofi_kitchen">Lofi Gastronômico</option>
                  <option value="bossa_gourmet">Bossa Gourmet</option>
                  <option value="cinematic_drone">Cinema Drone</option>
                  <option value="cyberpunk_synth">Cyber Synth</option>
                </select>
              </div>

              {/* SFX Toggle */}
              <button
                type="button"
                onClick={() => setEnableSfx(!enableSfx)}
                className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-mono flex items-center gap-1 transition-colors cursor-pointer ${
                  enableSfx && !isMuted
                    ? 'bg-amber-950/40 border-amber-600/60 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-500'
                }`}
                title="Efeitos sonoros culinários sincronizados (corte, fritura, fervura)"
              >
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span className="hidden sm:inline">SFX</span>
              </button>

              {/* Voiceover Narrator Toggle */}
              <button
                type="button"
                onClick={() => setEnableVoiceover(!enableVoiceover)}
                className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-mono flex items-center gap-1 transition-colors cursor-pointer ${
                  enableVoiceover && !isMuted
                    ? 'bg-cyan-950/40 border-cyan-600/60 text-cyan-300'
                    : 'bg-slate-900 border-slate-800 text-slate-500'
                }`}
                title="Locução narrada do chef (TTS em português)"
              >
                <Mic className="w-3 h-3 text-cyan-400" />
                <span className="hidden sm:inline">Voz</span>
              </button>

              {/* Fullscreen Button */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Tela Cheia"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Shot Navigator List Below Player */}
      <div className="bg-[#0e1422] border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Clapperboard className="w-3.5 h-3.5 text-amber-400" />
            <span>Fila de Sequenciamento Contínuo ({shots.length} cenas)</span>
          </h4>
          <span className="text-[11px] text-slate-500">
            Mixagem de áudio com trilha gourmet, efeitos culinários e locução do chef
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {shots.map((shot, idx) => {
            const sfx = inferSfxFromShot(shot);
            return (
              <div
                key={shot.id}
                onClick={() => handleTimelineClick(idx)}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                  idx === currentShotIdx
                    ? 'bg-amber-500/10 border-amber-500/60 text-white shadow-md'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                  <span className={idx === currentShotIdx ? 'text-amber-400 font-bold' : ''}>
                    T{String(idx + 1).padStart(2, '0')}
                  </span>
                  <span>{shot.durationSeconds}s</span>
                </div>
                <p className="text-xs font-medium truncate">{shot.title || (shot as any).actionTitle}</p>
                <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500 font-mono">
                  <span className="text-amber-300/80">SFX: {sfx}</span>
                  <span className="text-slate-400">{shot.videoUrl ? '🎬 Vídeo' : '🖼️ Frame'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
