import { SceneShot, FilmProject, CulinarySfx } from '../types';
import {
  renderSoundtrackToDestination,
  renderSfxToDestination,
  fetchVoiceoverAudioBuffer,
} from './audioSynth';

export interface StitchProgress {
  currentShotIndex: number;
  totalShots: number;
  percent: number;
  statusText: string;
}

export interface StitchAudioOptions {
  enableMusic?: boolean;
  enableSfx?: boolean;
  enableVoiceover?: boolean;
  musicVolume?: number;
  sfxVolume?: number;
}

interface LoadedMediaItem {
  image?: HTMLImageElement;
  video?: HTMLVideoElement;
  hasVideo: boolean;
  audioConnected?: boolean;
  voiceoverBuffer?: AudioBuffer | null;
}

/**
 * Intelligently infers appropriate culinary sound effect from shot metadata or equipment station
 */
function inferCulinarySfx(shot: any): CulinarySfx {
  if (shot.sfx && shot.sfx !== 'none') return shot.sfx;
  const station = shot.equipmentStation || '';
  const text = `${shot.title || ''} ${shot.actionTitle || ''} ${shot.narrativeDescription || ''}`.toLowerCase();

  if (
    station === 'cutting_board' ||
    text.includes('cort') ||
    text.includes('pic') ||
    text.includes('fati') ||
    text.includes('tábua')
  ) {
    return 'chop';
  }
  if (
    station === 'pan_stove' ||
    text.includes('frigideira') ||
    text.includes('azeite') ||
    text.includes('frit') ||
    text.includes('refog') ||
    text.includes('dour') ||
    text.includes('camar') ||
    text.includes('alho')
  ) {
    return 'sizzle';
  }
  if (
    station === 'pot_boiling' ||
    text.includes('ferv') ||
    text.includes('coz') ||
    text.includes('panela') ||
    text.includes('molho') ||
    text.includes('mistur')
  ) {
    return 'stir';
  }
  if (
    station === 'oven_appliance' ||
    text.includes('forno') ||
    text.includes('air fryer') ||
    text.includes('assad') ||
    text.includes('gratin')
  ) {
    return 'timer_ding';
  }
  if (
    station === 'serving_plate' ||
    station === 'social_hero' ||
    station === 'tasting_fork' ||
    text.includes('prato') ||
    text.includes('garf') ||
    text.includes('serv') ||
    text.includes('degust')
  ) {
    return 'sizzle';
  }
  return 'sizzle';
}

/**
 * Helper to draw an image or video to canvas with cover fit (no stretching or black letterbox)
 */
function drawMediaCover(
  ctx: CanvasRenderingContext2D,
  media: HTMLImageElement | HTMLVideoElement,
  targetWidth: number,
  targetHeight: number,
  scaleFactor: number = 1.0,
) {
  const mediaWidth =
    (media as HTMLVideoElement).videoWidth || (media as HTMLImageElement).naturalWidth;
  const mediaHeight =
    (media as HTMLVideoElement).videoHeight || (media as HTMLImageElement).naturalHeight;

  if (!mediaWidth || !mediaHeight) return;

  const targetRatio = targetWidth / targetHeight;
  const mediaRatio = mediaWidth / mediaHeight;

  let sWidth = mediaWidth;
  let sHeight = mediaHeight;
  let sx = 0;
  let sy = 0;

  if (mediaRatio > targetRatio) {
    sWidth = mediaHeight * targetRatio;
    sx = (mediaWidth - sWidth) / 2;
  } else {
    sHeight = mediaWidth / targetRatio;
    sy = (mediaHeight - sHeight) / 2;
  }

  ctx.save();
  if (scaleFactor !== 1.0) {
    ctx.translate(targetWidth / 2, targetHeight / 2);
    ctx.scale(scaleFactor, scaleFactor);
    ctx.drawImage(
      media,
      sx,
      sy,
      sWidth,
      sHeight,
      -targetWidth / 2,
      -targetHeight / 2,
      targetWidth,
      targetHeight,
    );
  } else {
    ctx.drawImage(media, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
  }
  ctx.restore();
}

/**
 * Stitches images and real video clips into a continuous recorded video file
 * WITH COMPLETE MULTI-TRACK AUDIO (Background music + Culinary SFX + Voiceover Narration)
 * using Canvas + Web Audio API + MediaRecorder.
 */
export async function stitchLongVideo(
  project: FilmProject,
  onProgress?: (progress: StitchProgress) => void,
  audioOptions: StitchAudioOptions = {},
): Promise<Blob> {
  const {
    enableMusic = true,
    enableSfx = true,
    enableVoiceover = true,
    musicVolume = 0.28,
    sfxVolume = 0.45,
  } = audioOptions;

  const validShots = project.shots.filter((s) => s.imageUrl || s.videoUrl);
  if (validShots.length === 0) {
    throw new Error('Nenhuma cena possui imagem ou clipe gerado para compor o vídeo longo.');
  }

  // Determine canvas resolution based on aspect ratio
  let width = 1280;
  let height = 720;
  const ratio = project.aspectRatio as string;
  if (ratio === '9:16') {
    width = 720;
    height = 1280;
  } else if (ratio === '1:1') {
    width = 720;
    height = 720;
  } else if (ratio === '4:3') {
    width = 960;
    height = 720;
  } else if (ratio === '3:4') {
    width = 720;
    height = 960;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  if (!ctx) {
    throw new Error('Canvas 2D context não suportado');
  }

  // ==========================================
  // INITIALIZE WEB AUDIO SYSTEM FOR VIDEO STREAM
  // ==========================================
  const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioCtxClass();
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume().catch(() => {});
  }

  const audioDest = audioCtx.createMediaStreamDestination();
  const masterAudioGain = audioCtx.createGain();
  masterAudioGain.gain.setValueAtTime(1.0, audioCtx.currentTime);
  masterAudioGain.connect(audioDest);

  // Pre-load all shot images, video elements, AND voiceover audio buffers
  const loadedMediaList: LoadedMediaItem[] = [];
  const totalShots = validShots.length;
  const totalDurationSec = validShots.reduce((acc, s) => acc + (s.durationSeconds || 5), 0);

  for (let i = 0; i < totalShots; i++) {
    onProgress?.({
      currentShotIndex: i,
      totalShots,
      percent: Math.round(((i + 1) / totalShots) * 18),
      statusText: `Preparando mídias e áudio da Tomada ${i + 1} de ${totalShots}...`,
    });

    const shot = validShots[i];
    const mediaItem: LoadedMediaItem = { hasVideo: false };

    // 1. Preload image as primary or fallback
    if (shot.imageUrl) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const proxyUrl = shot.imageUrl.startsWith('http')
          ? `/api/proxy-media?url=${encodeURIComponent(shot.imageUrl)}`
          : shot.imageUrl;

        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = proxyUrl;
        });

        if (img.naturalWidth > 0) {
          mediaItem.image = img;
        }
      } catch (e) {
        console.warn(`Erro ao carregar imagem do passo ${i + 1}:`, e);
      }
    }

    // 2. Preload video if available
    if (shot.videoUrl) {
      try {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.muted = true; // start muted during buffer preload
        video.playsInline = true;
        video.preload = 'auto';

        const videoSrc = shot.videoUrl.startsWith('http')
          ? `/api/proxy-media?url=${encodeURIComponent(shot.videoUrl)}`
          : shot.videoUrl;

        const isLoaded = await new Promise<boolean>((resolve) => {
          let done = false;
          const onReady = () => {
            if (!done) {
              done = true;
              cleanup();
              resolve(true);
            }
          };
          const onError = () => {
            if (!done) {
              done = true;
              cleanup();
              resolve(false);
            }
          };
          const cleanup = () => {
            video.removeEventListener('loadeddata', onReady);
            video.removeEventListener('canplay', onReady);
            video.removeEventListener('error', onError);
          };

          video.addEventListener('loadeddata', onReady);
          video.addEventListener('canplay', onReady);
          video.addEventListener('error', onError);

          setTimeout(() => {
            if (!done) {
              done = true;
              cleanup();
              resolve(video.videoWidth > 0 || video.readyState >= 2);
            }
          }, 10000);

          video.src = videoSrc;
          video.load();
        });

        if (isLoaded && (video.videoWidth > 0 || video.readyState >= 1)) {
          mediaItem.video = video;
          mediaItem.hasVideo = true;
        }
      } catch (e) {
        console.warn(`Erro ao preparar vídeo do passo ${i + 1}:`, e);
      }
    }

    // 3. Pre-fetch voiceover TTS audio buffer if present
    const voiceoverText = (shot as any).voiceoverText;
    if (enableVoiceover && voiceoverText && voiceoverText.trim()) {
      try {
        const vBuf = await fetchVoiceoverAudioBuffer(audioCtx, voiceoverText);
        if (vBuf) {
          mediaItem.voiceoverBuffer = vBuf;
        }
      } catch {
        // Continue cleanly without blocking video export
      }
    }

    loadedMediaList.push(mediaItem);
  }

  // ==========================================
  // START CONTINUOUS GASTRONOMIC/CINEMATIC SOUNDTRACK
  // ==========================================
  if (enableMusic) {
    const isRecipe =
      (project as any).steps !== undefined ||
      validShots.some((s) => (s as any).stepNumber !== undefined) ||
      (project.title && project.title.toLowerCase().includes('macarrão')) ||
      (project.title && project.title.toLowerCase().includes('receita'));

    const soundtrackStyle = isRecipe ? 'lofi_kitchen' : (project.ambientAudio as any) || 'cinematic_drone';
    renderSoundtrackToDestination(
      audioCtx,
      masterAudioGain,
      totalDurationSec + 3,
      soundtrackStyle,
      musicVolume,
    );
  }

  // ==========================================
  // SETUP COMBINED MEDIA STREAM (VIDEO + AUDIO)
  // ==========================================
  const fps = 30;
  const canvasStream = canvas.captureStream(fps);

  // Combine video track from canvas with audio track from Web Audio destination!
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioDest.stream.getAudioTracks(),
  ]);

  let mimeType = 'video/webm;codecs=vp9,opus';
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm;codecs=vp8,opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/mp4;codecs=avc1,mp4a.40.2';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/mp4';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = '';
          }
        }
      }
    }
  }

  const mediaRecorder = new MediaRecorder(
    combinedStream,
    mimeType
      ? {
          mimeType,
          videoBitsPerSecond: 6000000,
          audioBitsPerSecond: 192000,
        }
      : undefined,
  );
  const recordedChunks: Blob[] = [];

  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

  const recordingPromise = new Promise<Blob>((resolve, reject) => {
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: mimeType || 'video/webm' });
      resolve(blob);
    };
    mediaRecorder.onerror = (e) => reject(e);
  });

  mediaRecorder.start();

  // Render frames sequentially
  let overallFrameCount = 0;

  try {
    for (let shotIdx = 0; shotIdx < totalShots; shotIdx++) {
      const shot = validShots[shotIdx];
      const media = loadedMediaList[shotIdx];
      const nextMedia = shotIdx < totalShots - 1 ? loadedMediaList[shotIdx + 1] : null;

      const shotDurationSec = shot.durationSeconds || 5;
      const totalShotFrames = Math.round(shotDurationSec * fps);
      const transitionFrames =
        shot.transitionToNext === 'crossfade' || shot.transitionToNext === 'keyframe_blend'
          ? Math.round(fps * 0.8)
          : 0;
      const mainFrames = totalShotFrames - transitionFrames;

      // ==========================================
      // SYNCHRONIZED AUDIO TRIGGER FOR CURRENT SHOT
      // ==========================================
      const shotAudioStartTime = audioCtx.currentTime;

      // 1. Play Synchronized Culinary SFX (Chop, Sizzle, Stir, Bell Ding)
      if (enableSfx) {
        const sfxType = inferCulinarySfx(shot);
        renderSfxToDestination(
          audioCtx,
          masterAudioGain,
          sfxType,
          shotAudioStartTime,
          shotDurationSec,
        );
      }

      // 2. Play Voiceover Narration if buffer was preloaded
      if (enableVoiceover && media.voiceoverBuffer) {
        try {
          const vSource = audioCtx.createBufferSource();
          vSource.buffer = media.voiceoverBuffer;
          const vGain = audioCtx.createGain();
          vGain.gain.setValueAtTime(0.9, shotAudioStartTime);
          vSource.connect(vGain);
          vGain.connect(masterAudioGain);
          vSource.start(shotAudioStartTime + 0.35);
        } catch (e) {
          console.warn('Erro ao disparar áudio de voz:', e);
        }
      }

      // 3. Connect Video element audio if available
      if (media.hasVideo && media.video) {
        try {
          media.video.currentTime = 0;
          await media.video.play();
          await new Promise((r) => setTimeout(r, 60));
        } catch (e) {
          console.warn('Erro ao dar play no vídeo durante renderização:', e);
        }
      }

      for (let f = 0; f < totalShotFrames; f++) {
        overallFrameCount++;

        // Progress reporting
        const progressPercent =
          20 + Math.round(((shotIdx * totalShotFrames + f) / (totalShots * totalShotFrames)) * 75);
        onProgress?.({
          currentShotIndex: shotIdx + 1,
          totalShots,
          percent: Math.min(98, progressPercent),
          statusText: `Renderizando tomada ${shotIdx + 1} de ${totalShots} (${media.hasVideo ? 'Vídeo Ativo' : 'Foto Dinâmica'} + Áudio Sincronizado)...`,
        });

        // Clear canvas
        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, width, height);

        let drawn = false;

        // Draw active video if ready
        if (media.hasVideo && media.video && media.video.videoWidth > 0) {
          if (media.video.ended) {
            media.video.currentTime = 0;
            media.video.play().catch(() => {});
          } else if (media.video.paused) {
            media.video.play().catch(() => {});
          }

          try {
            drawMediaCover(ctx, media.video, width, height, 1.0);
            drawn = true;
          } catch (e) {
            console.warn('Fallback para imagem devido a erro de desenho de vídeo:', e);
          }
        }

        // Fallback to image if video not drawn
        if (!drawn && media.image && media.image.naturalWidth > 0) {
          const progress = f / totalShotFrames;
          const zoomFactor = 1.0 + progress * 0.08;
          drawMediaCover(ctx, media.image, width, height, zoomFactor);
        }

        // Crossfade transition to next shot
        if (f >= mainFrames && transitionFrames > 0 && nextMedia) {
          if (f === mainFrames && nextMedia.hasVideo && nextMedia.video) {
            try {
              nextMedia.video.currentTime = 0;
              nextMedia.video.play().catch(() => {});
            } catch (e) {}
          }

          const transProgress = (f - mainFrames) / transitionFrames;
          ctx.save();
          ctx.globalAlpha = Math.min(1, Math.max(0, transProgress));
          if (nextMedia.hasVideo && nextMedia.video && nextMedia.video.videoWidth > 0) {
            drawMediaCover(ctx, nextMedia.video, width, height, 1.0);
          } else if (nextMedia.image && nextMedia.image.naturalWidth > 0) {
            drawMediaCover(ctx, nextMedia.image, width, height, 1.0);
          }
          ctx.restore();
        }

        // Modern Social Media / Recipe Overlay Banner
        const gradHeight = Math.min(150, height * 0.18);
        const grad = ctx.createLinearGradient(0, height - gradHeight, 0, height);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        grad.addColorStop(0.35, 'rgba(0, 0, 0, 0.55)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, height - gradHeight, width, gradHeight);

        // Badge: e.g. "PASSO 1 DE 3"
        const isRecipe = (shot as any).stepNumber !== undefined;
        const badgeText = isRecipe
          ? `PASSO ${(shot as any).stepNumber || shotIdx + 1} DE ${totalShots}`
          : `TOMADA ${shotIdx + 1} DE ${totalShots}`;

        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(badgeText, 24, height - 52);

        // Title text
        const displayTitle = (
          shot.title ||
          (shot as any).actionTitle ||
          `Tomada ${shotIdx + 1}`
        ).trim();
        ctx.fillStyle = '#ffffff';
        ctx.font = '600 15px "Plus Jakarta Sans", sans-serif';
        const maxTitleWidth = width - 48;
        let safeTitle = displayTitle;
        while (ctx.measureText(safeTitle).width > maxTitleWidth && safeTitle.length > 5) {
          safeTitle = safeTitle.slice(0, -4) + '...';
        }
        ctx.fillText(safeTitle, 24, height - 30);

        // Subtitle or Voiceover preview
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px "JetBrains Mono", monospace';
        const timeStr = `${String(Math.floor(overallFrameCount / (fps * 60))).padStart(2, '0')}:${String(Math.floor((overallFrameCount / fps) % 60)).padStart(2, '0')}.${String(Math.floor((overallFrameCount % fps) * (100 / fps))).padStart(2, '0')}`;
        const rawSub =
          (shot as any).voiceoverText ||
          `TC ${timeStr} · ${(shot.shotType || 'shot').replace(/_/g, ' ').toUpperCase()}`;
        let safeSub = rawSub.trim();
        if (safeSub.length > 60) safeSub = safeSub.slice(0, 58) + '...';
        ctx.fillText(safeSub, 24, height - 12);

        // Wait for next frame
        await new Promise((r) => setTimeout(r, 1000 / fps));
      }

      // Pause current video after shot finishes
      if (media.video) {
        try {
          media.video.pause();
        } catch (e) {}
      }
    }
  } finally {
    // Cleanup video elements
    for (const m of loadedMediaList) {
      if (m.video) {
        try {
          m.video.pause();
          m.video.src = '';
          m.video.load();
        } catch (e) {}
      }
    }
  }

  onProgress?.({
    currentShotIndex: totalShots,
    totalShots,
    percent: 100,
    statusText: 'Finalizando multiplexação de vídeo e áudio contínuo...',
  });

  mediaRecorder.stop();
  const finalBlob = await recordingPromise;

  // Clean up audio context
  try {
    audioCtx.close().catch(() => {});
  } catch (_) {}

  return finalBlob;
}

/**
 * Exports project as an EDL (Edit Decision List) text file for Adobe Premiere / DaVinci Resolve
 */
export function generateEDL(project: FilmProject): string {
  let edl = `TITLE: ${(project.title || 'FILM').toUpperCase()}\n`;
  edl += `FCM: NON-DROP FRAME\n\n`;

  let currentFrame = 0;
  const fps = 24;

  project.shots.forEach((shot, idx) => {
    const durationFrames = (shot.durationSeconds || 5) * fps;
    const startFrame = currentFrame;
    const endFrame = currentFrame + durationFrames;

    const toTC = (f: number) => {
      const h = String(Math.floor(f / (fps * 3600))).padStart(2, '0');
      const m = String(Math.floor((f / (fps * 60)) % 60)).padStart(2, '0');
      const s = String(Math.floor((f / fps) % 60)).padStart(2, '0');
      const ff = String(Math.floor(f % fps)).padStart(2, '0');
      return `${h}:${m}:${s}:${ff}`;
    };

    const num = String(idx + 1).padStart(3, '0');
    edl += `${num}  AX       V     C        00:00:00:00 ${toTC(durationFrames)} ${toTC(startFrame)} ${toTC(endFrame)}\n`;
    edl += `* FROM CLIP NAME: ${shot.title || `Shot ${idx + 1}`}\n`;
    edl += `* SHOT TYPE: ${shot.shotType || 'medium_shot'} | MOTION: ${shot.cameraMotion || 'static_tripod'}\n`;
    edl += `* IMAGE PROMPT: ${(shot.imagePrompt || '').replace(/\n/g, ' ')}\n`;
    edl += `* VIDEO PROMPT: ${(shot.videoPrompt || '').replace(/\n/g, ' ')}\n\n`;

    currentFrame = endFrame;
  });

  return edl;
}
