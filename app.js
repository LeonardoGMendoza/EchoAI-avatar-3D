// ================================================================
//  app.js — EchoAI Avatar 3D — Lógica Principal
//  Firebase + Gemini + Voice + Avatar 3D + 6 Idiomas
// ================================================================

import { db, auth, googleProvider } from './firebase-config.js';
import { initAvatar, setAvatarState, setAvatarColor, startLipSync, stopLipSync, initLoginBackground } from './avatar3d.js';
import { initVoice, startListening, stopListening, getIsListening, speak, stopSpeaking, setVoiceLang } from './voice.js';
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc, collection, addDoc, getDocs, orderBy, query, limit } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ──────────────────────────────────────────────────────────
//  ⚠️  COLE SUA CHAVE GEMINI AQUI
//  Acesse: https://aistudio.google.com/app/apikey
// ──────────────────────────────────────────────────────────
const GEMINI_KEY = "COLE_SUA_CHAVE_GEMINI_AQUI";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;

// ── Estado global ──
let currentUser = null;
let currentLang = 'pt-BR';
let currentChar = { id:'luna', name:'Luna', color:'#c46ef5', personality:'carinhosa, criativa e curiosa. Ama arte, poesia e histórias emocionantes' };
let userProfile = { nome:'', memorias:[], personalidade:'', ultimo_tema:'' };
let chatHistory = [];
let isSpeaking = false;
let hasMessages = false;

// ── Mapa de idiomas ──
const LANGS = {
  'pt-BR': { flag:'🇧🇷', label:'PT', gemini:'Português (Brasil)', placeholder:'Escreva ou fale com ela...' },
  'en-US': { flag:'🇺🇸', label:'EN', gemini:'English',           placeholder:'Write or speak to her...' },
  'es-ES': { flag:'🇪🇸', label:'ES', gemini:'Español',           placeholder:'Escríbele o habla con ella...' },
  'ru-RU': { flag:'🇷🇺', label:'RU', gemini:'Русский',           placeholder:'Напишите или скажите ей...' },
  'zh-CN': { flag:'🇨🇳', label:'ZH', gemini:'中文 (简体)',         placeholder:'写信或对她说...' },
  'fr-FR': { flag:'🇫🇷', label:'FR', gemini:'Français',          placeholder:'Écrivez-lui ou parlez-lui...' }
};

const GREETINGS = {
  'pt-BR': n => `Olá! Sou ${n}. 💜\nMe conta algo sobre você!`,
  'en-US': n => `Hi! I'm ${n}. 💜\nTell me about yourself!`,
  'es-ES': n => `¡Hola! Soy ${n}. 💜\n¡Cuéntame sobre ti!`,
  'ru-RU': n => `Привет! Я ${n}. 💜\nРасскажи о себе!`,
  'zh-CN': n => `你好！我是${n}。💜\n告诉我关于你自己！`,
  'fr-FR': n => `Bonjour! Je suis ${n}. 💜\nParle-moi de toi!`
};

// ── $ helper ──
const $ = id => document.getElementById(id);

// ────────────────────────────────────────
//  INICIALIZAÇÃO
// ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initLoginBackground('bg-canvas');
  setupLoginScreen();
  setupCharacterScreen();
  setupChatScreen();

  onAuthStateChanged(auth, async user => {
    if (user) {
      currentUser = user;
      await loadUserProfile();
      const savedChar = localStorage.getItem(`echoai_char_${user.uid}`);
      if (savedChar) {
        currentChar = JSON.parse(savedChar);
        goToChat();
      } else {
        showScreen('character');
      }
    } else {
      currentUser = null;
      showScreen('login');
    }
  });
});

// ────────────────────────────────────────
//  NAVEGAÇÃO ENTRE TELAS
// ────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(`screen-${name}`).classList.add('active');
}

// ────────────────────────────────────────
//  TELA DE LOGIN
// ────────────────────────────────────────
function setupLoginScreen() {
  $('btn-login').addEventListener('click', async () => {
    try {
      $('btn-login').textContent = 'Entrando...';
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      $('btn-login').innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24">...</svg> Entrar com Google`;
      showToast('Erro ao entrar. Tente novamente.');
    }
  });
}

// ────────────────────────────────────────
//  TELA DE PERSONAGEM
// ────────────────────────────────────────
function setupCharacterScreen() {
  let selected = null;

  document.querySelectorAll('.char-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selected = {
        id:          card.dataset.id,
        name:        card.dataset.name,
        color:       card.dataset.color,
        personality: card.dataset.personality
      };
      const nameInput = $('custom-name');
      if (!nameInput.value || nameInput.dataset.auto === 'true') {
        nameInput.value = card.dataset.name;
        nameInput.dataset.auto = 'true';
      }
    });
  });

  $('custom-name').addEventListener('input', e => { e.target.dataset.auto = 'false'; });

  // Seleciona o primeiro por padrão
  document.querySelector('.char-card')?.click();

  $('btn-start').addEventListener('click', () => {
    if (!selected) { showToast('Selecione um personagem!'); return; }
    const customName = $('custom-name').value.trim();
    if (customName) selected.name = customName;
    currentChar = selected;
    if (currentUser) {
      localStorage.setItem(`echoai_char_${currentUser.uid}`, JSON.stringify(currentChar));
    }
    goToChat();
  });
}

// ────────────────────────────────────────
//  IR PARA O CHAT
// ────────────────────────────────────────
async function goToChat() {
  showScreen('chat');

  // Aplica cor do personagem no header
  $('hdr-name').textContent = currentChar.name;
  $('chat-header').style.setProperty('--char-color', currentChar.color);

  // Inicializa avatar 3D
  initAvatar('avatar-canvas', currentChar.color);
  setAvatarState('idle');

  // Inicializa voz
  initVoice({
    onResult: (text, isFinal) => {
      $('msg-input').value = text;
      if (isFinal && text.trim()) {
        setTimeout(() => sendMessage(), 300);
      }
    },
    onStart: () => {
      setAvatarState('listening');
      $('btn-mic').classList.add('listening');
      $('hdr-status').textContent = '● Ouvindo...';
    },
    onEnd: () => {
      setAvatarState('idle');
      $('btn-mic').classList.remove('listening');
      $('hdr-status').textContent = '● Online';
    }
  });

  // Carrega histórico
  await loadChatHistory();

  // Mensagem de boas-vindas se não tiver histórico
  if (!hasMessages) {
    const greeting = (GREETINGS[currentLang] || GREETINGS['pt-BR'])(currentChar.name);
    addMessage('ai', greeting);
    // Fala a saudação
    speak(greeting, currentLang, {
      onStart: () => { setAvatarState('speaking'); startLipSync(); },
      onEnd: () => { setAvatarState('idle'); stopLipSync(); }
    });
  }

  setLanguage(currentLang, false);
}

// ────────────────────────────────────────
//  TELA DE CHAT — Setup
// ────────────────────────────────────────
function setupChatScreen() {
  // Voltar
  $('btn-back').addEventListener('click', () => showScreen('character'));

  // Logout
  $('btn-logout').addEventListener('click', async () => {
    if (confirm('Sair?')) {
      stopSpeaking();
      await signOut(auth);
    }
  });

  // Idioma dropdown
  $('btn-lang').addEventListener('click', e => {
    e.stopPropagation();
    $('lang-drop').classList.toggle('open');
  });
  document.addEventListener('click', () => $('lang-drop').classList.remove('open'));

  document.querySelectorAll('.lopt').forEach(opt => {
    opt.addEventListener('click', () => {
      setLanguage(opt.dataset.lang);
      $('lang-drop').classList.remove('open');
    });
  });

  document.querySelectorAll('.lpill').forEach(pill => {
    pill.addEventListener('click', () => setLanguage(pill.dataset.lang));
  });

  // Memórias
  $('btn-memories').addEventListener('click', () => {
    $('mem-panel').classList.add('open');
    $('panel-overlay').classList.add('open');
    renderMemories();
  });
  $('btn-close-mem').addEventListener('click', closeMemories);
  $('panel-overlay').addEventListener('click', closeMemories);
  $('btn-clear-mem').addEventListener('click', async () => {
    if (!confirm('Apagar todas as memórias?')) return;
    userProfile.memorias = [];
    await saveProfile();
    renderMemories();
    showToast('Memórias apagadas!');
  });

  // Microfone
  $('btn-mic').addEventListener('click', () => {
    if (isSpeaking) stopSpeaking();
    startListening();
  });

  // Enviar mensagem
  $('btn-send').addEventListener('click', sendMessage);
  $('msg-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  $('msg-input').addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 80) + 'px';
  });

  // Tópicos rápidos
  document.querySelectorAll('.qtopic').forEach(btn => {
    btn.addEventListener('click', () => {
      $('msg-input').value = btn.dataset.msg;
      $('msg-input').focus();
    });
  });
}

// ────────────────────────────────────────
//  IDIOMA
// ────────────────────────────────────────
function setLanguage(lang, showNotification = true) {
  currentLang = lang;
  setVoiceLang(lang);

  const cfg = LANGS[lang];
  if (!cfg) return;

  $('btn-lang').innerHTML = `${cfg.flag} ${cfg.label} ▾`;
  $('msg-input').placeholder = cfg.placeholder;

  document.querySelectorAll('.lopt').forEach(o => o.classList.toggle('active', o.dataset.lang === lang));
  document.querySelectorAll('.lpill').forEach(p => p.classList.toggle('active', p.dataset.lang === lang));

  if (showNotification) showToast(`Idioma: ${cfg.gemini}`);
}

// ────────────────────────────────────────
//  ENVIAR MENSAGEM
// ────────────────────────────────────────
async function sendMessage() {
  const input = $('msg-input');
  const text = input.value.trim();
  if (!text || !currentUser) return;

  stopSpeaking();
  stopListening();

  input.value = '';
  input.style.height = 'auto';
  $('btn-send').disabled = true;

  // Esconde tópicos rápidos
  if (!hasMessages) {
    $('quick-topics').style.display = 'none';
    hasMessages = true;
  }

  addMessage('user', text);
  chatHistory.push({ role:'user', parts:[{ text }] });

  // Avatar pensando
  setAvatarState('thinking');
  const typing = showTyping();

  try {
    const systemPrompt = buildPrompt();
    const response = await callGemini(systemPrompt);

    typing.remove();

    // Avatar fala
    setAvatarState('speaking');
    startLipSync();
    addMessage('ai', response);
    chatHistory.push({ role:'model', parts:[{ text: response }] });

    // Voz
    isSpeaking = true;
    speak(response, currentLang, {
      onStart: () => {},
      onEnd: () => {
        isSpeaking = false;
        setAvatarState('idle');
        stopLipSync();
      }
    });

    // Extrai memórias + salva
    await extractMemories(text);
    await saveMessage(text, response);

    if (chatHistory.length > 30) chatHistory = chatHistory.slice(-28);

  } catch (err) {
    typing.remove();
    setAvatarState('idle');
    stopLipSync();
    console.error(err);
    addMessage('ai', '⚠️ Erro ao conectar com a IA. Verifique sua chave Gemini.');
  }

  $('btn-send').disabled = false;
}

// ────────────────────────────────────────
//  GEMINI API
// ────────────────────────────────────────
function buildPrompt() {
  const langName = LANGS[currentLang]?.gemini || 'Português';
  const mems = userProfile.memorias.length
    ? '\n\nO que você sabe sobre o usuário:\n' + userProfile.memorias.map(m => `- ${m}`).join('\n')
    : '';
  const nome = userProfile.nome ? `O usuário se chama ${userProfile.nome}. ` : '';

  return `Você é ${currentChar.name}, uma IA companheira com personalidade: ${currentChar.personality}.

REGRAS:
1. Responda SEMPRE em ${langName}.
2. Seja ${currentChar.personality.split('.')[0]}.
3. Use no máximo 3 frases. Seja natural e calorosa.
4. Faça uma pergunta de acompanhamento quando relevante.
5. Mencione memórias do usuário quando pertinente.
6. Use 1-2 emojis por resposta.
${nome}${mems}`;
}

async function callGemini(systemPrompt) {
  const messages = [
    { role:'user', parts:[{ text: systemPrompt + '\n\n[INÍCIO]' }] },
    { role:'model', parts:[{ text: `Entendido! Sou ${currentChar.name}! 💜` }] },
    ...chatHistory
  ];

  const res = await fetch(GEMINI_URL, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      contents: messages,
      generationConfig: { temperature:0.88, maxOutputTokens:300, topP:0.95 },
      safetySettings: [
        { category:'HARM_CATEGORY_HARASSMENT', threshold:'BLOCK_ONLY_HIGH' },
        { category:'HARM_CATEGORY_HATE_SPEECH', threshold:'BLOCK_ONLY_HIGH' }
      ]
    })
  });

  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '...';
}

// ────────────────────────────────────────
//  EXTRAÇÃO DE MEMÓRIAS
// ────────────────────────────────────────
async function extractMemories(text) {
  const prompt = `Extraia APENAS fatos pessoais desta mensagem como JSON array de strings simples.
Se não houver nada, retorne [].
Mensagem: "${text}"
Retorne só o JSON, sem explicação.`;

  try {
    const res = await fetch(GEMINI_URL, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        contents:[{ role:'user', parts:[{ text: prompt }] }],
        generationConfig:{ temperature:0.1, maxOutputTokens:150 }
      })
    });
    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    const mems = JSON.parse(raw.replace(/```json|```/g,'').trim());
    if (Array.isArray(mems) && mems.length > 0) {
      const newMems = mems.filter(m =>
        typeof m === 'string' &&
        !userProfile.memorias.some(e => e.toLowerCase().includes(m.toLowerCase().substring(0,15)))
      );
      if (newMems.length > 0) {
        userProfile.memorias = [...userProfile.memorias, ...newMems].slice(-60);
        // Detecta nome
        const nomeM = newMems.find(m => /chama.se|nome é|me chamo/i.test(m));
        if (nomeM) {
          const match = nomeM.match(/([A-ZÀ-Ú][a-zà-ú]+)/);
          if (match) userProfile.nome = match[1];
        }
        await saveProfile();
      }
    }
  } catch(e) { /* silencioso */ }
}

// ────────────────────────────────────────
//  UI — Mensagens
// ────────────────────────────────────────
function addMessage(role, text) {
  const msgs = $('chat-messages');
  const time = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});

  const div = document.createElement('div');
  div.className = `msg ${role}`;

  if (role === 'ai') {
    div.innerHTML = `
      <div>
        <div class="msg-bbl">${text.replace(/\n/g,'<br/>')}</div>
        <div class="msg-time">${currentChar.name} · ${time}</div>
      </div>`;
  } else {
    div.innerHTML = `
      <div>
        <div class="msg-bbl">${text.replace(/\n/g,'<br/>')}</div>
        <div class="msg-time">${time}</div>
      </div>`;
  }

  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;

  // Emoção baseada no conteúdo
  if (role === 'ai') detectEmotion(text);
}

function detectEmotion(text) {
  const t = text.toLowerCase();
  let state = 'idle';
  if (/incrível|ótimo|que legal|adorei|demais|perfeito|uau|wow/i.test(t)) state = 'happy';
  else if (/não sei|interessante|hmm|curioso|deixa eu|pensando/i.test(t)) state = 'thinking';
  else if (/surpreend|nunca pensei|que surpresa|caramba/i.test(t)) state = 'surprised';

  if (state !== 'idle') {
    setAvatarState(state);
    setTimeout(() => setAvatarState('idle'), 2000);
  }
}

function showTyping() {
  const msgs = $('chat-messages');
  const div = document.createElement('div');
  div.className = 'typing-row';
  div.innerHTML = `<div class="typing-bbl"><div class="td"></div><div class="td"></div><div class="td"></div></div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

// ────────────────────────────────────────
//  MEMÓRIAS — UI
// ────────────────────────────────────────
function renderMemories() {
  const list = $('mem-list');
  if (!userProfile.memorias.length) {
    list.innerHTML = `<div class="mem-empty"><span>💭</span><p>Nenhuma memória ainda.<br/>Comece a conversar!</p></div>`;
    return;
  }
  list.innerHTML = userProfile.memorias.map(m =>
    `<div class="mem-item"><div class="mem-tag">💭 Memória</div><div>${m}</div></div>`
  ).join('');
}

function closeMemories() {
  $('mem-panel').classList.remove('open');
  $('panel-overlay').classList.remove('open');
}

// ────────────────────────────────────────
//  FIREBASE
// ────────────────────────────────────────
async function loadUserProfile() {
  if (!currentUser) return;
  try {
    const ref = doc(db, 'usuarios', currentUser.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) userProfile = { ...userProfile, ...snap.data().perfil };
  } catch(e) { console.error(e); }
}

async function saveProfile() {
  if (!currentUser) return;
  try {
    await setDoc(doc(db, 'usuarios', currentUser.uid), {
      perfil: { ...userProfile, atualizado: new Date().toISOString() }
    }, { merge:true });
  } catch(e) { console.error(e); }
}

async function loadChatHistory() {
  if (!currentUser) return;
  try {
    const ref = collection(db, 'usuarios', currentUser.uid, 'historico');
    const q = query(ref, orderBy('data','desc'), limit(12));
    const snap = await getDocs(q);
    const msgs = [];
    snap.forEach(d => msgs.unshift(d.data()));
    if (msgs.length > 0) {
      hasMessages = true;
      $('quick-topics').style.display = 'none';
      msgs.forEach(m => {
        addMessage('user', m.pergunta);
        addMessage('ai', m.resposta);
        chatHistory.push({ role:'user', parts:[{ text: m.pergunta }] });
        chatHistory.push({ role:'model', parts:[{ text: m.resposta }] });
      });
    }
  } catch(e) { console.error(e); }
}

async function saveMessage(pergunta, resposta) {
  if (!currentUser) return;
  try {
    await addDoc(collection(db, 'usuarios', currentUser.uid, 'historico'), {
      data: new Date().toISOString(),
      pergunta, resposta,
      idioma: currentLang,
      personagem: currentChar.id
    });
  } catch(e) { console.error(e); }
}

// ────────────────────────────────────────
//  TOAST
// ────────────────────────────────────────
let toastTimer;
function showToast(msg, ms = 2500) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
