import THREE from './three.js';
import { RADIUS, randomGenerator, riverX, riverWidth, pathZ, terrainHeight, clamp, smoothstep } from './math.js';
import { makeLeafMaterial, makeWaterMaterial, addSnowToMaterial } from './shaders.js';

/** All mesh surfaces have a map, alpha texture, or a texture sampled by a shader. */
export function buildWorld(scene, textures, shared) {
  const rng = randomGenerator(174204);
  const world = new THREE.Group(); world.name = 'Forest diorama'; scene.add(world);
  const stoneMat = addSnowToMaterial(new THREE.MeshStandardMaterial({
    name: 'Textured granite', map: textures.stone, roughness: 0.97, flatShading: true,
    bumpMap: textures.stone, bumpScale: 0.18, color: '#b4b9a3'
  }), shared.winter, 0.88);
  const groundMat = addSnowToMaterial(new THREE.MeshStandardMaterial({
    name: 'Textured forest floor and trail', map: textures.terrain, roughness: 0.96,
    bumpMap: textures.terrain, bumpScale: 0.08
  }), shared.winter);
  const barkMat = new THREE.MeshStandardMaterial({
    name: 'Textured bark', map: textures.bark, roughness: 0.95,
    bumpMap: textures.bark, bumpScale: 0.075
  });
  const woodMat = addSnowToMaterial(new THREE.MeshStandardMaterial({
    name: 'Textured bridge timber', map: textures.wood, roughness: 0.85
  }), shared.winter, 0.8);
  const cast = mesh => { mesh.castShadow = true; mesh.receiveShadow = true; world.add(mesh); return mesh; };

  // A textured rock foundation keeps the study readable as a compact 3D island.
  const foundationGeo = new THREE.CylinderGeometry(RADIUS, RADIUS * 0.94, 3.8, 96, 3);
  const foundation = cast(new THREE.Mesh(foundationGeo, stoneMat));
  foundation.name = 'Rock foundation'; foundation.position.y = -2.16;
  // Terrain uses concentric rings so no triangular cells stick outside the island.
  const radial = 72, rings = 65, p = [0, terrainHeight(0, 0), 0], uv = [.5, .5], idx = [];
  for (let j = 1; j <= rings; j++) for (let i = 0; i <= radial; i++) {
    const a = i / radial * Math.PI * 2, r = j / rings * RADIUS;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    p.push(x, terrainHeight(x, z), z); uv.push(x / (RADIUS * 2) + .5, z / (RADIUS * 2) + .5);
  }
  for (let i = 0; i < radial; i++) idx.push(0, 1 + i + 1, 1 + i);
  for (let j = 0; j < rings - 1; j++) for (let i = 0; i < radial; i++) {
    const a = 1 + j * (radial + 1) + i, b = a + radial + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const terrainGeo = new THREE.BufferGeometry();
  terrainGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  terrainGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); terrainGeo.setIndex(idx); terrainGeo.computeVertexNormals();
  const ground = cast(new THREE.Mesh(terrainGeo, groundMat)); ground.name = 'Uneven textured terrain'; ground.castShadow = false;

  // The river follows the same mathematical centerline used to carve the terrain.
  const wp = [], wuv = [], wi = [], segments = 150;
  for (let j = 0; j <= segments; j++) {
    const z = -26.25 + j / segments * 52.5;
    const width = riverWidth(z) + 0.15;
    wp.push(riverX(z) - width, 0.04, z, riverX(z) + width, 0.04, z);
    wuv.push(0, j / segments, 1, j / segments);
    if (j < segments) { const i = j * 2; wi.push(i, i + 2, i + 1, i + 1, i + 2, i + 3); }
  }
  const waterGeo = new THREE.BufferGeometry(); waterGeo.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
  waterGeo.setAttribute('uv', new THREE.Float32BufferAttribute(wuv, 2)); waterGeo.setIndex(wi); waterGeo.computeVertexNormals();
  const water = new THREE.Mesh(waterGeo, makeWaterMaterial(textures, shared)); water.name = 'Animated river'; world.add(water);

  // Tall, irregular multi-level granite columns: explicitly cliffs, not only pebbles.
  const cliffSites = [
    [-17, -11, 5.0, 10.5, 4.1], [-13.5, -16, 4.8, 14.0, 4.0],
    [-8.6, -18.2, 3.8, 10.6, 3.7], [-20, -6.1, 4.1, 7.0, 4.2],
    [13.0, -15.8, 4.2, 9.4, 4.0], [17.4, -11.5, 4.0, 12.0, 3.9],
    [20.0, -6.7, 3.3, 6.8, 3.4]
  ];
  for (let c = 0; c < cliffSites.length; c++) {
    const [x, z, sx, sy, sz] = cliffSites[c];
    const geo = new THREE.CylinderGeometry(.75, 1.0, 1, 7, 4);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
      // Same formula at duplicate positions keeps the column watertight.
      const wobble = 1 + .09 * Math.sin(vy * 18 + vx * 6 + c) + .055 * Math.cos(vz * 12 + vy * 5);
      pos.setXYZ(i, vx * wobble + vy * .13, vy + .055 * Math.sin(vx * 5 + vz * 6 + c), vz * wobble);
    }
    geo.computeVertexNormals();
    const cliff = cast(new THREE.Mesh(geo, stoneMat)); cliff.name = `Textured cliff ${c + 1}`;
    cliff.position.set(x, terrainHeight(x, z) + sy * .46, z); cliff.scale.set(sx, sy, sz); cliff.rotation.y = c * .7;
  }
  const rockGeo = new THREE.IcosahedronGeometry(1, 1);
  const rocks = new THREE.InstancedMesh(rockGeo, stoneMat, 100); rocks.name = 'Textured boulders';
  const dummy = new THREE.Object3D();
  for (let i = 0; i < rocks.count; i++) {
    let z = -24 + rng() * 48;
    let x = i < 65 ? riverX(z) + (rng() < .5 ? -1 : 1) * (riverWidth(z) + .8 + rng() * 1.5) : (rng() - .5) * 44;
    const distance = Math.hypot(x, z);
    if (distance > RADIUS - 1.2) { x *= (RADIUS - 1.2) / distance; z *= (RADIUS - 1.2) / distance; }
    const s = .20 + rng() * .57;
    dummy.position.set(x, terrainHeight(x, z) + s * .18, z);
    dummy.rotation.set(rng(), rng() * 6.28, rng()); dummy.scale.set(s * 1.3, s * .8, s);
    dummy.updateMatrix(); rocks.setMatrixAt(i, dummy.matrix);
  }
  cast(rocks);

  // Procedural tree architecture: tapered trunks, branches, and smaller twigs.
  const treeSites = [
    [-10,12,1.16],[-18,8,.93],[-18,1,1.08],[-11,1,1.02],[-10,-7,.86],
    [-5,-11,.90],[-5,-19,.82],[7,-19,.90],[10,-8,1.04],[16,1,1.10],
    [20,7,.89],[14,12,1.04],[8,18,.83],[-5,20,.96],[-13,18,.83],
    [-21,12,.76],[-23,0,.78],[-19,-18,.72],[-15,-21,.71],[21,-11,.73],
    [18,16,.74],[11,22,.76],[-11,23,.68],[5,10,.68],[-5,7,.72],
    [11,0,.79],[-14,-5,.82],[8,-13,.80],[22,1,.71],[-21,-11,.75]
  ];
  const branches = [], leaves = [];
  const branch = (a, b, radius) => branches.push({ a: new THREE.Vector3(...a), b: new THREE.Vector3(...b), radius });
  const contactMat = new THREE.MeshBasicMaterial({ map: textures.shadow, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const contactShadows = [];
  treeSites.forEach(([x, z, scale], treeIndex) => {
    const y = terrainHeight(x, z), height = (5.4 + rng() * 1.5) * scale;
    const leanX = (rng() - .5) * .55, leanZ = (rng() - .5) * .55;
    branch([x, y - .05, z], [x + leanX, y + height, z + leanZ], .29 * scale);
    for (let root = 0; root < 4; root++) {
      const angle = root * Math.PI / 2 + treeIndex;
      const ex = x + Math.cos(angle) * .86 * scale, ez = z + Math.sin(angle) * .86 * scale;
      branch([x, y + .64 * scale, z], [ex, terrainHeight(ex, ez) + .07, ez], .12 * scale);
    }
    for (let k = 0; k < 5; k++) {
      const angle = k * Math.PI * 2 / 5 + treeIndex * 1.12;
      const reach = (1.6 + rng() * .65) * scale;
      const cx = x + Math.cos(angle) * reach, cz = z + Math.sin(angle) * reach;
      const cy = y + height * (.82 + rng() * .35);
      branch([x + leanX * .7, y + height * .58, z + leanZ * .7], [cx, cy, cz], .12 * scale);
      for (let twig = 0; twig < 2; twig++) {
        const ta = angle + (twig ? .58 : -.58);
        branch([cx - Math.cos(angle) * .5, cy - .5, cz - Math.sin(angle) * .5],
          [cx + Math.cos(ta) * 1.1 * scale, cy + .72 * scale, cz + Math.sin(ta) * 1.1 * scale], .05 * scale);
      }
      const count = Math.round(84 * scale);
      for (let n = 0; n < count; n++) {
        const a = rng() * Math.PI * 2, v = rng() * 2 - 1, rad = Math.cbrt(rng()), plane = Math.sqrt(1 - v * v);
        leaves.push({
          x: cx + Math.cos(a) * plane * rad * 1.85 * scale,
          y: cy + v * rad * 1.50 * scale + .52 * scale,
          z: cz + Math.sin(a) * plane * rad * 1.85 * scale,
          size: (.64 + rng() * .5) * scale, rx: rng() * 6.28, ry: rng() * 6.28, rz: rng() * 6.28, seed: rng()
        });
      }
    }
    const shadeSize = Math.min(7 * scale, Math.max(1, 2 * (RADIUS - Math.hypot(x, z))));
    const shade = new THREE.Mesh(new THREE.PlaneGeometry(shadeSize, shadeSize), contactMat);
    shade.rotation.x = -Math.PI / 2; shade.position.set(x, y + .045, z); shade.name = 'Textured canopy contact shade';
    world.add(shade); contactShadows.push(shade);
  });
  const trunkGeo = new THREE.CylinderGeometry(.60, 1, 1, 7, 1);
  const trunks = new THREE.InstancedMesh(trunkGeo, barkMat, branches.length); trunks.name = 'Textured trunks and branches';
  const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
  branches.forEach(({ a, b, radius }, i) => {
    dir.subVectors(b, a); dummy.position.copy(a).add(b).multiplyScalar(.5);
    dummy.quaternion.setFromUnitVectors(up, dir.clone().normalize()); dummy.scale.set(radius, dir.length(), radius);
    dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
  });
  cast(trunks);
  const leafGeo = new THREE.PlaneGeometry(1, 1, 1, 1);
  leafGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(leaves.map(l => l.seed)), 1));
  const foliage = new THREE.InstancedMesh(leafGeo, makeLeafMaterial(textures, shared), leaves.length);
  foliage.name = 'Seasonal shader leaves';
  leaves.forEach((leaf, i) => {
    dummy.position.set(leaf.x, leaf.y, leaf.z); dummy.rotation.set(leaf.rx, leaf.ry, leaf.rz);
    dummy.scale.setScalar(leaf.size); dummy.updateMatrix(); foliage.setMatrixAt(i, dummy.matrix);
  });
  foliage.frustumCulled = false; world.add(foliage);

  // Sakura blossom overlay. A subset of canopy positions receives a five-petal texture in spring.
  const blossomLeaves = leaves.filter((_, i) => i % 7 === 0);
  const blossomGeo = new THREE.PlaneGeometry(.72, .72);
  const blossomMat = new THREE.MeshStandardMaterial({
    name: 'Textured Sakura blossoms', map: textures.blossom, transparent: true, alphaTest: .18,
    depthWrite: false, side: THREE.DoubleSide, roughness: .92, color: '#fff0f5', opacity: 0
  });
  const blossoms = new THREE.InstancedMesh(blossomGeo, blossomMat, blossomLeaves.length);
  blossoms.name = 'Spring Sakura blossom clusters'; blossoms.frustumCulled = false;
  blossomLeaves.forEach((leaf, i) => {
    dummy.position.set(leaf.x, leaf.y + .06, leaf.z);
    dummy.rotation.set(leaf.rx + .3, leaf.ry, leaf.rz - .2);
    dummy.scale.setScalar(leaf.size * (.62 + (i % 5) * .035));
    dummy.updateMatrix(); blossoms.setMatrixAt(i, dummy.matrix);
  });
  blossoms.visible = false; world.add(blossoms);

  // Drifting Sakura petals are separate from the all-season leaf-fall system.
  const petalCount = 360;
  const petalPos = new Float32Array(petalCount * 3);
  const petalSeed = new Float32Array(petalCount);
  const resetPetal = (i, high = true) => {
    const tree = treeSites[i % treeSites.length];
    const o = i * 3, seed = petalSeed[i] || rng(); petalSeed[i] = seed;
    petalPos[o] = tree[0] + (rng() - .5) * 5.0;
    petalPos[o + 1] = high ? 7.5 + rng() * 10.5 : 1.0 + rng() * 16.0;
    petalPos[o + 2] = tree[1] + (rng() - .5) * 5.0;
  };
  for (let i = 0; i < petalCount; i++) resetPetal(i, false);
  const petalGeo = new THREE.BufferGeometry();
  petalGeo.setAttribute('position', new THREE.BufferAttribute(petalPos, 3).setUsage(THREE.DynamicDrawUsage));
  const petalMat = new THREE.PointsMaterial({
    name: 'Textured falling Sakura petals', map: textures.petal, size: .34,
    transparent: true, depthWrite: false, opacity: 0, color: '#ffd8e5', alphaTest: .05,
    sizeAttenuation: true
  });
  const petals = new THREE.Points(petalGeo, petalMat); petals.name = 'Falling Sakura petals'; petals.visible = false; world.add(petals);

  // Ground vegetation is textured too. Exclude river, footpath and cliff footprints.
  const grassMat = new THREE.MeshStandardMaterial({ name: 'Textured grass', map: textures.grass,
    side: THREE.DoubleSide, alphaTest: .5, transparent: true, depthWrite: false,
    color: '#c6d18f', roughness: 1, opacity: 1 });
  const grassPositions = [];
  for (let i = 0; i < 2800; i++) {
    const x = (rng() - .5) * 52, z = (rng() - .5) * 52;
    if (Math.hypot(x, z) > 25.8 || Math.abs(x - riverX(z)) < riverWidth(z) + 2 || Math.abs(z - pathZ(x)) < 1.3) continue;
    grassPositions.push([x, z]);
  }
  const grass = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), grassMat, grassPositions.length);
  grass.name = 'Textured undergrowth'; grass.renderOrder = 1;
  grassPositions.forEach(([x, z], i) => {
    const h = .24 + rng() * .6;
    dummy.position.set(x, terrainHeight(x, z) + h * .45, z); dummy.rotation.set(0, rng() * Math.PI, 0);
    dummy.scale.set(h * 1.45, h, 1); dummy.updateMatrix(); grass.setMatrixAt(i, dummy.matrix);
  }); world.add(grass);

  // Ground litter/petal carpet: very visible in Sakura spring so the forest floor stops looking green.
  const groundLitterMax = 5200;
  const litterGeo = new THREE.PlaneGeometry(1, 1);
  const litterMat = new THREE.MeshStandardMaterial({
    name: 'Seasonal ground litter', map: textures.petal, transparent: true, depthWrite: false,
    alphaTest: .04, side: THREE.DoubleSide, roughness: .96, color: '#f7c1d2', opacity: 0
  });
  const groundLitter = new THREE.InstancedMesh(litterGeo, litterMat, groundLitterMax);
  groundLitter.name = 'Seasonal ground leaves and petals';
  groundLitter.frustumCulled = false; groundLitter.renderOrder = 2;
  let litterIndex = 0;
  const addGroundPatch = (cx, cz, spread, baseScale, count) => {
    for (let n = 0; n < count && litterIndex < groundLitterMax; n++) {
      const angle = rng() * Math.PI * 2;
      const radius = Math.sqrt(rng()) * spread;
      const x = cx + Math.cos(angle) * radius;
      const z = cz + Math.sin(angle) * radius;
      if (Math.hypot(x, z) > 25.7) continue;
      if (Math.abs(x - riverX(z)) < riverWidth(z) + 1.1 || Math.abs(z - pathZ(x)) < .85) continue;
      const y = terrainHeight(x, z) + .028 + rng() * .02;
      const scale = baseScale * (.72 + rng() * .95);
      dummy.position.set(x, y, z);
      dummy.rotation.set(-Math.PI / 2 + (rng() - .5) * .24, rng() * Math.PI * 2, (rng() - .5) * .42);
      dummy.scale.set(scale * (1.05 + rng() * .35), scale * (.72 + rng() * .3), 1);
      dummy.updateMatrix(); groundLitter.setMatrixAt(litterIndex++, dummy.matrix);
    }
  };
  treeSites.forEach(([x, z, scale]) => addGroundPatch(x, z, 2.6 + scale * 1.8, .28 + scale * .13, 130));
  while (litterIndex < groundLitterMax) {
    const x = (rng() - .5) * 50, z = (rng() - .5) * 50;
    if (Math.hypot(x, z) > 25.7 || Math.abs(x - riverX(z)) < riverWidth(z) + 1.4 || Math.abs(z - pathZ(x)) < 1.0) continue;
    const y = terrainHeight(x, z) + .02;
    const scale = .16 + rng() * .16;
    dummy.position.set(x, y, z);
    dummy.rotation.set(-Math.PI / 2 + (rng() - .5) * .18, rng() * Math.PI * 2, (rng() - .5) * .3);
    dummy.scale.set(scale * (1 + rng() * .55), scale * (.78 + rng() * .25), 1);
    dummy.updateMatrix(); groundLitter.setMatrixAt(litterIndex++, dummy.matrix);
  }
  groundLitter.count = 0; world.add(groundLitter);

  // Small arched timber footbridge, across rather than along the river.
  const bridge = new THREE.Group(); bridge.name = 'Textured wooden footbridge'; world.add(bridge);
  bridge.position.set(riverX(3), 0, 3);
  const box = (w, h, d, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), woodMat);
    mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; bridge.add(mesh); return mesh;
  };
  const bridgeY = x => 1.05 + .64 * Math.cos(x / 4.8 * Math.PI / 2);
  for (let i = 0; i < 22; i++) {
    const x = -4.62 + i * .44;
    const plank = box(.42, .17, 2.35, x, bridgeY(x), 0);
    plank.rotation.z = -.64 / 4.8 * Math.PI / 2 * Math.sin(x / 4.8 * Math.PI / 2);
  }
  for (const side of [-1, 1]) {
    for (const x of [-4.4, -2.2, 0, 2.2, 4.4]) box(.15, 1.12, .15, x, bridgeY(x) + .45, side * 1.08);
    for (let i = 0; i < 20; i++) {
      const x = -4.4 + i * .44 + .22;
      const rail = box(.49, .13, .13, x, bridgeY(x) + .99, side * 1.08);
      rail.rotation.z = -.64 / 4.8 * Math.PI / 2 * Math.sin(x / 4.8 * Math.PI / 2);
    }
  }

  const fallingCount = 200;
  const fallGeo = new THREE.PlaneGeometry(.55, .55);
  fallGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(Float32Array.from({ length: fallingCount }, () => rng()), 1));
  const falling = new THREE.InstancedMesh(fallGeo, makeLeafMaterial(textures, shared, true), fallingCount);
  falling.name = 'Textured falling leaves'; falling.frustumCulled = false;
  for (let i = 0; i < fallingCount; i++) {
    const tree = treeSites[i % treeSites.length];
    dummy.position.set(tree[0] + (rng() - .5) * 4, 0, tree[1] + (rng() - .5) * 4);
    dummy.rotation.set(rng() * 6.28, rng() * 6.28, rng() * 6.28); dummy.scale.setScalar(.7 + rng() * .6);
    dummy.updateMatrix(); falling.setMatrixAt(i, dummy.matrix);
  } world.add(falling);
  const snowPos = new Float32Array(650 * 3);
  for (let i = 0; i < snowPos.length; i += 3) { snowPos[i] = (rng() - .5) * 50; snowPos[i + 1] = rng() * 24; snowPos[i + 2] = (rng() - .5) * 50; }
  const snowGeo = new THREE.BufferGeometry(); snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3).setUsage(THREE.DynamicDrawUsage));
  const snowMat = new THREE.PointsMaterial({ map: textures.snow, size: .18, transparent: true, depthWrite: false, opacity: 0, color: '#eef5ff' });
  const snow = new THREE.Points(snowGeo, snowMat); snow.name = 'Textured snow particles'; world.add(snow);

  return {
    world, foliage, blossoms, petals, water, trunks, ground, snow, textures,
    counts: { trees: treeSites.length, cliffs: cliffSites.length, leaves: leaves.length },
    update(dt, time, season) {
      const phase = season.phase;
      const phaseSection = Math.floor(phase);
      const phaseBlend = clamp(phase - phaseSection, 0, 1);
      const litterPalette = [
        new THREE.Color('#f5bfd0'), // spring sakura petals
        new THREE.Color('#7da35b'), // summer leaves
        new THREE.Color('#cc7d2d'), // autumn leaves
        new THREE.Color('#b39d86'), // winter dry leaves
        new THREE.Color('#f5bfd0')
      ];
      const litterColor = litterPalette[phaseSection].clone().lerp(litterPalette[phaseSection + 1], phaseBlend);
      const springCarpet = Math.max(season.spring, season.springPetals * 1.4);
      const autumnCarpet = season.fall;
      const winterCover = season.winter;
      // For the first part of spring, the whole ground should feel strongly pink-covered,
      // similar to how winter visually blankets the terrain in white.
      const earlySpringGround = phase < 1 ? 1 - smoothstep(.26, .84, phase) : 0;
      const springGroundMask = clamp(Math.max(springCarpet * .62, earlySpringGround * 1.18), 0, 1);
      const groundTint = new THREE.Color('#fff7fb')
        .lerp(new THREE.Color('#ef9fbd'), springGroundMask * .98)
        .lerp(new THREE.Color('#f0c98c'), autumnCarpet * .24)
        .lerp(new THREE.Color('#e6edf0'), winterCover * .55);
      groundMat.color.copy(groundTint);
      const grassColor = new THREE.Color('#d9c7d0')
        .lerp(new THREE.Color('#f3adc6'), springGroundMask)
        .lerp(new THREE.Color('#d7a159'), autumnCarpet * .46)
        .lerp(new THREE.Color('#dce4dd'), winterCover);
      grassMat.color.copy(grassColor);
      grassMat.opacity = clamp(1 - springGroundMask * 1.08, winterCover > .82 ? .12 : .015, 1);
      grass.visible = !(springGroundMask > .58) && (season.winter < .96 || springGroundMask > .05 || autumnCarpet > .08);

      // Early spring gets a much stronger pink blanket; later spring fades to lighter patches.
      const baseLitterDensity = 260 + (1 - winterCover) * 150;
      const springBlanketDensity = earlySpringGround * 4300;
      const springLitterDensity = springCarpet * 1350;
      const autumnLitterDensity = autumnCarpet * 1250;
      const winterLitterDensity = winterCover * 260;
      groundLitter.count = Math.min(groundLitterMax, Math.round(baseLitterDensity + springBlanketDensity + springLitterDensity + autumnLitterDensity + winterLitterDensity));
      groundLitter.visible = groundLitter.count > 20;
      litterMat.color.copy(litterColor.clone().lerp(new THREE.Color('#ffcadb'), earlySpringGround * .75));
      litterMat.opacity = clamp(.24 + earlySpringGround * .9 + springCarpet * .34 + autumnCarpet * .32 + winterCover * .1, 0, .995);

      contactMat.opacity = 1 - season.winter * .7;
      falling.visible = season.leafFall > .01;
      blossoms.visible = season.spring > .025;
      blossomMat.opacity = season.spring * .96;
      petals.visible = season.springPetals > .015;
      petalMat.opacity = season.springPetals * .9;
      if (petals.visible) {
        for (let i = 0; i < petalCount; i++) {
          const o = i * 3, seed = petalSeed[i];
          petalPos[o] += (Math.sin(time * .78 + seed * 31.0) * .34 + .13) * dt;
          petalPos[o + 1] -= (.48 + seed * .46) * dt;
          petalPos[o + 2] += Math.cos(time * .62 + seed * 47.0) * .24 * dt;
          if (petalPos[o + 1] < .45) resetPetal(i, true);
        }
        petalGeo.attributes.position.needsUpdate = true;
      }
      snow.visible = season.winter > .12;
      snowMat.opacity = season.winter * .8;
      if (snow.visible) {
        for (let i = 0; i < snowPos.length; i += 3) {
          snowPos[i] += Math.sin(time * .6 + i) * dt * .16;
          snowPos[i + 1] -= dt * (.7 + (i % 5) * .12);
          if (snowPos[i + 1] < .5) snowPos[i + 1] = 24;
        }
        snowGeo.attributes.position.needsUpdate = true;
      }
    }
  };
}
