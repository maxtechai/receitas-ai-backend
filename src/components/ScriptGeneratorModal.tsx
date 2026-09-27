import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Sparkles,
  Wand2,
  Loader2,
  BookOpen,
  Layers,
  Send,
  MessageSquare,
  Check,
  CheckCircle2,
  Film,
  Zap,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import { generateStoryboardScript, chatWithAgnesForSuggestions } from '../services/agnesApi';
import { SceneShot, VideoSuggestion, ChatMessage } from '../types';

interface ScriptGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScriptGenerated: (newShots: Partial<SceneShot>[], title: string, synopsis: string, genre: string) => void;
  apiKey: string;
  onOpenKeyModal: () => void;
}

const QUICK_PROMPTS = [
  '🚀 Viagem espacial e buraco negro',
  '🌆 Cyberpunk com drones sob chuva neon',
  '🕵️ Suspense investigativo na névoa',
  '📱 Vídeo vertical 9:16 moderno para Reels',
  '🐉 Fantasia sombria com castelo gótico',
  '☕ Comercial cinematográfico de café',
];

export const ScriptGeneratorModal: React.FC<ScriptGeneratorModalProps> = ({
  isOpen,
  onClose,
  onScriptGenerated,
  apiKey,
  onOpenKeyModal,
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'form'>('chat');

  // Form Fields
  const [title, setTitle] = useState('Protocolo Submerso');
  const [genre, setGenre] = useState('Sci-Fi Cyberpunk');
  const [synopsis, setSynopsis] = useState(
    'Um mergulhador autômato explora ruínas subaquáticas de uma antiga estação de pesquisa quântica no Oceano Pacífico e descobre um portal orgânico pulsante.'
  );
  const [shotCount, setShotCount] = useState<number>(4);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [appliedSuggestionTitle, setAppliedSuggestionTitle] = useState<string | null>(null);

  // Script Generation State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chat State
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome_msg',
      role: 'assistant',
      content:
        'Olá! Sou o consultor cinematográfico da **Agnes AI**. Que tipo de vídeo ou tema você gostaria de criar hoje? Me diga o que imagina (ou o gênero) e eu vou propor ideias completas com sinopse, estilo visual e enquadramento prontos para você aplicar com 1 clique!',
      suggestions: [
        {
          title: 'Protocolo Submerso',
          genre: 'Sci-Fi Cyberpunk',
          synopsis:
            'Um mergulhador autômato explora ruínas subaquáticas de uma estação quântica no Oceano Pacífico e descobre um portal orgânico pulsante.',
          shotCount: 4,
          aspectRatio: '16:9',
          keyVisual: 'Bioluminescência azul e verde, partículas marinhas e metal enferrujado',
        },
        {
          title: 'O Último Farol da Galáxia',
          genre: 'Cosmic Opera',
          synopsis:
            'Um eremita opera um farol interestelar solitário na beira de um buraco negro, quando um sinal alienígena desconhecido cruza o horizonte de eventos.',
          shotCount: 4,
          aspectRatio: '16:9',
          keyVisual: 'Distorção gravitacional, tons âmbar e estrelas cintilantes',
        },
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  if (!isOpen) return null;

  // Apply a suggestion to the form fields
  const handleApplySuggestion = (sug: VideoSuggestion, triggerDirectGeneration = false) => {
    setTitle(sug.title);
    setGenre(sug.genre);
    setSynopsis(sug.synopsis);
    if (sug.shotCount) setShotCount(sug.shotCount);
    if (sug.aspectRatio) setAspectRatio(sug.aspectRatio);

    setAppliedSuggestionTitle(sug.title);
    setError(null);

    if (triggerDirectGeneration) {
      handleGenerateDirect(sug.title, sug.genre, sug.synopsis, sug.shotCount || shotCount, sug.aspectRatio || aspectRatio);
    } else {
      setActiveTab('form');
    }
  };

  // Send message to Agnes Chat API
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || chatInput).trim();
    if (!text || isChatLoading) return;

    if (!apiKey) {
      setError('Por favor, configure sua Agnes API Key para conversar com o modelo agnes-2.5-flash.');
      return;
    }

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);
    setError(null);

    try {
      // Build history for API
      const history = messages
        .filter((m) => m.id !== 'welcome_msg')
        .concat(userMsg)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const res = await chatWithAgnesForSuggestions(history, apiKey);

      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: res.text,
        suggestions: res.suggestions && res.suggestions.length > 0 ? res.suggestions : undefined,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao comunicar com a Agnes AI.');
      const errAiMsg: ChatMessage = {
        id: `ai_err_${Date.now()}`,
        role: 'assistant',
        content: `Houve uma falha ao consultar a Agnes API: ${err.message}. Verifique sua chave API nas configurações.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errAiMsg]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Generate the actual full shot decupage
  const handleGenerate = async () => {
    handleGenerateDirect(title, genre, synopsis, shotCount, aspectRatio);
  };

  const handleGenerateDirect = async (
    targetTitle: string,
    targetGenre: string,
    targetSynopsis: string,
    targetShotCount: number,
    targetRatio: '16:9' | '9:16' | '1:1'
  ) => {
    if (!apiKey) {
      setError('Por favor, informe sua Agnes API Key para gerar a decupagem de tomadas com IA.');
      return;
    }
    if (!targetSynopsis.trim()) {
      setError('Descreva a sinopse ou conceito da história.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const generatedShots = await generateStoryboardScript(
        {
          synopsis: targetSynopsis,
          genre: targetGenre,
          shotCount: targetShotCount,
          aspectRatio: targetRatio,
        },
        apiKey
      );

      onScriptGenerated(
        generatedShots,
        targetTitle || 'Novo Projeto Cinematográfico',
        targetSynopsis,
        targetGenre
      );
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao gerar a decupagem com a Agnes API.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-[#0e1422] border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] text-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-white">
                Assistente & Chat de Sugestões Agnes IA
              </h3>
              <p className="text-[11px] text-slate-400">
                Peça ideias de vídeos e temas, ou ajuste os parâmetros das cenas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs between Chat and Direct Form */}
        <div className="flex items-center border-b border-slate-800 bg-[#090d16] px-5 py-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'chat'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat de Sugestões de Vídeo</span>
            <span className="text-[10px] font-mono bg-cyan-950/60 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-800/40">
              Agnes 2.5
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'form'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Parâmetros do Roteiro</span>
            {appliedSuggestionTitle && (
              <span className="text-[10px] bg-emerald-950/80 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800/50 flex items-center gap-1">
                <Check className="w-2.5 h-2.5" />
                <span className="truncate max-w-[100px]">Preenchido</span>
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* TAB 1: INTERACTIVE SUGGESTION CHAT */}
          {activeTab === 'chat' && (
            <div className="flex flex-col h-full space-y-4">
              {/* Quick Topic Prompts */}
              <div>
                <p className="text-[11px] font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  <span>Toque para pedir sugestões instantâneas de temas:</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PROMPTS.map((promptText, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(`Sugira ideias de vídeo com o tema: ${promptText}`)}
                      disabled={isChatLoading}
                      className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300 hover:bg-slate-800/60 transition-colors disabled:opacity-50"
                    >
                      {promptText}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Message Stream */}
              <div className="flex-1 space-y-3.5 min-h-[220px]">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-slate-500 font-mono">
                      <span>{msg.role === 'user' ? 'Você' : 'Agnes AI'}</span>
                      <span>·</span>
                      <span>{msg.timestamp}</span>
                    </div>

                    <div
                      className={`max-w-[92%] sm:max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-cyan-600/30 border border-cyan-500/40 text-cyan-100 rounded-tr-xs'
                          : 'bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-xs shadow-md'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.content}</div>

                      {/* Interactive Suggestion Cards generated by Agnes */}
                      {msg.suggestions && msg.suggestions.length > 0 && (
                        <div className="mt-3.5 pt-3 border-t border-slate-800 space-y-2.5">
                          <p className="text-[11px] font-semibold text-cyan-300 flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3 text-cyan-400" />
                            <span>Ideias Prontas para Aplicar (Clique para escolher):</span>
                          </p>

                          <div className="grid grid-cols-1 gap-2.5">
                            {msg.suggestions.map((sug, sIdx) => {
                              const isSelected = appliedSuggestionTitle === sug.title;
                              return (
                                <div
                                  key={sIdx}
                                  className={`p-3 rounded-xl border transition-all text-left ${
                                    isSelected
                                      ? 'bg-cyan-950/40 border-cyan-500/60 ring-1 ring-cyan-500/30'
                                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2 mb-1">
                                    <div>
                                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                                        <span>{sug.title}</span>
                                        {isSelected && (
                                          <span className="text-[10px] text-cyan-400 font-normal">
                                            (Aplicado)
                                          </span>
                                        )}
                                      </h4>
                                      <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-cyan-400">
                                        <span>{sug.genre}</span>
                                        <span>·</span>
                                        <span>{sug.shotCount || 4} Tomadas</span>
                                        <span>·</span>
                                        <span>{sug.aspectRatio || '16:9'}</span>
                                      </div>
                                    </div>
                                  </div>

                                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                                    {sug.synopsis}
                                  </p>

                                  {sug.keyVisual && (
                                    <p className="text-[10px] text-slate-500 mt-1 font-mono">
                                      Estética: {sug.keyVisual}
                                    </p>
                                  )}

                                  {/* Buttons to apply */}
                                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleApplySuggestion(sug, false)}
                                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-medium transition-colors flex items-center gap-1"
                                    >
                                      <Check className="w-3 h-3" />
                                      <span>Aplicar aos Campos</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleApplySuggestion(sug, true)}
                                      disabled={loading}
                                      className="px-3 py-1 rounded-lg bg-gradient-to-r from-cyan-400 to-blue-400 hover:from-cyan-300 hover:to-blue-300 text-slate-950 text-[11px] font-bold transition-all shadow-sm flex items-center gap-1"
                                    >
                                      <Zap className="w-3 h-3 fill-slate-950" />
                                      <span>Aplicar & Decupar Já</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isChatLoading && (
                  <div className="flex items-start gap-2">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-xs p-3 text-xs flex items-center gap-2 text-cyan-300">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                      <span>Agnes AI está criando sugestões de vídeo para você...</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Bar */}
              <div className="pt-2 border-t border-slate-800">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Peça um tema ou tipo de vídeo (ex: Quero um suspense na chuva, ou comercial de perfume)..."
                    disabled={isChatLoading}
                    className="flex-1 px-3.5 py-2.5 text-xs bg-slate-900/90 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="submit"
                    disabled={isChatLoading || !chatInput.trim()}
                    className="p-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-colors disabled:opacity-40 shadow-sm"
                    title="Enviar pergunta para Agnes AI"
                  >
                    {isChatLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: DETAILED PARAMETERS FORM */}
          {activeTab === 'form' && (
            <div className="space-y-4">
              {appliedSuggestionTitle && (
                <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-600/40 text-cyan-300 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Sugestão aplicada com sucesso do Chat: <strong>{appliedSuggestionTitle}</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('chat')}
                    className="underline text-[11px] text-cyan-200"
                  >
                    Voltar ao chat
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Título do Filme / Projeto
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-900/90 border border-slate-700/80 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Gênero / Estilo Visual
                  </label>
                  <input
                    type="text"
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    placeholder="Ex: Cyberpunk, Dark Noir, Western Sci-Fi"
                    className="w-full px-3 py-2 text-sm bg-slate-900/90 border border-slate-700/80 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Sinopse Narrativa das Cenas
                </label>
                <textarea
                  rows={4}
                  value={synopsis}
                  onChange={(e) => setSynopsis(e.target.value)}
                  placeholder="Descreva a história e os momentos principais que deseja ver em vídeo..."
                  className="w-full px-3 py-2 text-xs bg-slate-900/90 border border-slate-700/80 rounded-xl text-white focus:outline-none focus:border-cyan-500 resize-none leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Quantidade de Tomadas</span>
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-900/90 border border-slate-800 rounded-xl">
                    {[3, 4, 6, 8].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setShotCount(count)}
                        className={`py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          shotCount === count
                            ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {count} Cenas
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Formato de Tela (Ratio)
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900/90 border border-slate-800 rounded-xl">
                    {(['16:9', '9:16', '1:1'] as const).map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setAspectRatio(ratio)}
                        className={`py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          aspectRatio === ratio
                            ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-600/40 text-rose-300 text-xs flex items-start justify-between gap-2">
              <span>{error}</span>
              {!apiKey && (
                <button
                  type="button"
                  onClick={onOpenKeyModal}
                  className="underline font-semibold text-rose-200 shrink-0"
                >
                  Inserir chave agora
                </button>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer with Actions */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-800 bg-slate-900/60 shrink-0">
          <p className="text-[11px] text-slate-500 hidden sm:block">
            {activeTab === 'chat'
              ? 'Converse com a Agnes para receber sugestões ou use a aba Parâmetros.'
              : 'A IA decupa a história em planos com prompts visuais e direções de câmera.'}
          </p>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Fechar
            </button>

            {activeTab === 'chat' ? (
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-cyan-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
              >
                <span>Ver Parâmetros Preenchidos</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-gradient-to-r from-cyan-400 to-blue-400 hover:from-cyan-300 hover:to-blue-300 disabled:opacity-50 rounded-lg transition-all shadow-md shadow-cyan-500/10"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Decupando com Agnes...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Gerar Decupagem das Cenas</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
