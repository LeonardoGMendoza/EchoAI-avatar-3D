// ================================================================
//  voice.js — Web Speech API: Reconhecimento + Síntese de Voz
//  Compatível com iPhone (Safari) e Android (Chrome)
// ================================================================

let recognition = null;
let synth = window.speechSynthesis;
let currentLang = 'pt-BR';
let isListening = false;
let onResultCallback = null;
let onStartCallback = null;
let onEndCallback = null;
let availableVoices = [];

// ── Configuração de voz por idioma ──
const VOICE_CONFIG = {
  'pt-BR': { name: 'pt-BR', preferred: ['Luciana', 'Google português do Brasil', 'pt-BR'], pitch: 1.1, rate: 0.95 },
  'en-US': { name: 'en-US', preferred: ['Samantha', 'Google US English', 'en-US'], pitch: 1.0, rate: 1.0 },
  'es-ES': { name: 'es-ES', preferred: ['Mónica', 'Google español', 'es-ES'], pitch: 1.05, rate: 0.98 },
  'ru-RU': { name: 'ru-RU', preferred: ['Milena', 'Google русский', 'ru-RU'], pitch: 1.0, rate: 0.95 },
  'zh-CN': { name: 'zh-CN', preferred: ['Ting-Ting', 'Google 中文', 'zh-CN'], pitch: 1.0, rate: 0.9 },
  'fr-FR': { name: 'fr-FR', preferred: ['Amélie', 'Google français', 'fr-FR'], pitch: 1.05, rate: 0.98 }
};

// ── Inicializa o sistema de voz ──
export function initVoice({ onResult, onStart, onEnd }) {
  onResultCallback = onResult;
  onStartCallback = onStart;
  onEndCallback = onEnd;

  // Carrega vozes disponíveis
  loadVoices();
  if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = loadVoices;
  }

  // Verifica suporte
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('SpeechRecognition não suportado neste browser');
    return false;
  }
  return true;
}

function loadVoices() {
  availableVoices = synth.getVoices();
}

// ── Define idioma atual ──
export function setVoiceLang(lang) {
  currentLang = lang;
}

// ── Inicia reconhecimento de voz (microfone) ──
export function startListening() {
  if (isListening) {
    stopListening();
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('Reconhecimento de voz não disponível neste dispositivo. Tente pelo Chrome.');
    return;
  }

  // Para qualquer síntese em andamento
  stopSpeaking();

  recognition = new SpeechRecognition();
  recognition.lang = currentLang;
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isListening = true;
    if (onStartCallback) onStartCallback();
  };

  recognition.onresult = (event) => {
    let interim = '';
    let final = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) final += t;
      else interim += t;
    }
    if (onResultCallback) onResultCallback(final || interim, !!final);
  };

  recognition.onerror = (e) => {
    console.error('Speech recognition error:', e.error);
    isListening = false;
    if (onEndCallback) onEndCallback();

    if (e.error === 'not-allowed') {
      alert('Permissão de microfone negada. Permita o acesso ao microfone nas configurações.');
    }
  };

  recognition.onend = () => {
    isListening = false;
    if (onEndCallback) onEndCallback();
  };

  try {
    recognition.start();
  } catch (e) {
    console.error('Erro ao iniciar reconhecimento:', e);
  }
}

// ── Para reconhecimento de voz ──
export function stopListening() {
  if (recognition) {
    recognition.stop();
    recognition = null;
  }
  isListening = false;
}

export function getIsListening() {
  return isListening;
}

// ── Síntese de voz (TTS) — ela fala ──
export function speak(text, lang, { onStart, onEnd, onBoundary } = {}) {
  if (!synth) return;

  // Para qualquer fala anterior
  synth.cancel();

  // Limpa texto (remove emojis para falar mais natural)
  const cleanText = text
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/[*_~`]/g, '')
    .trim();

  if (!cleanText) {
    if (onEnd) onEnd();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(cleanText);

  // Configuração de idioma e voz
  const config = VOICE_CONFIG[lang] || VOICE_CONFIG['pt-BR'];
  utterance.lang = lang || 'pt-BR';
  utterance.pitch = config.pitch;
  utterance.rate = config.rate;
  utterance.volume = 1.0;

  // Tenta encontrar a melhor voz
  const bestVoice = findBestVoice(lang, config.preferred);
  if (bestVoice) utterance.voice = bestVoice;

  utterance.onstart = () => {
    if (onStart) onStart();
  };

  utterance.onend = () => {
    if (onEnd) onEnd();
  };

  utterance.onboundary = (e) => {
    if (onBoundary) onBoundary(e);
  };

  utterance.onerror = (e) => {
    console.error('Speech synthesis error:', e);
    if (onEnd) onEnd();
  };

  // Fix para iOS Safari (precisa de um pequeno delay)
  setTimeout(() => {
    synth.speak(utterance);
  }, 100);
}

// ── Para síntese de voz ──
export function stopSpeaking() {
  if (synth) synth.cancel();
}

// ── Encontra a melhor voz disponível ──
function findBestVoice(lang, preferredNames) {
  if (!availableVoices.length) {
    availableVoices = synth.getVoices();
  }

  // Tenta nomes preferidos
  for (const name of preferredNames) {
    const v = availableVoices.find(v =>
      v.name.includes(name) || v.lang === name
    );
    if (v) return v;
  }

  // Fallback: qualquer voz do idioma
  const langVoice = availableVoices.find(v => v.lang.startsWith(lang.split('-')[0]));
  if (langVoice) return langVoice;

  // Último fallback: primeira voz disponível
  return availableVoices[0] || null;
}

// ── Lista vozes disponíveis no dispositivo ──
export function getAvailableVoices(lang) {
  const voices = synth.getVoices();
  return voices.filter(v => v.lang.startsWith(lang.split('-')[0]));
}

// ── Testa a voz ──
export function testVoice(lang, charName) {
  const texts = {
    'pt-BR': `Olá! Sou ${charName}. Posso falar com você em português!`,
    'en-US': `Hello! I'm ${charName}. I can speak English with you!`,
    'es-ES': `¡Hola! Soy ${charName}. ¡Puedo hablar español contigo!`,
    'ru-RU': `Привет! Я ${charName}. Я могу говорить с вами по-русски!`,
    'zh-CN': `你好！我是${charName}。我可以用中文和你说话！`,
    'fr-FR': `Bonjour! Je suis ${charName}. Je peux vous parler en français!`
  };
  speak(texts[lang] || texts['pt-BR'], lang);
}
