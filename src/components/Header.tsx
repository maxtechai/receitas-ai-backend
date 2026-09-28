import React from 'react';
import { Film, Clapperboard, Sparkles, Key, Play, Download, Plus, LayoutGrid, Utensils, Mic } from 'lucide-react';

interface HeaderProps {
  activeTab: 'shots' | 'recipe' | 'storyboard' | 'player' | 'exporter';
  setActiveTab: (tab: 'shots' | 'recipe' | 'storyboard' | 'player' | 'exporter') => void;
  onOpenKeyModal: () => void;
  onOpenElevenLabsModal?: () => void;
  onOpenScriptModal: () => void;
  onAddShot: () => void;
  hasApiKey: boolean;
  hasElevenLabsKey?: boolean;
  totalDurationSeconds: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenKeyModal,
  onOpenElevenLabsModal,
  onOpenScriptModal,
  onAddShot,
  hasApiKey,
  hasElevenLabsKey = false,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-[#090d16]/95 backdrop-blur-md px-3 sm:px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 via-orange-500 to-cyan-500 flex items-center justify-center text-white shadow-lg shrink-0">
            <Utensils className="w-4 h-4" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-white font-[Cabinet_Grotesk] leading-none block">
              Agnes CineForge
            </span>
            <span className="text-[10px] font-mono text-amber-400 leading-none">
              AI Video & Recipe Studio
            </span>
          </div>
        </div>

        {/* Desktop Quick Nav */}
        <nav className="hidden lg:flex items-center gap-1 p-1 bg-slate-900/90 border border-slate-800 rounded-xl">
          <button
            onClick={() => setActiveTab('recipe')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'recipe'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-amber-400 hover:text-amber-300 hover:bg-slate-800'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>🍳 Vídeos de Receitas</span>
            <span className="text-[9px] font-mono bg-black/40 px-1 py-0.5 rounded text-amber-200">
              Last-Frame
            </span>
          </button>

          <button
            onClick={() => setActiveTab('shots')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'shots'
                ? 'bg-slate-800 text-cyan-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clapperboard className="w-3.5 h-3.5" />
            <span>Cenas de Cinema</span>
          </button>

          <button
            onClick={() => setActiveTab('storyboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'storyboard'
                ? 'bg-slate-800 text-cyan-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Storyboard</span>
          </button>

          <button
            onClick={() => setActiveTab('player')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'player'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>Player</span>
          </button>

          <button
            onClick={() => setActiveTab('exporter')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'exporter'
                ? 'bg-slate-800 text-cyan-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar</span>
          </button>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5">
          {/* ElevenLabs Modal Trigger */}
          {onOpenElevenLabsModal && (
            <button
              onClick={onOpenElevenLabsModal}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                hasElevenLabsKey
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                  : 'bg-slate-900 border-slate-700/80 text-slate-300 hover:text-white hover:border-slate-600'
              }`}
              title="Configurar ElevenLabs (Vozes Ultra-Realistas com fallback automático)"
            >
              <Mic className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">
                {hasElevenLabsKey ? 'ElevenLabs Conectada' : 'ElevenLabs'}
              </span>
            </button>
          )}

          <button
            onClick={onOpenKeyModal}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              hasApiKey
                ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-300'
                : 'bg-amber-950/40 border-amber-700/50 text-amber-300'
            }`}
            title="Configurar Agnes AI API Key"
          >
            <Key className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {hasApiKey ? 'Agnes Conectada' : 'Inserir Key'}
            </span>
          </button>

          {activeTab !== 'recipe' ? (
            <>
              <button
                onClick={onOpenScriptModal}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Roteiro IA</span>
              </button>

              <button
                onClick={onAddShot}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-lg shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="hidden sm:inline">Nova Cena</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setActiveTab('shots')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-300 bg-cyan-950/40 border border-cyan-800/60 rounded-lg hover:bg-cyan-900/40 transition-colors"
            >
              <Film className="w-3.5 h-3.5" />
              <span>Modo Cinema</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
