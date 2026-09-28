// Web Audio API generator for cinematic atmosphere, culinary soundscapes, and synchronized video audio
import { CulinarySfx } from '../types';

/**
 * Decodes base64 audio into an AudioBuffer (supports raw PCM16 and MP3/WAV container formats)
 */
export async function decodeBase64ToAudioBuffer(
  ctx: AudioContext,
  base64: string,
  mimeType: string = 'audio/pcm',
  sampleRate: number = 24000,
): Promise<AudioBuffer> {
  const binary = atob(base64);
  const len = binary.length;
  const buffer = new ArrayBuffer(len);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < len; i++) {
    view[i] = binary.charCodeAt(i);
  }

  // If MP3, AAC or WAV, use the browser's native decodeAudioData
  if (mimeType.includes('mp3') || mimeType.includes('mpeg') || mimeType.includes('wav')) {
    try {
      return await ctx.decodeAudioData(buffer.slice(0));
    } catch (e) {
      console.warn('Native decodeAudioData error, attempting raw fallback:', e);
    }
  }

  // Linear PCM 16-bit 24kHz fallback
  const int16View = new Int16Array(buffer);
  const numSamples = int16View.length;
  const audioBuffer = ctx.createBuffer(1, numSamples, sampleRate);
  const channelData = audioBuffer.getChannelData(0);
  for (let i = 0; i < numSamples; i++) {
    channelData[i] = int16View[i] / 32768.0;
  }
  return audioBuffer;
}

/**
 * Decodes 16-bit linear PCM base64 audio (e.g. from Gemini TTS 24kHz) into an AudioBuffer
 */
export function pcm16ToAudioBuffer(
  ctx: AudioContext,
  base64: string,
  sampleRate: number = 24000,
): AudioBuffer {
  const binary = atob(base64);
  const len = binary.length;
  const buffer = new ArrayBuffer(len);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < len; i++) {
    view[i] = binary.charCodeAt(i);
  }
  const int16View = new Int16Array(buffer);
  const numSamples = int16View.length;
  const audioBuffer = ctx.createBuffer(1, numSamples, sampleRate);
  const channelData = audioBuffer.getChannelData(0);
  for (let i = 0; i < numSamples; i++) {
    channelData[i] = int16View[i] / 32768.0;
  }
  return audioBuffer;
}

// Client-side cache for decoded voiceover AudioBuffers to avoid re-fetching
const clientVoiceoverCache = new Map<string, AudioBuffer>();
let ttsCooldownUntil = 0;

/**
 * Fetches high-fidelity Portuguese speech narration from server /api/tts
 * Automatically utilizes ElevenLabs if key exists, falling back seamlessly to Gemini TTS and SpeechSynthesis.
 */
export async function fetchVoiceoverAudioBuffer(
  ctx: AudioContext,
  text: string,
  voice: string = 'Kore',
  customVoiceId?: string,
): Promise<AudioBuffer | null> {
  if (!text || !text.trim()) return null;
  const cleanText = text.trim();
  const elevenKey = typeof window !== 'undefined' ? localStorage.getItem('elevenlabs_api_key') || '' : '';
  const storedVoiceId = typeof window !== 'undefined' ? localStorage.getItem('elevenlabs_voice_id') || '' : '';
  const activeVoiceId = customVoiceId || storedVoiceId || '21m00Tcm4TlvDq8ikWAM';
  const cacheKey = `${elevenKey ? '11labs:' + activeVoiceId : voice}:${cleanText}`;

  // 1. Instant return from client cache
  if (clientVoiceoverCache.has(cacheKey)) {
    return clientVoiceoverCache.get(cacheKey)!;
  }

  // 2. If currently in quota cooldown, skip network request smoothly
  if (Date.now() < ttsCooldownUntil) {
    return null;
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (elevenKey) {
      headers['x-elevenlabs-key'] = elevenKey;
    }

    const res = await fetch('/api/tts', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text: cleanText,
        voice,
        voiceId: activeVoiceId,
      }),
    });

    if (!res.ok) return null;
    const rawText = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      return null;
    }

    if (data?.quotaExceeded) {
      // Set 1-minute cooldown to avoid hammering the quota
      ttsCooldownUntil = Date.now() + 60000;
      return null;
    }

    if (data && data.audio) {
      const buffer = await decodeBase64ToAudioBuffer(
        ctx,
        data.audio,
        data.mimeType || 'audio/pcm',
        data.sampleRate || 24000,
      );
      if (clientVoiceoverCache.size > 80) {
        const first = clientVoiceoverCache.keys().next().value;
        if (first) clientVoiceoverCache.delete(first);
      }
      clientVoiceoverCache.set(cacheKey, buffer);
      return buffer;
    }
  } catch (e) {
    // Graceful silent fallback to soundtrack + sound effects
  }
  return null;
}

/**
 * Synthesizes a warm, rhythmic gastronomic or cinematic background soundtrack
 * directly into an AudioDestination/Gain node for inclusion in the recorded video.
 */
export function renderSoundtrackToDestination(
  ctx: AudioContext,
  destinationNode: AudioNode,
  totalDurationSec: number,
  style: 'lofi_kitchen' | 'bossa_gourmet' | 'acoustic_cooking' | 'cyberpunk_synth' | 'cinematic_drone' = 'lofi_kitchen',
  volume: number = 0.28,
) {
  const now = ctx.currentTime;
  const masterMusicGain = ctx.createGain();
  masterMusicGain.gain.setValueAtTime(0, now);
  // Smooth fade in
  masterMusicGain.gain.linearRampToValueAtTime(volume, now + 1.2);
  // Smooth fade out at end
  const fadeOutStart = Math.max(now + 1.5, now + totalDurationSec - 1.5);
  masterMusicGain.gain.setValueAtTime(volume, fadeOutStart);
  masterMusicGain.gain.linearRampToValueAtTime(0.001, now + totalDurationSec);
  masterMusicGain.connect(destinationNode);

  if (style === 'lofi_kitchen' || style === 'bossa_gourmet' || style === 'acoustic_cooking') {
    // Warm Gastronomic Lofi Progression: Fmaj7 -> Em7 -> Dm7 -> Cmaj7
    const chords = [
      [174.61, 220.0, 261.63, 329.63], // Fmaj7 (F3, A3, C4, E4)
      [164.81, 196.0, 246.94, 293.66], // Em7 (E3, G3, B3, D4)
      [146.83, 174.61, 220.0, 261.63], // Dm7 (D3, F3, A3, C4)
      [130.81, 164.81, 196.0, 246.94], // Cmaj7 (C3, E3, G3, B3)
    ];
    const bassNotes = [87.31, 82.41, 73.42, 65.41]; // F2, E2, D2, C2
    const chordDuration = 3.2; // ~75 BPM lofi culinary tempo

    const loopCount = Math.ceil(totalDurationSec / (chords.length * chordDuration)) + 1;

    for (let loop = 0; loop < loopCount; loop++) {
      chords.forEach((chord, cIdx) => {
        const chordStartTime = now + (loop * chords.length + cIdx) * chordDuration;
        if (chordStartTime >= now + totalDurationSec) return;

        // Play warm Rhodes-like chord tones
        chord.forEach((freq) => {
          const osc = ctx.createOscillator();
          const noteGain = ctx.createGain();
          const filter = ctx.createBiquadFilter();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, chordStartTime);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(650, chordStartTime);

          noteGain.gain.setValueAtTime(0, chordStartTime);
          noteGain.gain.linearRampToValueAtTime(0.06, chordStartTime + 0.12);
          noteGain.gain.exponentialRampToValueAtTime(0.001, chordStartTime + chordDuration * 0.95);

          osc.connect(filter);
          filter.connect(noteGain);
          noteGain.connect(masterMusicGain);

          osc.start(chordStartTime);
          osc.stop(chordStartTime + chordDuration);
        });

        // Warm electric sub-bass note
        const bassFreq = bassNotes[cIdx];
        const bassOsc = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bassOsc.type = 'sine';
        bassOsc.frequency.setValueAtTime(bassFreq, chordStartTime);

        bassGain.gain.setValueAtTime(0, chordStartTime);
        bassGain.gain.linearRampToValueAtTime(0.14, chordStartTime + 0.08);
        bassGain.gain.exponentialRampToValueAtTime(0.001, chordStartTime + chordDuration * 0.9);

        bassOsc.connect(bassGain);
        bassGain.connect(masterMusicGain);
        bassOsc.start(chordStartTime);
        bassOsc.stop(chordStartTime + chordDuration);

        // Soft culinary shaker / vinyl texture pulse (every half beat)
        for (let b = 0; b < 4; b++) {
          const beatTime = chordStartTime + b * (chordDuration / 4);
          if (beatTime >= now + totalDurationSec) break;

          try {
            const bufSize = Math.floor(ctx.sampleRate * 0.06);
            const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) {
              data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.25));
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buf;
            const noiseFilter = ctx.createBiquadFilter();
            noiseFilter.type = 'bandpass';
            noiseFilter.frequency.setValueAtTime(5500, beatTime);
            noiseFilter.Q.setValueAtTime(3.0, beatTime);

            const shakerGain = ctx.createGain();
            shakerGain.gain.setValueAtTime(0.025, beatTime);
            shakerGain.gain.exponentialRampToValueAtTime(0.001, beatTime + 0.06);

            noise.connect(noiseFilter);
            noiseFilter.connect(shakerGain);
            shakerGain.connect(masterMusicGain);
            noise.start(beatTime);
          } catch (_) {}
        }
      });
    }
  } else if (style === 'cinematic_drone') {
    const freqs = [65.41, 98.0, 130.81, 196.0];
    freqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 1.5);
      gain.gain.setValueAtTime(0.08, fadeOutStart);
      gain.gain.linearRampToValueAtTime(0.001, now + totalDurationSec);

      osc.connect(gain);
      gain.connect(masterMusicGain);
      osc.start(now);
      osc.stop(now + totalDurationSec);
    });
  } else {
    // Cyberpunk synth drone
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(55, now);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 1.5);
    gain.gain.setValueAtTime(0.12, fadeOutStart);
    gain.gain.linearRampToValueAtTime(0.001, now + totalDurationSec);

    osc1.connect(filter);
    filter.connect(gain);
    gain.connect(masterMusicGain);
    osc1.start(now);
    osc1.stop(now + totalDurationSec);
  }
}

/**
 * Schedules synchronized culinary sound effects (SFX) directly into an AudioDestination
 * at specific shot timestamps during stitching or playback.
 */
export function renderSfxToDestination(
  ctx: AudioContext,
  destinationNode: AudioNode,
  type: CulinarySfx | string,
  startTime: number,
  shotDuration: number = 5,
) {
  if (!type || type === 'none') return;
  const sfxGain = ctx.createGain();
  sfxGain.gain.setValueAtTime(0.4, startTime);
  sfxGain.connect(destinationNode);

  if (type === 'chop') {
    // Rhythmic series of wooden knife chops on board: e.g. at 0.4s, 0.8s, 1.2s, 1.6s, 2.1s
    const chopOffsets = [0.4, 0.8, 1.2, 1.6, 2.1, 2.7];
    chopOffsets.forEach((off, i) => {
      const t = startTime + off;
      if (t >= startTime + shotDuration) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const pitch = 150 + (i % 3) * 15;
      osc.frequency.setValueAtTime(pitch, t);
      osc.frequency.exponentialRampToValueAtTime(35, t + 0.09);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.005, t + 0.09);

      osc.connect(gain);
      gain.connect(sfxGain);
      osc.start(t);
      osc.stop(t + 0.09);
    });
  } else if (type === 'sizzle') {
    // Sizzling hot pan sound throughout the shot
    const sizzleDuration = Math.max(1.0, shotDuration - 0.4);
    try {
      const bufferSize = Math.floor(ctx.sampleRate * sizzleDuration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        // High density frying noise with crackles
        const crackle = Math.random() > 0.96 ? 1.8 : 0.8;
        data[i] = (Math.random() * 2 - 1) * crackle;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1400, startTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.24, startTime + 0.3);
      gain.gain.setValueAtTime(0.24, startTime + sizzleDuration - 0.3);
      gain.gain.linearRampToValueAtTime(0.001, startTime + sizzleDuration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(sfxGain);
      noise.start(startTime + 0.1);
      noise.stop(startTime + sizzleDuration + 0.1);
    } catch (_) {}
  } else if (type === 'timer_ding') {
    // Bell chime ding from oven / air fryer
    const dingTime = startTime + Math.min(1.2, shotDuration * 0.3);
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1318.51, dingTime); // E6
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(2637.02, dingTime); // E7

    gain.gain.setValueAtTime(0.35, dingTime);
    gain.gain.exponentialRampToValueAtTime(0.001, dingTime + 1.8);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(sfxGain);

    osc1.start(dingTime);
    osc1.stop(dingTime + 1.8);
    osc2.start(dingTime);
    osc2.stop(dingTime + 1.8);
  } else if (type === 'stir' || type === 'pour') {
    // Liquid swirling & pouring
    const offsets = [0.4, 1.1, 1.8];
    offsets.forEach((off) => {
      const t = startTime + off;
      if (t >= startTime + shotDuration) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(260, t);
      osc.frequency.linearRampToValueAtTime(360, t + 0.2);
      osc.frequency.linearRampToValueAtTime(220, t + 0.45);

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.linearRampToValueAtTime(0.005, t + 0.45);

      osc.connect(gain);
      gain.connect(sfxGain);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }
}

/**
 * Main Cinematic & Culinary Audio Engine Singleton
 */
class CinematicAudioEngine {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private nodes: (OscillatorNode | GainNode | BiquadFilterNode)[] = [];
  private masterGain: GainNode | null = null;

  public initContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public getAudioContext(): AudioContext {
    return this.initContext();
  }

  public start(
    type: 'lofi_kitchen' | 'bossa_gourmet' | 'acoustic_cooking' | 'cyberpunk_synth' | 'cinematic_drone' | 'deep_space' = 'lofi_kitchen',
    volume = 0.35,
  ) {
    if (this.isPlaying) {
      this.stop();
    }

    try {
      this.initContext();
      if (!this.ctx) return;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + 0.8);
      this.masterGain.connect(this.ctx.destination);

      if (type === 'lofi_kitchen' || type === 'bossa_gourmet' || type === 'acoustic_cooking') {
        renderSoundtrackToDestination(this.ctx, this.masterGain, 600, type as any, 0.4);
      } else if (type === 'cinematic_drone') {
        renderSoundtrackToDestination(this.ctx, this.masterGain, 600, 'cinematic_drone', 0.4);
      } else {
        renderSoundtrackToDestination(this.ctx, this.masterGain, 600, 'cyberpunk_synth', 0.4);
      }

      this.isPlaying = true;
    } catch (e) {
      console.warn('Audio start prevented or error:', e);
    }
  }

  public setVolume(val: number) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.linearRampToValueAtTime(
        Math.max(0, Math.min(1, val)),
        this.ctx.currentTime + 0.1,
      );
    }
  }

  public stop() {
    if (!this.isPlaying) return;
    try {
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);
      }
      setTimeout(() => {
        this.nodes.forEach((node) => {
          try {
            if ('stop' in node) {
              (node as OscillatorNode).stop();
            }
            node.disconnect();
          } catch (_) {}
        });
        this.nodes = [];
        this.isPlaying = false;
      }, 350);
    } catch (e) {
      console.warn('Error stopping audio:', e);
      this.isPlaying = false;
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Preview a culinary sound effect
   */
  public playSfx(type: CulinarySfx | string) {
    if (!type || type === 'none') return;
    try {
      this.initContext();
      if (!this.ctx) return;
      renderSfxToDestination(this.ctx, this.ctx.destination, type, this.ctx.currentTime, 3);
    } catch (e) {
      console.warn('SFX preview error:', e);
    }
  }

  /**
   * Text-to-Speech (TTS) Narrator with ElevenLabs / Gemini TTS high-fidelity playback
   * and fallback to local browser SpeechSynthesis
   */
  public async speak(text: string, onEnd?: () => void) {
    if (!text || !text.trim()) {
      onEnd?.();
      return;
    }

    if (typeof window === 'undefined') {
      onEnd?.();
      return;
    }

    try {
      this.initContext();
      if (this.ctx) {
        // 1. Attempt High-Fidelity ElevenLabs or Gemini buffer first
        const buffer = await fetchVoiceoverAudioBuffer(this.ctx, text);
        if (buffer) {
          const source = this.ctx.createBufferSource();
          source.buffer = buffer;
          const voiceGain = this.ctx.createGain();
          voiceGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
          source.connect(voiceGain);
          voiceGain.connect(this.ctx.destination);

          source.onended = () => {
            onEnd?.();
          };
          source.start();
          return;
        }
      }
    } catch (e) {
      console.warn('High fidelity speech playback error, falling back to browser synthesis:', e);
    }

    // 2. Fallback to SpeechSynthesis for instant local browser voice
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'pt-BR';
        utterance.rate = 1.05;
        utterance.pitch = 1.0;

        const voices = window.speechSynthesis.getVoices();
        const ptVoice = voices.find(
          (v) =>
            v.lang.startsWith('pt') ||
            v.lang.includes('BR') ||
            v.name.toLowerCase().includes('brazil') ||
            v.name.toLowerCase().includes('portuguese'),
        );
        if (ptVoice) {
          utterance.voice = ptVoice;
        }

        utterance.onend = () => onEnd?.();
        utterance.onerror = () => onEnd?.();
        window.speechSynthesis.speak(utterance);
        return;
      } catch (err) {
        console.warn('Speech synthesis browser error:', err);
      }
    }

    onEnd?.();
  }

  public stopSpeech() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * Full preview of a recipe step's audio (SFX + Voiceover)
   */
  public previewStep(sfx: CulinarySfx, voiceoverText?: string) {
    this.playSfx(sfx);
    if (voiceoverText) {
      setTimeout(() => {
        this.speak(voiceoverText);
      }, 350);
    }
  }
}

export const audioEngine = new CinematicAudioEngine();
