// ================================================================
//  avatar3d.js — Avatar 3D holográfico com Three.js
//  Animações: idle, ouvindo, pensando, falando, feliz, surpresa
// ================================================================

import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';

let scene, camera, renderer, animMixer;
let avatarGroup, headMesh, leftEye, rightEye, mouthMesh;
let particles, particlePositions;
let currentState = 'idle';
let currentColor = new THREE.Color('#7b5ef8');
let lipSyncInterval = null;
let clock;
let isInitialized = false;

// ── Inicializa o avatar 3D ──
export function initAvatar(canvasId, charColor = '#7b5ef8') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  currentColor = new THREE.Color(charColor);
  clock = new THREE.Clock();

  // Renderer
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setClearColor(0x000000, 0);

  // Scene
  scene = new THREE.Scene();

  // Camera
  camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
  camera.position.set(0, 0.2, 3.2);
  camera.lookAt(0, 0, 0);

  // Luzes
  const ambientLight = new THREE.AmbientLight(0x222244, 1.5);
  scene.add(ambientLight);

  const pointLight1 = new THREE.PointLight(charColor, 3, 8);
  pointLight1.position.set(2, 2, 2);
  scene.add(pointLight1);

  const pointLight2 = new THREE.PointLight('#ffffff', 1, 8);
  pointLight2.position.set(-2, -1, 1);
  scene.add(pointLight2);

  const rimLight = new THREE.PointLight(charColor, 2, 6);
  rimLight.position.set(0, -2, -2);
  scene.add(rimLight);

  // Constrói avatar
  buildAvatar(charColor);

  // Partículas
  buildParticles(charColor);

  // Aneis de luz
  buildRings(charColor);

  // Resize handler
  window.addEventListener('resize', onResize);

  // Loop de animação
  isInitialized = true;
  animate();
}

// ── Constrói o avatar holográfico ──
function buildAvatar(color) {
  avatarGroup = new THREE.Group();
  scene.add(avatarGroup);

  const matColor = new THREE.Color(color);

  // Material holográfico wireframe
  const holoMat = new THREE.MeshPhongMaterial({
    color: matColor,
    emissive: matColor,
    emissiveIntensity: 0.4,
    transparent: true,
    opacity: 0.85,
    shininess: 120,
    wireframe: false
  });

  const holoMatWire = new THREE.MeshBasicMaterial({
    color: matColor,
    transparent: true,
    opacity: 0.15,
    wireframe: true
  });

  // ── CABEÇA ──
  const headGeo = new THREE.SphereGeometry(0.65, 32, 24);
  headMesh = new THREE.Mesh(headGeo, holoMat);
  headMesh.position.set(0, 0.5, 0);

  const headWire = new THREE.Mesh(headGeo, holoMatWire);
  headMesh.add(headWire);
  avatarGroup.add(headMesh);

  // ── OLHOS ──
  const eyeGeo = new THREE.SphereGeometry(0.1, 16, 16);
  const eyeMat = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 1.5
  });

  leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.22, 0.6, 0.52);
  avatarGroup.add(leftEye);

  rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.22, 0.6, 0.52);
  avatarGroup.add(rightEye);

  // Brilho nos olhos
  const eyeGlowGeo = new THREE.SphereGeometry(0.13, 8, 8);
  const eyeGlowMat = new THREE.MeshBasicMaterial({
    color: matColor,
    transparent: true,
    opacity: 0.4
  });
  const leftGlow = new THREE.Mesh(eyeGlowGeo, eyeGlowMat);
  leftGlow.position.copy(leftEye.position);
  avatarGroup.add(leftGlow);
  const rightGlow = new THREE.Mesh(eyeGlowGeo, eyeGlowMat);
  rightGlow.position.copy(rightEye.position);
  avatarGroup.add(rightGlow);

  // ── BOCA ──
  const mouthPoints = [];
  for (let i = 0; i <= 12; i++) {
    const t = (i / 12) * Math.PI;
    mouthPoints.push(new THREE.Vector3(
      Math.cos(Math.PI + t) * 0.18,
      Math.sin(Math.PI + t) * 0.06 - 0.05,
      0
    ));
  }
  const mouthCurve = new THREE.CatmullRomCurve3(mouthPoints);
  const mouthGeo = new THREE.TubeGeometry(mouthCurve, 12, 0.025, 6, false);
  const mouthMat = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 1
  });
  mouthMesh = new THREE.Mesh(mouthGeo, mouthMat);
  mouthMesh.position.set(0, 0.3, 0.58);
  avatarGroup.add(mouthMesh);

  // ── PESCOÇO ──
  const neckGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.3, 16);
  const neck = new THREE.Mesh(neckGeo, holoMat);
  neck.position.set(0, -0.18, 0);
  avatarGroup.add(neck);

  // ── OMBROS / TRONCO ──
  const torsoGeo = new THREE.CylinderGeometry(0.5, 0.35, 0.8, 20);
  const torso = new THREE.Mesh(torsoGeo, holoMat);
  torso.position.set(0, -0.8, 0);
  avatarGroup.add(torso);

  const torsoWire = new THREE.Mesh(torsoGeo, holoMatWire);
  torso.add(torsoWire);

  // ── CORE / CRISTAL no peito ──
  const coreGeo = new THREE.OctahedronGeometry(0.18, 0);
  const coreMat = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    emissive: matColor,
    emissiveIntensity: 2,
    transparent: true,
    opacity: 0.9
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.position.set(0, -0.65, 0.35);
  core.userData.isCore = true;
  avatarGroup.add(core);
}

// ── Partículas orbitando ──
function buildParticles(color) {
  const count = 180;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const c = new THREE.Color(color);

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const r = 1.2 + Math.random() * 1.2;
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.5;
    positions[i * 3 + 2] = r * Math.cos(phi);
    colors[i * 3]     = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  particlePositions = positions;

  const mat = new THREE.PointsMaterial({
    size: 0.04,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    sizeAttenuation: true
  });

  particles = new THREE.Points(geo, mat);
  scene.add(particles);
}

// ── Aneis de luz ──
function buildRings(color) {
  const c = new THREE.Color(color);
  [1.1, 1.5, 1.9].forEach((r, i) => {
    const geo = new THREE.TorusGeometry(r, 0.012, 8, 80);
    const mat = new THREE.MeshBasicMaterial({
      color: c,
      transparent: true,
      opacity: 0.15 - i * 0.03
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = Math.PI / 2 + (i * 0.2);
    ring.userData.ringIndex = i;
    scene.add(ring);
  });
}

// ── Troca de cor ao mudar personagem ──
export function setAvatarColor(color) {
  currentColor = new THREE.Color(color);
  if (!scene) return;
  scene.traverse(obj => {
    if (obj.isMesh && obj.material) {
      if (obj.material.color && !obj.material.wireframe) {
        if (obj.material.emissive) {
          obj.material.color.set(color);
          obj.material.emissive.set(color);
        }
      }
    }
  });
}

// ── Estados do avatar ──
export function setAvatarState(state) {
  currentState = state;
  updateStatusBadge(state);
}

function updateStatusBadge(state) {
  const badge = document.getElementById('emotion-badge');
  const statusText = document.getElementById('status-text');
  const statusDots = document.querySelector('.status-dots');
  if (!badge) return;

  const states = {
    idle:      { emoji: '😊', text: 'Pronta para conversar', dots: true },
    listening: { emoji: '👂', text: 'Ouvindo você...', dots: true },
    thinking:  { emoji: '🤔', text: 'Pensando...', dots: true },
    speaking:  { emoji: '💬', text: 'Falando...', dots: false },
    happy:     { emoji: '😄', text: 'Que legal!', dots: false },
    surprised: { emoji: '😲', text: 'Uau!', dots: false }
  };

  const s = states[state] || states.idle;
  badge.textContent = s.emoji;
  badge.style.animation = 'none';
  badge.offsetHeight; // reflow
  badge.style.animation = 'emotionPop .3s ease';
  if (statusText) statusText.textContent = s.text;
  if (statusDots) statusDots.style.display = s.dots ? 'flex' : 'none';
}

// ── Animação de lip sync (boca) ──
export function startLipSync() {
  stopLipSync();
  lipSyncInterval = setInterval(() => {
    if (mouthMesh) {
      const scale = 1 + Math.random() * 0.6;
      mouthMesh.scale.y = scale;
    }
  }, 80);
}

export function stopLipSync() {
  if (lipSyncInterval) {
    clearInterval(lipSyncInterval);
    lipSyncInterval = null;
  }
  if (mouthMesh) mouthMesh.scale.y = 1;
}

// ── Loop de animação ──
function animate() {
  requestAnimationFrame(animate);
  if (!isInitialized) return;

  const t = clock.getElapsedTime();

  if (avatarGroup) {
    // Respiração (idle)
    if (currentState === 'idle' || currentState === 'speaking') {
      avatarGroup.position.y = Math.sin(t * 1.2) * 0.04;
      avatarGroup.rotation.y = Math.sin(t * 0.4) * 0.08;
    }

    // Tremida rápida (pensando)
    if (currentState === 'thinking') {
      avatarGroup.rotation.y = Math.sin(t * 8) * 0.06;
      avatarGroup.position.y = Math.sin(t * 6) * 0.02;
    }

    // Pulsa (ouvindo)
    if (currentState === 'listening') {
      const pulse = 1 + Math.sin(t * 4) * 0.04;
      avatarGroup.scale.set(pulse, pulse, pulse);
    } else {
      avatarGroup.scale.set(1, 1, 1);
    }

    // Surpresa: cabeça para trás
    if (currentState === 'surprised') {
      headMesh.rotation.x = Math.sin(t * 2) * 0.15;
    } else if (headMesh) {
      headMesh.rotation.x = 0;
    }
  }

  // Piscar olhos
  const blinkCycle = (t % 4);
  if (blinkCycle > 3.8) {
    const blink = Math.sin((blinkCycle - 3.8) * Math.PI / 0.2);
    if (leftEye) leftEye.scale.y = 1 - blink * 0.9;
    if (rightEye) rightEye.scale.y = 1 - blink * 0.9;
  } else {
    if (leftEye) leftEye.scale.y = 1;
    if (rightEye) rightEye.scale.y = 1;
  }

  // Rotação das partículas
  if (particles) {
    particles.rotation.y = t * 0.08;
    particles.rotation.x = Math.sin(t * 0.2) * 0.05;
  }

  // Pulsação do core
  scene.traverse(obj => {
    if (obj.userData && obj.userData.isCore) {
      obj.rotation.y = t * 1.5;
      obj.rotation.x = t * 0.8;
      const pulse = 0.8 + Math.sin(t * 2) * 0.2;
      obj.scale.set(pulse, pulse, pulse);
    }
    if (obj.userData && obj.userData.ringIndex !== undefined) {
      obj.rotation.z = t * (0.15 + obj.userData.ringIndex * 0.05);
    }
  });

  renderer.render(scene, camera);
}

// ── Resize ──
function onResize() {
  const canvas = renderer?.domElement;
  if (!canvas || !renderer || !camera) return;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

// Background canvas da tela de login (efeito de partículas)
export function initLoginBackground(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const dots = Array.from({ length: 80 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.5,
    r: Math.random() * 2 + 0.5,
    color: ['#7b5ef8','#5b8cf7','#c46ef5'][Math.floor(Math.random()*3)]
  }));

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dots.forEach(d => {
      d.x += d.vx; d.y += d.vy;
      if (d.x < 0) d.x = canvas.width;
      if (d.x > canvas.width) d.x = 0;
      if (d.y < 0) d.y = canvas.height;
      if (d.y > canvas.height) d.y = 0;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = d.color + '66';
      ctx.fill();
    });
    // Conexões
    dots.forEach((a, i) => {
      dots.slice(i + 1).forEach(b => {
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(123,94,248,${(1 - dist / 120) * 0.15})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      });
    });
    requestAnimationFrame(draw);
  }
  draw();
}
