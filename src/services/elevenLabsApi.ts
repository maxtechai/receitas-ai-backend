export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
  preview_url?: string;
}

export interface ElevenLabsUserInfo {
  valid: boolean;
  tier?: string;
  characterCount?: number;
  characterLimit?: number;
  message: string;
}

/**
 * Validates an ElevenLabs API key and returns remaining user character quota
 */
export async function testElevenLabsKey(apiKey: string): Promise<ElevenLabsUserInfo> {
  if (!apiKey || !apiKey.trim()) {
    return { valid: false, message: 'Chave não informada.' };
  }

  try {
    const res = await fetch('/api/elevenlabs/user', {
      method: 'GET',
      headers: {
        'x-elevenlabs-key': apiKey.trim(),
      },
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        valid: false,
        message: data.error || `Erro ${res.status}: Chave inválida ou não autorizada na ElevenLabs`,
      };
    }

    return {
      valid: true,
      tier: data.tier || 'free',
      characterCount: data.character_count || 0,
      characterLimit: data.character_limit || 10000,
      message: `Chave verificada com sucesso! Plano: ${data.tier || 'free'} · Caracteres disponíveis: ${(
        (data.character_limit || 10000) - (data.character_count || 0)
      ).toLocaleString()}`,
    };
  } catch (err: any) {
    return {
      valid: false,
      message: `Falha ao conectar com o serviço: ${err.message || 'Servidor inacessível'}`,
    };
  }
}

/**
 * Gets the list of available voices from ElevenLabs
 */
export async function getElevenLabsVoices(apiKey?: string): Promise<ElevenLabsVoice[]> {
  try {
    const headers: Record<string, string> = {};
    if (apiKey && apiKey.trim()) {
      headers['x-elevenlabs-key'] = apiKey.trim();
    }

    const res = await fetch('/api/elevenlabs/voices', { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return data.voices || [];
  } catch {
    return [];
  }
}

/**
 * Synthesizes text using ElevenLabs via server proxy
 */
export async function synthesizeElevenLabsSpeech(
  text: string,
  voiceId?: string,
  apiKey?: string,
): Promise<{ audio: string; mimeType: string; sampleRate?: number } | null> {
  if (!text || !text.trim()) return null;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey && apiKey.trim()) {
      headers['x-elevenlabs-key'] = apiKey.trim();
    }

    const res = await fetch('/api/elevenlabs/tts', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text: text.trim(),
        voiceId: voiceId || '21m00Tcm4TlvDq8ikWAM',
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.audio) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}
