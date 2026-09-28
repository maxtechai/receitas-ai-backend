import React, { useState, useEffect } from 'react';
import { X, Mic, CheckCircle2, AlertCircle, ExternalLink, Loader2, Sparkles, Volume2, ShieldCheck, Trash2, Play, Square } from 'lucide-react';
import { testElevenLabsKey, getElevenLabsVoices, ElevenLabsVoice } from '../services/elevenLabsApi';
import { audioEngine } from '../utils/audioSynth';

interface ElevenLabsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveKey: (key: string, voiceId?: string) => void;
  selectedVoiceId?: string;
}

export const ElevenLabsModal: React.FC<ElevenLabsModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  onSaveKey,
  selectedVoiceId = '21m00Tcm4TlvDq8ikWAM', // Rachel default
}) => {
  const [inputKey, setInputKey] = useState(apiKey);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    valid: boolean;
    tier?: string;
    characterCount?: number;
    characterLimit?: number;
    message: string;
  } | null>(null);

  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [currentVoiceId, setCurrentVoiceId] = useState(selectedVoiceId);
  const [showKey, setShowKey] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const loadVoices = React.useCallback(async (key: string) => {
    if (!key.trim()) return;
    setLoadingVoices(true);
    try {
      const voiceList = await getElevenLabsVoices(key);
      if (voiceList && voiceList.length > 0) {
        setVoices(voiceList);
      }
    } catch {
      // Silent catch
    } finally {
      setLoadingVoices(false);
    }
  }, []);

  useEffect(() => {
    setInputKey(apiKey);
    if (apiKey.trim()) {
      // Auto-load voices if key exists
      loadVoices(apiKey.trim());
    }
  }, [apiKey, loadVoices]);

  if (!isOpen) return null;

  const handleTestPreviewVoice = async () => {
    if (isPlayingPreview) {
      audioEngine.stopSpeech();
      setIsPlayingPreview(false);
      return;
    }

    setIsPlayingPreview(true);
    // Sample culinary voiceover sentence
    const sampleText = 'Olha esse resultado! Dourado por fora, super macio por dentro e com aroma irresistível.';
    
    // Temporarily set the key in localStorage so audioEngine fetches with this test key
    if (inputKey.trim()) {
      localStorage.setItem('elevenlabs_api_key', inputKey.trim());
      localStorage.setItem('elevenlabs_voice_id', currentVoiceId);
    }

    await audioEngine.speak(sampleText, () => {
      setIsPlayingPreview(false);
    });
  };

  const handleTest = async () => {
    if (!inputKey.trim()) {
      setTestResult({ valid: false, message: 'Digite sua chave xi-api-key antes de testar.' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testElevenLabsKey(inputKey.trim());
      setTestResult(res);
      if (res.valid) {
        loadVoices(inputKey.trim());
      }
    } catch (err: any) {
      setTestResult({ valid: false, message: err.message || 'Falha ao testar chave ElevenLabs.' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    onSaveKey(inputKey.trim(), currentVoiceId);
    onClose();
  };

  const handleClearKey = () => {
    setInputKey('');
    setTestResult(null);
    setVoices([]);
    onSaveKey('', '');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-lg bg-[#0c101b] border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-7 text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>Configurar ElevenLabs</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Vozes Ultra-Realistas
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Conecte sua conta para gerar locuções com suas vozes e cotas oficiais
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 py-4 max-h-[75vh] overflow-y-auto pr-1">
          {/* Flexible Mode Banner */}
          <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-200/90 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold text-amber-300 block mb-0.5">
                Modo Flexível com Fallbacks Automáticos:
              </span>
              <span>
                Se você conectar a ElevenLabs, suas vozes hiper-realistas serão a prioridade. Se sua cota acabar ou a rede oscilar, o sistema faz <strong>fallback suave para o Gemini TTS</strong> e depois para o <strong>sintetizador local do navegador</strong> sem nunca interromper seu vídeo!
              </span>
            </div>
          </div>

          {/* Key Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <span>Sua API Key da ElevenLabs (xi-api-key)</span>
              </label>
              <a
                href="https://elevenlabs.io/app/settings/api-keys"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium"
              >
                <span>Obter chave na ElevenLabs</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={inputKey}
                onChange={(e) => {
                  setInputKey(e.target.value);
                  setTestResult(null);
                }}
                placeholder="Ex: sk_xxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-900 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono pr-20"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-1 rounded text-[11px] font-mono text-slate-400 hover:text-white bg-slate-800"
              >
                {showKey ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          {/* Test Action & Quota Info */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !inputKey.trim()}
              className="flex-1 py-2 px-3 text-xs font-bold text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700 disabled:opacity-50 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              {testing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  <span>Verificando com a ElevenLabs...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Verificar Chave & Ver Cotas</span>
                </>
              )}
            </button>
          </div>

          {/* Test & Quota Card */}
          {testResult && (
            <div
              className={`p-3.5 rounded-2xl border text-xs space-y-2 ${
                testResult.valid
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {testResult.valid ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-bold text-xs">
                    {testResult.valid ? 'Chave Verificada com Sucesso!' : 'Falha na Verificação'}
                  </p>
                  <p className="text-[11px] opacity-90 mt-0.5">{testResult.message}</p>
                </div>
              </div>

              {testResult.valid && testResult.characterLimit !== undefined && (
                <div className="pt-2 border-t border-emerald-500/20 space-y-1.5 text-[11px]">
                  <div className="flex justify-between items-center text-slate-300">
                    <span className="font-semibold text-emerald-300">
                      Plano: {testResult.tier || 'Free'}
                    </span>
                    <span className="font-mono text-slate-400">
                      {testResult.characterCount?.toLocaleString() || 0} / {testResult.characterLimit?.toLocaleString()} caracs
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(((testResult.characterCount || 0) / (testResult.characterLimit || 10000)) * 100),
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 pt-0.5">
                    <span>Restante na conta:</span>
                    <span className="font-bold text-emerald-300 font-mono">
                      {Math.max(0, (testResult.characterLimit || 10000) - (testResult.characterCount || 0)).toLocaleString()} caracteres
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Voice Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Voz Padrão para Locução:</span>
              </span>
              <div className="flex items-center gap-2">
                {loadingVoices && (
                  <span className="text-[10px] text-amber-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Carregando vozes...
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleTestPreviewVoice}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                    isPlayingPreview
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                  }`}
                  title="Ouvir uma frase demonstrativa com esta voz"
                >
                  {isPlayingPreview ? (
                    <>
                      <Square className="w-3 h-3 fill-white" />
                      <span>Parar Áudio</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 fill-amber-300" />
                      <span>Ouvir Voz</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <select
              value={currentVoiceId}
              onChange={(e) => setCurrentVoiceId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700/80 rounded-xl text-white focus:outline-none focus:border-amber-500 font-medium"
            >
              {voices.length > 0 ? (
                voices.map((v) => (
                  <option key={v.voice_id} value={v.voice_id}>
                    {v.name} ({v.category || 'Voz'} · {v.labels?.accent || 'Natural'})
                  </option>
                ))
              ) : (
                <>
                  <option value="21m00Tcm4TlvDq8ikWAM">Rachel (Calma & Gastronômica)</option>
                  <option value="AZnzlk1XvdvUeBnXmlld">Domi (Forte & Confiante)</option>
                  <option value="EXAVITQu4vr4xnSDxMaL">Bella (Jovem & Dinâmica)</option>
                  <option value="ErXwobaYiN019PkySvjV">Antoni (Voz Masculina Narrativa)</option>
                  <option value="VR6AewLTigWG4xSOukaG">Arnold (Voz Marcante)</option>
                </>
              )}
            </select>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
          <button
            type="button"
            onClick={handleClearKey}
            className="flex items-center gap-1 px-3 py-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-xl transition-colors cursor-pointer"
            title="Remover chave da ElevenLabs deste navegador"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpar Chave</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 rounded-xl transition-all shadow-md shadow-amber-500/20 cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Salvar & Conectar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
