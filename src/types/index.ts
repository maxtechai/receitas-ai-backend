export type ShotType =
  | 'establishing_wide'
  | 'wide_shot'
  | 'medium_shot'
  | 'close_up'
  | 'extreme_close_up'
  | 'drone_aerial'
  | 'pov'
  | 'over_the_shoulder';

export type CameraMotion =
  | 'pan_left'
  | 'pan_right'
  | 'zoom_in'
  | 'zoom_out'
  | 'tilt_up'
  | 'tilt_down'
  | 'cinematic_tracking'
  | 'orbit_360'
  | 'static_tripod';

export type TransitionType = 'cut' | 'crossfade' | 'fade_black' | 'keyframe_blend';

export interface SceneShot {
  id: string;
  order: number;
  title: string;
  shotType: ShotType;
  cameraMotion: CameraMotion;
  narrativeDescription: string;
  imagePrompt: string;
  videoPrompt: string;
  aspectRatio: '16:9' | '9:16' | '1:1';
  durationSeconds: number; // 3, 5, 10, 18
  numFrames: number; // 81, 121, 241, 441 (8n + 1 rule)
  frameRate: number; // 24
  
  // Image generation state (agnes-image-2.0-flash)
  imageUrl?: string;
  endImageUrl?: string;
  imageStatus: 'idle' | 'generating' | 'completed' | 'failed';
  imageError?: string;

  // Video generation state (agnes-video-v2.0)
  videoId?: string;
  videoTaskId?: string;
  videoUrl?: string;
  keyframeMode?: 'start_only' | 'dual_keyframes';
  videoStatus: 'idle' | 'queued' | 'in_progress' | 'completed' | 'failed';
  videoProgress?: number; // 0 - 100
  videoError?: string;
  videoSeconds?: string;
  videoSize?: string;

  // Transition to next shot
  transitionToNext: TransitionType;
}

export interface FilmProject {
  id: string;
  title: string;
  synopsis: string;
  genre: string;
  aspectRatio: '16:9' | '9:16' | '1:1';
  ambientAudio: 'cyberpunk_synth' | 'cinematic_drone' | 'deep_space' | 'none';
  shots: SceneShot[];
  createdAt: string;
  updatedAt: string;
}

export interface VideoSuggestion {
  id?: string;
  title: string;
  genre: string;
  synopsis: string;
  shotCount?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  keyVisual?: string;
}

export type CulinarySfx = 'sizzle' | 'chop' | 'stir' | 'pour' | 'timer_ding' | 'none';

export type RecipeStepType =
  | 'prep_cutting'      // Preparo / Corte: Tábua de corte na bancada
  | 'preparation'       // Preparo / Mistura no Bowl ou Bancada
  | 'saute_frying'      // Refogado / Fritura: Frigideira no fogão aceso
  | 'boil_simmer'       // Cozimento / Fervura: Panela alta com água fervendo / molho
  | 'blender_process'   // Processamento: Jarra do liquidificador / Processador
  | 'appliance_enter'   // Assados / Micro-ondas / Forno / Air Fryer - Entrada
  | 'appliance_exit'    // Retirada do Forno / Micro-ondas Dourado e Fumegante
  | 'plated_hero'       // Empratamento / Prato Pronto / Hero Shot na bancada
  | 'tasting'           // Garfada / Degustação / Close-up Apetitoso / Cheese Pull
  | 'social_cta';       // Mídia Social / Encerramento com CTA (Seguir, Salvar, Curtir)

export type EquipmentStation =
  | 'cutting_board'     // 🪵 Tábua de corte na bancada
  | 'pan_stove'         // 🔥 Frigideira no fogão aceso
  | 'pot_boiling'       // 🍲 Panela alta com água fervendo
  | 'blender'           // 🌪️ Liquidificador / Processador
  | 'bowl_prep'         // 🥣 Tigela / Bowl de mistura
  | 'oven_appliance'    // ♨️ Forno / Air Fryer / Micro-ondas
  | 'serving_plate'     // 🍽️ Prato de servir / Empratamento
  | 'tasting_fork'      // 🍴 Garfo / Close-up de Degustação
  | 'social_hero';      // 📱 Cenário final com CTA

export interface FixedAnchors {
  handAnchor: string;       // Mãos do cozinheiro (pele, unhas, anéis)
  countertopAnchor: string; // Bancada da cozinha e fundo
  lightingAnchor: string;   // Iluminação e temperatura de cor (5600K suave)
  styleAnchor: string;      // Estilo de filmagem e composição
}

export interface RecipeStep {
  id: string;
  stepNumber: number;
  stepType?: RecipeStepType;
  equipmentStation?: EquipmentStation;
  utensil?: string; // Utensílio específico: Tábua de madeira, Frigideira de inox, Panela alta, Prato fundo de cerâmica, etc.
  continuityRule?: string; // Regra de Ouro da transferência de ingredientes
  continuityNote?: string; // Como este passo se conecta fluidamente ao anterior
  actionTitle: string;
  instruction: string;
  voiceoverText: string;
  sfx: CulinarySfx;
  usesLastFrame: boolean;
  referenceImageUrl?: string;
  imagePrompt: string;
  endImagePrompt?: string; // Prompt do frame final exato para ancoragem dupla (First-Frame + End-Frame)
  videoPrompt: string;
  durationSeconds: number;
  numFrames: number;
  frameRate: number;
  imageUrl?: string;
  endImageUrl?: string; // Imagem do frame final para interpolação confinada na Agnes AI
  lastFrameUrl?: string;
  videoUrl?: string;
  keyframeMode?: 'start_only' | 'dual_keyframes'; // Modo de interpolação da Agnes AI
  status: 'idle' | 'image_generating' | 'video_generating' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}

export interface RecipeProject {
  id: string;
  title: string;
  category: string;
  prepTime: string;
  aspectRatio: '9:16' | '16:9' | '1:1';
  fixedAnchors?: FixedAnchors;
  handStyle: string;
  bowlStyle: string;
  surfaceStyle: string;
  steps: RecipeStep[];
  bgMusic: 'lofi_kitchen' | 'bossa_gourmet' | 'acoustic_cooking' | 'none';
  enableTts: boolean;
  enableCaptions: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: VideoSuggestion[];
  timestamp: string;
}

export interface AgnesConfig {
  apiKey: string;
  videoModel: string;
  imageModel: string;
  chatModel: string;
}
