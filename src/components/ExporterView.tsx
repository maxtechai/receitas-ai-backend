import React, { useState } from 'react';
import {
  Download,
  Film,
  FileText,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Play,
  Layers,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { FilmProject } from '../types';
import { stitchLongVideo, generateEDL, StitchProgress } from '../utils/videoStitcher';

interface ExporterViewProps {
  project: FilmProject;
}

export const ExporterView: React.FC<ExporterViewProps> = ({ project }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<StitchProgress | null>(null);
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalDuration = project.shots.reduce((acc, s) => acc + (s.durationSeconds || 5), 0);
  const readyShotsCount = project.shots.filter((s) => s.imageUrl || s.videoUrl).length;

  const handleStartStitch = async () => {
    if (readyShotsCount === 0) {
      setError('Gere ao menos uma imagem ou clipe nas tomadas antes de exportar o vídeo.');
      return;
    }

    setIsExporting(true);
    setError(null);
    setProgress({
      currentShotIndex: 0,
      totalShots: project.shots.length,
      percent: 5,
      statusText: 'Iniciando pipeline de renderização sequencial...',
    });

    try {
      const blob = await stitchLongVideo(project, (p) => {
        setProgress(p);
      });

      const url = URL.createObjectURL(blob);
      setExportedVideoUrl(url);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao compilar o vídeo contínuo.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadEDL = () => {
    const edlContent = generateEDL(project);
    const blob = new Blob([edlContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (project?.title || 'filme').toLowerCase().replace(/\s+/g, '_');
    a.download = `${safeTitle}_timeline.edl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJSON = () => {
    const dataStr = JSON.stringify(project, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (project?.title || 'filme').toLowerCase().replace(/\s+/g, '_');
    a.download = `${safeTitle}_storyboard_bible.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Hero Card */}
      <div className="bg-[#0e1422] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
              <span>AGNES VIDEO STITCHER</span>
              <span>·</span>
              <span>MASTER EXPORT ENGINE</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Exportar Vídeo Longo Sequenciado
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
              Compile as tomadas individuais geradas pela Agnes API em um único vídeo contínuo com transições suaves e letterbox cinematográfico.
            </p>
          </div>

          <div className="text-right">
            <span className="text-[11px] text-slate-400 block">Duração Total</span>
            <span className="text-2xl font-bold font-mono text-cyan-300 tabular-nums">
              {totalDuration}s
            </span>
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-xs text-slate-400 block mb-1">Cenas Prontas</span>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold font-mono text-white">
                {readyShotsCount} / {project.shots.length}
              </span>
              <span className="text-xs text-slate-500">tomadas</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {readyShotsCount === project.shots.length
                ? 'Todas as cenas possuem mídia.'
                : `${project.shots.length - readyShotsCount} ainda pendente(s)`}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-xs text-slate-400 block mb-1">Taxa de Quadros</span>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold font-mono text-cyan-400">24 / 30</span>
              <span className="text-xs text-slate-500">fps master</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Padrão cinematográfico de projeção</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-xs text-slate-400 block mb-1">Áudio Integrado</span>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold font-mono text-emerald-400">
                Opus / Web Audio
              </span>
            </div>
            <p className="text-[11px] text-emerald-500/90 mt-1 font-mono">Trilha Sonora + SFX Culinários</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-xs text-slate-400 block mb-1">Formato de Saída</span>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold font-mono text-purple-400">
                {project.aspectRatio}
              </span>
              <span className="text-xs text-slate-500">WebM / MP4</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Vídeo + Áudio Multiplexados</p>
          </div>
        </div>

        {/* Progress Bar during Export */}
        {isExporting && progress && (
          <div className="p-4 rounded-xl bg-slate-900/90 border border-cyan-500/30 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between text-xs">
              <span className="text-cyan-300 font-medium flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span>{progress.statusText}</span>
              </span>
              <span className="font-mono text-cyan-300 font-bold tabular-nums">
                {progress.percent}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 transition-all duration-200"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Success Export Screen */}
        {exportedVideoUrl && (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-600/40 space-y-4">
            <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Vídeo Longo Compilado com Sucesso!</span>
            </div>

            <div className="aspect-video w-full rounded-lg overflow-hidden bg-black border border-slate-800 shadow-lg">
              <video src={exportedVideoUrl} controls className="w-full h-full object-cover" />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Arquivo contínuo de {totalDuration} segundos pronto para download.
              </span>
              <a
                href={exportedVideoUrl}
                download={`${(project?.title || 'filme').toLowerCase().replace(/\s+/g, '_')}_long_film.webm`}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors shadow-md"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>Baixar Vídeo Longo (.webm)</span>
              </a>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-600/40 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Main Trigger Button */}
        {!isExporting && !exportedVideoUrl && (
          <div className="pt-2">
            <button
              type="button"
              onClick={handleStartStitch}
              className="w-full py-3.5 px-4 rounded-xl text-sm font-bold text-slate-950 bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 hover:from-cyan-300 hover:to-indigo-300 transition-all shadow-lg shadow-cyan-500/10 flex items-center justify-center gap-2"
            >
              <Film className="w-4 h-4" />
              <span>Compilar e Gerar Vídeo Longo Final ({totalDuration}s)</span>
            </button>
          </div>
        )}
      </div>

      {/* Production Package & NLE Exports (EDL / JSON) */}
      <div className="bg-[#0e1422] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span>Pacote de Produção & Pós-Processamento</span>
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Exporte o projeto em formatos profissionais da indústria cinematográfica para edição avançada em suítes como DaVinci Resolve, Adobe Premiere Pro ou Final Cut Pro.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-blue-400" />
              <div>
                <p className="text-xs font-semibold text-white">Timeline EDL (Edit Decision List)</p>
                <p className="text-[11px] text-slate-400">DaVinci Resolve / Premiere Pro</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Arquivo CMX 3600 padrão contendo timecodes precisos, cortes de cada tomada e metadados de prompt.
            </p>
            <button
              type="button"
              onClick={handleDownloadEDL}
              className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar EDL (.edl)</span>
            </button>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2.5">
              <FileCode className="w-4 h-4 text-purple-400" />
              <div>
                <p className="text-xs font-semibold text-white">Storyboard Production Bible</p>
                <p className="text-[11px] text-slate-400">JSON Estruturado Completo</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Exporta todos os prompts da Agnes Image, prompts de câmera Agnes Video, durações e URLs dos frames.
            </p>
            <button
              type="button"
              onClick={handleDownloadJSON}
              className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar Storyboard (.json)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
