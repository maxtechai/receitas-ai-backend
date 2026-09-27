import React, { useState } from 'react';
import { X, Key, CheckCircle2, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import { testAgnesKey } from '../services/agnesApi';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveKey: (key: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  onSaveKey,
}) => {
  const [inputKey, setInputKey] = useState(apiKey);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleTest = async () => {
    if (!inputKey.trim()) {
      setTestResult({ valid: false, message: 'Digite uma chave antes de testar.' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testAgnesKey(inputKey.trim());
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ valid: false, message: err.message || 'Falha ao testar chave.' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    onSaveKey(inputKey.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#0e1422] border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Configurar Agnes AI API Key</h3>
              <p className="text-xs text-slate-400">Acesse modelos multimodais de imagem, texto e vídeo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 py-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Sua Agnes API Key (Bearer Token)
            </label>
            <div className="relative">
              <input
                type="password"
                value={inputKey}
                onChange={(e) => {
                  setInputKey(e.target.value);
                  setTestResult(null);
                }}
                placeholder="Ex: agnes-live_xxxxxxxxxxxxxxxx"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-900/90 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                testResult.valid
                  ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-600/40 text-rose-300'
              }`}
            >
              {testResult.valid ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              )}
              <div>
                <p className="font-medium">{testResult.valid ? 'Chave Verificada' : 'Falha na Validação'}</p>
                <p className="text-[11px] opacity-80 mt-0.5">{testResult.message}</p>
              </div>
            </div>
          )}

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-300 space-y-2">
            <p className="font-semibold text-slate-200">Modelos integrados neste estúdio:</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
              <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <span className="text-cyan-400 font-mono block">agnes-2.5-flash</span>
                <span className="text-slate-400">Roteiro & Decupagem</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <span className="text-blue-400 font-mono block">agnes-image-2.0</span>
                <span className="text-slate-400">Criação de Frames</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <span className="text-purple-400 font-mono block">agnes-video-v2.0</span>
                <span className="text-slate-400">Animação & Vídeo</span>
              </div>
            </div>
            <div className="pt-1 flex items-center justify-between text-slate-400 text-[11px]">
              <span>Obtenha sua chave no portal da Agnes AI:</span>
              <a
                href="https://apihub.agnes-ai.com"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:underline flex items-center gap-1"
              >
                <span>apihub.agnes-ai.com</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !inputKey.trim()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-lg transition-colors"
          >
            {testing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                <span>Testando Conexão...</span>
              </>
            ) : (
              <span>Testar Chave</span>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors shadow-sm"
            >
              Salvar Configuração
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
