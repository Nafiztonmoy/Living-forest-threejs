import THREE from './three.js';
import { randomGenerator, noise2, riverX, riverWidth, pathZ, RADIUS, smoothstep } from './math.js';

/** Canvas-generated image textures: these are real sampled textures, not flat colors. */
export function createTextures(renderer) {
  const rng = randomGenerator(17021);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const make = (size, draw, color = true) => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is unavailable.');
    draw(ctx, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.anisotropy = aniso;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
  };
  const terrain = make(512, (ctx, s) => {
    const image = ctx.createImageData(s, s);
    for (let py = 0; py < s; py++) for (let px = 0; px < s; px++) {
      const x = (px / (s - 1) - 0.5) * RADIUS * 2;
      // Image top is positive z, matching the geometry's UV orientation.
      const z = (0.5 - py / (s - 1)) * RADIUS * 2;
      const n = noise2(px / 25, py / 25) * 0.6 + noise2(px / 6, py / 6) * 0.4;
      const fine = rng() * 17;
      const sand = 1 - smoothstep(0.2, 1.6, Math.abs(z - pathZ(x)));
      const shore = 1 - smoothstep(riverWidth(z), riverWidth(z) + 1.7, Math.abs(x - riverX(z)));
      const earth = Math.max(sand, shore * 0.85);
      const grass = [79 + n * 48, 97 + n * 46, 46 + n * 30];
      const soil = [148 + n * 45, 127 + n * 40, 86 + n * 36];
      const i = (py * s + px) * 4;
      for (let c = 0; c < 3; c++) image.data[i + c] = grass[c] * (1 - earth) + soil[c] * earth + fine;
      image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    for (let i = 0; i < 1900; i++) {
      const x = rng() * s, y = rng() * s;
      ctx.fillStyle = `rgba(233,222,161,${0.04 + rng() * 0.1})`;
      ctx.fillRect(x, y, 0.5 + rng() * 1.8, 0.8 + rng() * 2);
    }
  });
  const bark = make(256, (ctx, s) => {
    ctx.fillStyle = '#786044'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 700; i++) {
      const x = rng() * s, y = rng() * s, shade = 36 + rng() * 73;
      ctx.strokeStyle = `rgba(${shade + 32},${shade + 17},${shade},0.65)`;
      ctx.lineWidth = 0.7 + rng() * 3;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + 7, y + 20, x - 9, y + 45, x + rng() * 8, y + 40 + rng() * 95);
      ctx.stroke();
    }
  });
  bark.repeat.set(2, 3);
  const stone = make(256, (ctx, s) => {
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const n = noise2(x / 42, y / 20) * 33 + noise2(x / 8, y / 8) * 16;
      const band = Math.sin(y * 0.12 + noise2(x / 35, y / 35) * 3) * 9;
      const v = 110 + n + band + rng() * 18;
      const i = (y * s + x) * 4;
      img.data[i] = v * 1.035; img.data[i + 1] = v; img.data[i + 2] = v * 0.88; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    for (let i = 0; i < 34; i++) {
      const y = rng() * s;
      ctx.strokeStyle = 'rgba(40,43,32,0.22)'; ctx.lineWidth = 0.5 + rng();
      ctx.beginPath(); ctx.moveTo(0, y);
      for (let x = 0; x <= s; x += 12) ctx.lineTo(x, y + Math.sin(x * 0.06 + i) * 3);
      ctx.stroke();
    }
  });
  stone.repeat.set(2, 2);
  const wood = make(128, (ctx, s) => {
    ctx.fillStyle = '#b18e5c'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 120; i++) {
      const y = rng() * s;
      ctx.strokeStyle = `rgba(65,39,20,${0.1 + rng() * 0.22})`;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(35, y + 4, 78, y - 4, s, y); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(41,31,22,.45)'; ctx.strokeRect(1, 1, s - 2, s - 2);
  });
  const leaf = make(64, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    const g = ctx.createLinearGradient(7, 50, 52, 8); g.addColorStop(0, '#9eaa7c'); g.addColorStop(.5, '#f0efce'); g.addColorStop(1, '#b9c69a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(9, 57);
    ctx.bezierCurveTo(-1, 18, 27, 1, 57, 6); ctx.bezierCurveTo(61, 40, 39, 65, 9, 57); ctx.fill();
    ctx.strokeStyle = 'rgba(65,83,39,.52)'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(7, 60); ctx.lineTo(54, 9); ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const x = 17 + i * 7, y = 50 - i * 8;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 8, y - 13);
      ctx.moveTo(x, y); ctx.lineTo(x + 14, y + 5); ctx.stroke();
    }
  });
  // Sakura blossom texture used only in spring. Five soft petals surround a warm center.
  const blossom = make(64, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.save();
    ctx.translate(s / 2, s / 2);
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI * 2 / 5 - Math.PI / 2);
      const g = ctx.createRadialGradient(0, -14, 2, 0, -15, 15);
      g.addColorStop(0, 'rgba(255,247,250,.98)');
      g.addColorStop(.58, 'rgba(248,180,203,.96)');
      g.addColorStop(1, 'rgba(226,110,154,.10)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -3);
      ctx.bezierCurveTo(-13, -9, -12, -26, 0, -28);
      ctx.bezierCurveTo(12, -26, 13, -9, 0, -3);
      ctx.fill();
      ctx.restore();
    }
    const center = ctx.createRadialGradient(0, 0, 0, 0, 0, 7);
    center.addColorStop(0, '#ffe7a6'); center.addColorStop(.55, '#f2b55e'); center.addColorStop(1, 'rgba(242,181,94,0)');
    ctx.fillStyle = center; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
  const petal = make(32, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.save(); ctx.translate(s / 2, s / 2); ctx.rotate(-.28);
    const g = ctx.createRadialGradient(0, -2, 1, 0, 0, 13);
    g.addColorStop(0, 'rgba(255,248,251,1)');
    g.addColorStop(.55, 'rgba(248,177,203,.98)');
    g.addColorStop(1, 'rgba(224,104,150,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 12); ctx.bezierCurveTo(-10, 6, -10, -7, 0, -12); ctx.bezierCurveTo(10, -7, 10, 6, 0, 12); ctx.fill();
    ctx.restore();
  });
  const grass = make(64, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    for (let i = 0; i < 9; i++) {
      const x = 8 + rng() * 48, height = 19 + rng() * 39;
      ctx.fillStyle = i % 2 ? '#9eac64' : '#d1cd8a';
      ctx.beginPath(); ctx.moveTo(x, 64); ctx.quadraticCurveTo(x - 9, 45, x - 13 + rng() * 26, 64 - height);
      ctx.quadraticCurveTo(x + 6, 47, x + 4, 64); ctx.fill();
    }
  });
  const noise = make(128, (ctx, s) => {
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const n = (noise2(x / 16, y / 16) * .65 + noise2(x / 5, y / 5) * .35) * 255;
      const i = (y * s + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = n; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, false);
  const shadow = make(64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(12,24,8,.43)'); g.addColorStop(.55, 'rgba(12,24,8,.22)'); g.addColorStop(1, 'rgba(12,24,8,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  });
  const snow = make(32, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, '#ffffff'); g.addColorStop(.32, 'rgba(255,255,255,.96)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  });
  const fur = make(128, (ctx, s) => {
    ctx.fillStyle = '#f3f3ef'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 1500; i++) {
      const x = rng() * s, y = rng() * s, len = 3 + rng() * 8, a = -Math.PI / 2 + (rng() - .5) * .75;
      const shade = 210 + rng() * 36;
      ctx.strokeStyle = `rgba(${shade},${shade},${shade - 6},${0.08 + rng() * .14})`;
      ctx.lineWidth = 0.6 + rng() * 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
    for (let i = 0; i < 220; i++) {
      const x = rng() * s, y = rng() * s, r = 0.6 + rng() * 1.6;
      ctx.fillStyle = `rgba(255,255,255,${0.03 + rng() * 0.05})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  });
  fur.repeat.set(2, 2);
  const feather = make(64, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    const g = ctx.createLinearGradient(0, s, s, 0);
    g.addColorStop(0, '#3e4654'); g.addColorStop(.55, '#a7b0bc'); g.addColorStop(1, '#f2f4f6');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(6, 56); ctx.quadraticCurveTo(20, 8, 58, 8); ctx.quadraticCurveTo(42, 42, 6, 56); ctx.fill();
    ctx.strokeStyle = 'rgba(34,40,48,.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(7, 55); ctx.lineTo(54, 10); ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const x = 16 + i * 6, y = 46 - i * 5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 6, y - 11);
      ctx.moveTo(x, y); ctx.lineTo(x + 10, y + 2); ctx.stroke();
    }
  });
  return { terrain, bark, stone, wood, leaf, blossom, petal, grass, noise, shadow, snow, fur, feather };
}
