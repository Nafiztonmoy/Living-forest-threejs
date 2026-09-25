import THREE from './three.js';
import { seasonalState, clamp } from './math.js';
import { createTextures } from './textures.js';
import { buildWorld } from './world.js';
import { ForestControls } from './controls.js';
import { createSkyDome } from './sky.js';

export async function startForest() {
  const $ = id => document.getElementById(id);
  const mount = $('scene');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65)); renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.16;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label', 'Interactive 3D forest. Move around, change seasons, and click to change the light.');
  renderer.domElement.tabIndex = 0; mount.appendChild(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost', e => {
    e.preventDefault(); window.reportForestError(new Error('The graphics context was lost. Close other GPU-heavy tabs and reload this page.'));
  });
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#d7e0d3');
  scene.fog = new THREE.Fog('#d7e0d3', 85, 162);
  const camera = new THREE.PerspectiveCamera(43, innerWidth / innerHeight, .1, 260);
  const sun = new THREE.DirectionalLight('#fff0cf', 2.8); sun.position.set(-24, 44, 26);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -37, right: 37, top: 37, bottom: -37, near: 1, far: 125 });
  sun.shadow.bias = -.00015; sun.shadow.normalBias = .1; sun.shadow.radius = 3;
  scene.add(sun); scene.add(sun.target);
  const hemi = new THREE.HemisphereLight('#e7efda', '#625344', 2.15); scene.add(hemi);
  const sky = createSkyDome(scene, sun.position);
  const shared = {
    time: { value: 0 }, season: { value: .18 }, coverage: { value: 1 },
    winter: { value: 0 }, fall: { value: 0 }, leafFall: { value: .18 },
    lightColor: { value: sun.color.clone() }, lightDirection: { value: sun.position.clone().normalize() },
    fogColor: { value: scene.fog.color }
  };
  const textures = createTextures(renderer);
  const forest = buildWorld(scene, textures, shared);
  const lightPresets = [
    { name: 'Daylight', color: '#fff0cf', fog: '#d7e0d3', intensity: 2.8,
      skyTop: '#4f91d8', skyHorizon: '#dfeff6', skyCloud: '#ffffff', skySun: '#fff0c0' },
    { name: 'Golden hour', color: '#ffb25e', fog: '#ded2b9', intensity: 3.1,
      skyTop: '#6682a8', skyHorizon: '#f0b777', skyCloud: '#ffe0b4', skySun: '#ffc36b' },
    { name: 'Moonlight', color: '#97bfff', fog: '#8798aa', intensity: 2.4,
      skyTop: '#0c213f', skyHorizon: '#586f89', skyCloud: '#aebfd0', skySun: '#bfd9ff' },
    { name: 'Rose dusk', color: '#ff9bb8', fog: '#cfc3ca', intensity: 2.6,
      skyTop: '#665783', skyHorizon: '#e8a7b8', skyCloud: '#f1cbd5', skySun: '#ffb4c8' },
    { name: 'Mint glow', color: '#a7ffd7', fog: '#c6dcd0', intensity: 2.5,
      skyTop: '#5d8981', skyHorizon: '#c8e5d8', skyCloud: '#e7fff1', skySun: '#baffdc' }
  ];
  const names = ['Spring', 'Summer', 'Autumn', 'Winter'];
  const notes = [
    'Pink blossoms and a soft breeze.',
    'Green canopy and a calm river.',
    'Warm leaves and gentle leaf fall.',
    'Snow, cold air and quiet woods.'
  ];
  const state = { phase: .18, playing: !matchMedia('(prefers-reduced-motion: reduce)').matches, speed: 1, elapsed: 0, light: 0, quality: 'high' };
  const announce = text => { $('announcement').textContent = text; };
  let toastTimer;
  const toast = text => {
    $('toast').textContent = text; $('toast').classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2100);
  };
  const setLight = index => {
    state.light = ((index % lightPresets.length) + lightPresets.length) % lightPresets.length;
    const preset = lightPresets[state.light];
    sun.color.set(preset.color); sun.intensity = preset.intensity;
    shared.lightColor.value.copy(sun.color);
    sky.setPreset(preset);
    scene.background.set(preset.fog); scene.fog.color.set(preset.fog);
    $('light-name').textContent = preset.name;
    document.querySelectorAll('[data-light]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.light) === state.light)));
    announce(`Light changed to ${preset.name}`);
  };
  const controls = new ForestControls(camera, renderer.domElement, () => { setLight(state.light + 1); toast(`Light: ${lightPresets[state.light].name}`); });
  const syncUI = () => {
    const section = Math.floor(state.phase) % 4;
    $('season-name').textContent = names[section]; $('season-description').textContent = notes[section];
    $('phase-value').textContent = `${Math.round((state.phase % 1) * 100)}% → ${names[(section + 1) % 4]}`;
    $('year-progress').style.width = `${state.phase / 4 * 100}%`;
    $('play-text').textContent = state.playing ? 'Pause' : 'Play';
    $('play-icon').textContent = state.playing ? 'II' : '\u25B6';
    $('play').setAttribute('aria-pressed', String(state.playing));
    $('status-text').textContent = state.playing ? 'Playing' : 'Paused';
    $('live-dot').classList.toggle('paused', !state.playing);
    document.querySelectorAll('[data-season]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.season) === section)));
    $('tour').setAttribute('aria-pressed', String(controls.tour));
  };
  const setSeason = (phase, pause = true) => {
    if (!Number.isFinite(phase)) return;
    state.phase = ((phase % 4) + 4) % 4; if (pause) state.playing = false;
    syncUI(); announce(`Season: ${names[Math.floor(state.phase)]}`);
  };
  document.querySelectorAll('[data-season]').forEach(b => b.addEventListener('click', () => setSeason(Number(b.dataset.season))));
  document.querySelectorAll('[data-light]').forEach(b => b.addEventListener('click', () => setLight(Number(b.dataset.light))));
  $('play').addEventListener('click', () => { state.playing = !state.playing; syncUI(); });
  $('speed').addEventListener('input', e => { state.speed = Number(e.target.value); $('speed-value').textContent = `${state.speed.toFixed(1)}x`; $('year-duration').textContent = `${Math.round(80 / state.speed)}s / year`; });
  $('reset').addEventListener('click', () => { controls.reset(); toast('Camera reset'); });
  $('close-view').addEventListener('click', () => { controls.closeView(); toast('Riverside view'); });
  $('tour').addEventListener('click', () => { controls.tour = !controls.tour; syncUI(); });
  $('quality').addEventListener('change', e => {
    state.quality = e.target.value;
    const low = state.quality === 'low'; renderer.setPixelRatio(low ? 1 : Math.min(devicePixelRatio, 1.65));
    renderer.shadowMap.enabled = !low;
    // Shadow defines must be recompiled on existing materials after toggling.
    scene.traverse(object => {
      const materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
      materials.forEach(material => { material.needsUpdate = true; });
    });
    toast(low ? 'Performance mode: shadows off' : 'High quality: shadows on');
  });
  $('help-open').addEventListener('click', () => { controls.keys.clear(); $('help').showModal(); });
  $('help-close').addEventListener('click', () => $('help').close());
  $('help').addEventListener('click', e => { if (e.target === $('help')) $('help').close(); });
  const toggleUI = () => {
    document.body.classList.toggle('minimal');
    $('hide-label').textContent = document.body.classList.contains('minimal') ? 'Show' : 'Hide';
  };
  $('hide-ui').addEventListener('click', toggleUI);
  window.addEventListener('keydown', e => {
    if (controls.isEditing(e.target) || $('help').open) return;
    if (e.repeat) return;
    if (e.code === 'Space') { e.preventDefault(); state.playing = !state.playing; syncUI(); }
    if (/^Digit[1-4]$/.test(e.code)) setSeason(Number(e.code.slice(-1)) - 1);
    if (e.code === 'KeyR') { controls.reset(); toast('Camera reset'); }
    if (e.code === 'KeyL') setLight(state.light + 1);
    if (e.code === 'KeyH') toggleUI();
    if (e.code === 'Escape') { document.body.classList.remove('minimal'); $('hide-label').textContent = 'Hide'; }
  });
  const resize = () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  };
  window.addEventListener('resize', resize);
  $('tree-count').textContent = `${forest.counts.trees} trees`;
  $('leaf-count').textContent = `${forest.counts.leaves.toLocaleString()} leaves`;
  setLight(0); syncUI();

  // Public read-only diagnostics support a viva and reproducible browser testing.
  window.forestDebug = {
    setSeason, setLight, setPlaying(value) { state.playing = Boolean(value); syncUI(); },
    snapshot() {
      const season = seasonalState(state.phase);
      return {
        threeRevision: THREE.REVISION, phase: state.phase, playing: state.playing,
        winter: season.winter, spring: season.spring, springPetals: season.springPetals, foliageCoverage: season.coverage, light: lightPresets[state.light].name,
        lightHex: sun.color.getHexString(), camera: camera.position.toArray(), cameraType: camera.type,
        customShaders: [forest.foliage.material.type, forest.water.material.type, sky.material.type],
        sky: { top: sky.material.uniforms.uTopColor.value.getHexString(), horizon: sky.material.uniforms.uHorizonColor.value.getHexString() },
        counts: forest.counts, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
        renderer: renderer.getContext().getParameter(renderer.getContext().RENDERER)
      };
    },
    auditTextures() {
      const missing = [];
      scene.traverse(o => {
        if (!o.isMesh && !o.isPoints && !o.isSprite) return;
        for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
          const hasTexture = m.map || (m.uniforms && Object.values(m.uniforms).some(u => u.value && u.value.isTexture));
          if (!hasTexture) missing.push(o.name || o.type);
        }
      });
      return { missingTextures: missing };
    }
  };
  let previous = performance.now(), uiTime = 0, fpsTime = 0, frames = 0;
  const animate = now => {
    const rawDt = Math.max((now - previous) / 1000, 0);
    const dt = Math.min(rawDt, .05); previous = now;
    if (!document.hidden) {
      state.elapsed += dt;
      if (state.playing) state.phase = (state.phase + dt * state.speed / 20) % 4;
      const season = seasonalState(state.phase);
      shared.time.value = state.elapsed; shared.season.value = state.phase;
      shared.winter.value = season.winter; shared.coverage.value = season.coverage; shared.fall.value = season.fall; shared.leafFall.value = season.leafFall;
      controls.update(dt); forest.update(dt, state.elapsed, season);
      sky.update(camera, state.elapsed);
      renderer.render(scene, camera);
      frames++; fpsTime += rawDt; uiTime += dt;
      if (fpsTime >= 1) { $('fps').textContent = `${Math.round(frames / fpsTime)} FPS`; frames = 0; fpsTime = 0; }
      if (uiTime >= .18) { syncUI(); uiTime = 0; }
    }
    requestAnimationFrame(animate);
  };
  sky.update(camera, state.elapsed);
  // Compile the shader programs before dismissing the loader.
  if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
  renderer.render(scene, camera);
  $('loading').classList.add('loaded');
  setTimeout(() => { $('loading').hidden = true; }, 400);
  requestAnimationFrame(animate);
}
startForest().catch(error => window.reportForestError(error));
