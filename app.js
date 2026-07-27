// ================================================================
//  app.js — EchoAI com Personagens Reais (estilo Replika)
//  Firebase + Gemini + Voz + Avatar real animado
// ================================================================

import { db, auth, googleProvider } from './firebase-config.js';
import { initVoice, startListening, stopListening, speak, stopSpeaking, setVoiceLang } from './voice.js';
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc, collection, addDoc, getDocs, orderBy, query, limit } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ──────────────────────────────────────────────────────────
//  ⚠️  COLOQUE SUA CHAVE GEMINI AQUI
//  Acesse: https://aistudio.google.com/app/apikey
// ──────────────────────────────────────────────────────────
const GEMINI_KEY = "COLE_SUA_CHAVE_GEMINI_AQUI";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;

// ── Estado global ──
let currentUser = null;
let currentLang = 'pt-BR';
let currentChar = { id:'luna', name:'Luna', color:'#c46ef5', img:'char_luna.jpg', personality:'carinhosa, criativa e curiosa. Ama arte, poesia e histórias' };
let userProfile = { nome:'', memorias:[] };
let chatHistory = [];
let isSpeaking = false;
let hasMessages = false;

const LANGS = {
  'pt-BR': { flag:'🇧🇷', label:'PT', name:'Português', placeholder:'Escreva ou use o microfone...' },
  'en-US': { flag:'🇺🇸', label:'EN', name:'English',   placeholder:'Write or speak to her...' },
  'es-ES': { flag:'🇪🇸', label:'ES', name:'Español',   placeholder:'Escríbele algo...' },
  'ru-RU': { flag:'🇷🇺', label:'RU', name:'Русский',   placeholder:'Напишите ей...' },
  'zh-CN': { flag:'🇨🇳', label:'ZH', name:'中文',       placeholder:'写信给她...' },
  'fr-FR': { flag:'🇫🇷', label:'FR', name:'Français',  placeholder:'Écrivez-lui...' }
};

const GREET = {
  'pt-BR': n=>`Olá! Sou ${n}. 💜\nMe conta algo sobre você!`,
  'en-US': n=>`Hi! I'm ${n}. 💜\nTell me about yourself!`,
  'es-ES': n=>`¡Hola! Soy ${n}. 💜\n¡Cuéntame sobre ti!`,
  'ru-RU': n=>`Привет! Я ${n}. 💜\nРасскажи о себе!`,
  'zh-CN': n=>`你好！我是${n}。💜\n请告诉我关于你的事！`,
  'fr-FR': n=>`Bonjour! Je suis ${n}. 💜\nParle-moi de toi!`
};

const $ = id => document.getElementById(id);

// ═══════════════════════════════════════
//  INIT
// ═══════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initLoginBg();
  setupLogin();
  setupCharScreen();
  setupChat();

  onAuthStateChanged(auth, async user => {
    if (user) {
      currentUser = user;
      await loadProfile();
      const saved = localStorage.getItem(`echo_char_${user.uid}`);
      if (saved) {
        currentChar = JSON.parse(saved);
        await goToChat();
      } else {
        showScreen('character');
      }
    } else {
      currentUser = null;
      showScreen('login');
    }
  });
});

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(`screen-${name}`).classList.add('active');
}

// ═══════════════════════════════════════
//  LOGIN BG — Partículas no canvas
// ═══════════════════════════════════════
function initLoginBg() {
  const canvas = $('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
  resize();
  addEventListener('resize', resize);

  const dots = Array.from({length:70}, () => ({
    x: Math.random() * canvas.width, y: Math.random() * canvas.height,
    vx:(Math.random()-.5)*.4, vy:(Math.random()-.5)*.4,
    r: Math.random()*2+.5,
    c:['#7b5ef8','#5b8cf7','#c46ef5'][Math.floor(Math.random()*3)]
  }));

  (function loop() {
    requestAnimationFrame(loop);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    dots.forEach(d => {
      d.x+=d.vx; d.y+=d.vy;
      if(d.x<0)d.x=canvas.width; if(d.x>canvas.width)d.x=0;
      if(d.y<0)d.y=canvas.height; if(d.y>canvas.height)d.y=0;
      ctx.beginPath(); ctx.arc(d.x,d.y,d.r,0,Math.PI*2);
      ctx.fillStyle=d.c+'55'; ctx.fill();
    });
    dots.forEach((a,i) => dots.slice(i+1).forEach(b => {
      const dist = Math.hypot(a.x-b.x,a.y-b.y);
      if(dist<110){ ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y);
        ctx.strokeStyle=`rgba(123,94,248,${(1-dist/110)*.12})`; ctx.lineWidth=.5; ctx.stroke(); }
    }));
  })();
}

// ═══════════════════════════════════════
//  TELA DE LOGIN
// ═══════════════════════════════════════
function setupLogin() {
  $('btn-login').addEventListener('click', async () => {
    try {
      $('btn-login').textContent = 'Entrando...';
      await signInWithPopup(auth, googleProvider);
    } catch(e) {
      $('btn-login').innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24">...</svg> Entrar com Google`;
      showToast('Erro ao entrar. Tente novamente.');
    }
  });
}

// ═══════════════════════════════════════
//  TELA DE PERSONAGEM
// ═══════════════════════════════════════
function setupCharScreen() {
  let selectedData = null;

  document.querySelectorAll('.char-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedData = {
        id:   card.dataset.id,
        name: card.dataset.name,
        color: card.dataset.color,
        img:  card.dataset.img,
        personality: card.dataset.personality
      };
      const ni = $('custom-name');
      if (!ni.value || ni.dataset.auto === 'true') {
        ni.value = card.dataset.name;
        ni.dataset.auto = 'true';
      }
      $('btn-start').disabled = false;
    });
  });

  $('custom-name').addEventListener('input', e => { e.target.dataset.auto = 'false'; });

  $('btn-start').addEventListener('click', async () => {
    if (!selectedData) return;
    const cName = $('custom-name').value.trim();
    if (cName) selectedData.name = cName;
    currentChar = selectedData;
    if (currentUser) localStorage.setItem(`echo_char_${currentUser.uid}`, JSON.stringify(currentChar));
    await goToChat();
  });
}

// ═══════════════════════════════════════
//  IR PARA O CHAT
// ═══════════════════════════════════════
async function goToChat() {
  showScreen('chat');
  applyChar(currentChar);
  initParticles();

  initVoice({
    onResult: (text, isFinal) => {
      $('msg-input').value = text;
      if (isFinal && text.trim()) setTimeout(() => sendMessage(), 300);
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

  await loadHistory();

  if (!hasMessages) {
    const greet = (GREET[currentLang] || GREET['pt-BR'])(currentChar.name);
    addMsg('ai', greet);
    isSpeaking = true;
    speak(greet, currentLang, {
      onStart: () => setAvatarState('speaking'),
      onEnd: () => { isSpeaking = false; setAvatarState('idle'); }
    });
  }

  setLang(currentLang, false);
}

// ═══════════════════════════════════════
//  APLICA PERSONAGEM NA UI
// ═══════════════════════════════════════
function applyChar(char) {
  // Header
  $('hdr-name').textContent = char.name;
  const hdrImg = $('hdr-avatar-img');
  if (hdrImg) { hdrImg.src = char.img; hdrImg.alt = char.name; }

  // Avatar stage
  const photo = $('avatar-photo');
  if (photo) { photo.src = char.img; photo.alt = char.name; }

  // Glow color
  const glow = $('avatar-glow');
  if (glow) glow.style.background = `linear-gradient(0deg,${char.color}44,transparent)`;

  // Memórias header
  const mn = $('mem-char-name');
  if (mn) mn.textContent = char.name;
}

// ═══════════════════════════════════════
//  PARTÍCULAS NO AVATAR STAGE
// ═══════════════════════════════════════
function initParticles() {
  const canvas = $('avatar-particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    const stage = $('avatar-stage');
    canvas.width  = stage.offsetWidth;
    canvas.height = stage.offsetHeight;
  }
  resize();
  addEventListener('resize', resize);

  const pts = Array.from({length:40}, () => ({
    x: Math.random()*canvas.width, y: Math.random()*canvas.height,
    vx:(Math.random()-.5)*.3, vy:(Math.random()-.5)*.3,
    r: Math.random()*2+.5, a: Math.random()
  }));

  const color = currentChar.color;

  (function loop() {
    requestAnimationFrame(loop);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    pts.forEach(p => {
      p.x+=p.vx; p.y+=p.vy;
      if(p.x<0)p.x=canvas.width; if(p.x>canvas.width)p.x=0;
      if(p.y<0)p.y=canvas.height; if(p.y>canvas.height)p.y=0;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=color+(Math.floor(p.a*80).toString(16).padStart(2,'0'));
      ctx.fill();
    });
  })();
}

// ═══════════════════════════════════════
//  AVATAR STATE (anima a foto)
// ═══════════════════════════════════════
const STATES = {
  idle:      { emoji:'😊', txt:'Pronta para conversar', dots:true },
  listening: { emoji:'👂', txt:'Ouvindo você...', dots:true },
  thinking:  { emoji:'🤔', txt:'Pensando...', dots:true },
  speaking:  { emoji:'💬', txt:'Falando...', dots:false },
  happy:     { emoji:'😄', txt:'Que legal!', dots:false },
  surprised: { emoji:'😲', txt:'Uau!', dots:false }
};

function setAvatarState(state) {
  const photo = $('avatar-photo');
  const icon  = $('emotion-icon');
  const stxt  = $('status-txt');
  const dots  = $('status-dots');
  const s     = STATES[state] || STATES.idle;

  // Anima a foto
  if (photo) {
    photo.className = 'avatar-photo';
    if (state === 'talking' || state === 'speaking') photo.classList.add('talking');
    if (state === 'thinking') photo.classList.add('thinking');
    if (state === 'listening') photo.classList.add('listening');
  }

  if (icon) { icon.textContent = s.emoji; icon.style.animation='none'; icon.offsetHeight; icon.style.animation=''; }
  if (stxt) stxt.textContent = s.txt;
  if (dots) dots.style.display = s.dots ? 'flex' : 'none';
  if ($('hdr-status')) $('hdr-status').textContent = state==='listening' ? '● Ouvindo...' : '● Online';
}

// ═══════════════════════════════════════
//  CHAT SETUP
// ═══════════════════════════════════════
function setupChat() {
  $('btn-back').addEventListener('click', () => showScreen('character'));
  $('btn-logout').addEventListener('click', async () => {
    if (confirm('Sair?')) { stopSpeaking(); await signOut(auth); }
  });

  $('btn-lang').addEventListener('click', e => {
    e.stopPropagation();
    $('lang-drop').classList.toggle('open');
  });
  document.addEventListener('click', () => $('lang-drop').classList.remove('open'));

  document.querySelectorAll('.lopt').forEach(o => o.addEventListener('click', () => {
    setLang(o.dataset.lang); $('lang-drop').classList.remove('open');
  }));
  document.querySelectorAll('.lpill').forEach(p => p.addEventListener('click', () => setLang(p.dataset.lang)));

  $('btn-memories').addEventListener('click', () => { $('mem-panel').classList.add('open'); $('panel-overlay').classList.add('open'); renderMems(); });
  $('btn-close-mem').addEventListener('click', closeMems);
  $('panel-overlay').addEventListener('click', closeMems);
  $('btn-clear-mem').addEventListener('click', async () => {
    if (!confirm('Apagar memórias?')) return;
    userProfile.memorias = [];
    await saveProfile();
    renderMems();
    showToast('Memórias apagadas!');
  });

  $('btn-mic').addEventListener('click', () => { stopSpeaking(); startListening(); });
  $('btn-send').addEventListener('click', sendMessage);
  $('msg-input').addEventListener('keydown', e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();} });
  $('msg-input').addEventListener('input', function(){this.style.height='auto';this.style.height=Math.min(this.scrollHeight,80)+'px';});
  document.querySelectorAll('.qtopic').forEach(b => b.addEventListener('click', () => { $('msg-input').value=b.dataset.msg; $('msg-input').focus(); }));
}

function setLang(lang, notify = true) {
  currentLang = lang;
  setVoiceLang(lang);
  const cfg = LANGS[lang]; if (!cfg) return;
  $('btn-lang').innerHTML = `${cfg.flag} ${cfg.label} ▾`;
  $('msg-input').placeholder = cfg.placeholder;
  document.querySelectorAll('.lopt').forEach(o => o.classList.toggle('active', o.dataset.lang===lang));
  document.querySelectorAll('.lpill').forEach(p => p.classList.toggle('active', p.dataset.lang===lang));
  if (notify) showToast(`Idioma: ${cfg.name}`);
}

// ═══════════════════════════════════════
//  ENVIAR MENSAGEM
// ═══════════════════════════════════════
async function sendMessage() {
  const input = $('msg-input');
  const text = input.value.trim();
  if (!text || !currentUser) return;

  stopSpeaking(); stopListening();
  input.value = ''; input.style.height = 'auto';
  $('btn-send').disabled = true;

  if (!hasMessages) { $('quick-topics').style.display='none'; hasMessages=true; }

  addMsg('user', text);
  chatHistory.push({ role:'user', parts:[{text}] });

  setAvatarState('thinking');
  const typing = showTyping();

  try {
    const response = await callGemini(buildPrompt());
    typing.remove();

    addMsg('ai', response);
    chatHistory.push({ role:'model', parts:[{text:response}] });
    if (chatHistory.length > 30) chatHistory = chatHistory.slice(-28);

    detectEmotion(response);
    isSpeaking = true;
    speak(response, currentLang, {
      onStart: () => setAvatarState('speaking'),
      onEnd: () => { isSpeaking=false; setAvatarState('idle'); }
    });

    await extractMems(text);
    await saveMsg(text, response);
  } catch(err) {
    typing.remove(); setAvatarState('idle');
    console.error(err);
    addMsg('ai', '⚠️ Erro de conexão. Verifique sua chave Gemini em app.js.');
  }

  $('btn-send').disabled = false;
}

// ═══════════════════════════════════════
//  GEMINI
// ═══════════════════════════════════════
function buildPrompt() {
  const langName = LANGS[currentLang]?.name || 'Português';
  const mems = userProfile.memorias.length
    ? '\n\nO que você sabe sobre o usuário:\n' + userProfile.memorias.map(m=>`- ${m}`).join('\n')
    : '';
  const nome = userProfile.nome ? `O usuário se chama ${userProfile.nome}. ` : '';

  return `Você é ${currentChar.name}, uma companheira de IA com personalidade: ${currentChar.personality}.

REGRAS:
1. Responda SEMPRE em ${langName}.
2. Máximo 3 frases. Seja natural, calorosa e empática.
3. Faça 1 pergunta de acompanhamento quando relevante.
4. Use 1-2 emojis por resposta.
5. Mencione memórias do usuário quando pertinente.
${nome}${mems}`;
}

async function callGemini(systemPrompt) {
  const msgs = [
    { role:'user', parts:[{text: systemPrompt+'\n\n[INÍCIO]'}] },
    { role:'model', parts:[{text:`Olá! Sou ${currentChar.name}! 💜`}] },
    ...chatHistory
  ];
  const res = await fetch(GEMINI_URL, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      contents: msgs,
      generationConfig:{ temperature:0.88, maxOutputTokens:300, topP:0.95 },
      safetySettings:[
        {category:'HARM_CATEGORY_HARASSMENT',threshold:'BLOCK_ONLY_HIGH'},
        {category:'HARM_CATEGORY_HATE_SPEECH',threshold:'BLOCK_ONLY_HIGH'}
      ]
    })
  });
  if(!res.ok) throw new Error(`Gemini API Error ${res.status}`);
  const d = await res.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text || '...';
}

// ═══════════════════════════════════════
//  DETECÇÃO DE EMOÇÃO
// ═══════════════════════════════════════
function detectEmotion(text) {
  let state = 'idle';
  if (/incrível|ótimo|que legal|adorei|perfeito|uau|wow|genial/i.test(text)) state = 'happy';
  else if (/surpreend|nunca pensei|caramba|nossa/i.test(text)) state = 'surprised';
  if (state !== 'idle') {
    setAvatarState(state);
    setTimeout(() => setAvatarState('idle'), 2500);
  }
}

// ═══════════════════════════════════════
//  UI — MENSAGENS
// ═══════════════════════════════════════
function addMsg(role, text) {
  const msgs = $('chat-messages');
  const time = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  const div = document.createElement('div');
  div.className = `msg ${role}`;

  if (role === 'ai') {
    div.innerHTML=`
      <img src="${currentChar.img}" class="msg-av" alt="${currentChar.name}"/>
      <div>
        <div class="msg-bbl">${text.replace(/\n/g,'<br/>')}</div>
        <div class="msg-time">${currentChar.name} · ${time}</div>
      </div>`;
  } else {
    div.innerHTML=`
      <div>
        <div class="msg-bbl">${text.replace(/\n/g,'<br/>')}</div>
        <div class="msg-time">${time}</div>
      </div>`;
  }
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function showTyping() {
  const msgs = $('chat-messages');
  const div = document.createElement('div');
  div.className = 'typing-row';
  div.innerHTML = `<img src="${currentChar.img}" class="msg-av"/><div class="typing-bbl"><div class="td"></div><div class="td"></div><div class="td"></div></div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

// ═══════════════════════════════════════
//  MEMÓRIAS
// ═══════════════════════════════════════
async function extractMems(text) {
  const prompt = `Extraia APENAS fatos pessoais reais desta mensagem como JSON array de strings.
Se não houver nada, retorne [].
Mensagem: "${text}"
Retorne APENAS o JSON, sem nada mais.`;
  try {
    const res = await fetch(GEMINI_URL, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0.1,maxOutputTokens:150}})
    });
    const d = await res.json();
    const raw = d.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    const mems = JSON.parse(raw.replace(/```json|```/g,'').trim());
    if (Array.isArray(mems) && mems.length > 0) {
      const newM = mems.filter(m => typeof m==='string' &&
        !userProfile.memorias.some(e=>e.toLowerCase().includes(m.toLowerCase().substring(0,15))));
      if (newM.length > 0) {
        userProfile.memorias = [...userProfile.memorias, ...newM].slice(-60);
        const nomeM = newM.find(m=>/chama.se|nome é|me chamo/i.test(m));
        if (nomeM) { const match = nomeM.match(/([A-ZÀ-Ú][a-zà-ú]+)/); if(match) userProfile.nome=match[1]; }
        await saveProfile();
      }
    }
  } catch(e){}
}

function renderMems() {
  const list = $('mem-list');
  if (!userProfile.memorias.length) {
    list.innerHTML='<div class="mem-empty"><span>💭</span><p>Nenhuma memória ainda.<br/>Comece a conversar!</p></div>'; return;
  }
  list.innerHTML = userProfile.memorias.map(m=>`<div class="mem-item"><div class="mem-tag">💭</div><div>${m}</div></div>`).join('');
}

function closeMems() { $('mem-panel').classList.remove('open'); $('panel-overlay').classList.remove('open'); }

// ═══════════════════════════════════════
//  FIREBASE
// ═══════════════════════════════════════
async function loadProfile() {
  if (!currentUser) return;
  try {
    const snap = await getDoc(doc(db,'usuarios',currentUser.uid));
    if (snap.exists()) userProfile = {...userProfile, ...snap.data().perfil};
  } catch(e){console.error(e);}
}
async function saveProfile() {
  if (!currentUser) return;
  try { await setDoc(doc(db,'usuarios',currentUser.uid),{perfil:{...userProfile,atualizado:new Date().toISOString()}},{merge:true}); }
  catch(e){console.error(e);}
}
async function loadHistory() {
  if (!currentUser) return;
  try {
    const q = query(collection(db,'usuarios',currentUser.uid,'historico'),orderBy('data','desc'),limit(10));
    const snap = await getDocs(q);
    const msgs=[]; snap.forEach(d=>msgs.unshift(d.data()));
    if (msgs.length>0) {
      hasMessages=true; $('quick-topics').style.display='none';
      msgs.forEach(m=>{
        addMsg('user',m.pergunta); addMsg('ai',m.resposta);
        chatHistory.push({role:'user',parts:[{text:m.pergunta}]});
        chatHistory.push({role:'model',parts:[{text:m.resposta}]});
      });
    }
  } catch(e){console.error(e);}
}
async function saveMsg(pergunta,resposta) {
  if (!currentUser) return;
  try { await addDoc(collection(db,'usuarios',currentUser.uid,'historico'),{data:new Date().toISOString(),pergunta,resposta,idioma:currentLang,personagem:currentChar.id}); }
  catch(e){console.error(e);}
}

// ═══════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════
let toastT;
function showToast(msg, ms=2500) {
  const t=$('toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),ms);
}
