import THREE from './three.js';

/** A genuine custom GLSL vertex program: instancing, wind and leaf-fall motion. */
export const LEAF_VERTEX = /* glsl */`
attribute float aSeed;
uniform float uTime;
varying vec2 vUv;
varying float vSeed;
varying vec3 vNormal;
varying float vDepth;
void main() {
  vUv = uv; vSeed = aSeed;
  vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
  #ifdef FALLING
    float travel = mod(uTime * (0.72 + aSeed * 0.55) + aSeed * 18.0, 17.0);
    world.y = 17.3 - travel;
    world.x += sin(uTime * 0.83 + aSeed * 91.0) * 1.4;
    world.z += cos(uTime * 0.65 + aSeed * 43.0) * 0.8;
  #else
    float sway = sin(uTime * 1.7 + world.x * 0.38 + world.z * 0.23 + aSeed * 6.28);
    world.x += sway * 0.12 * smoothstep(1.0, 8.0, world.y);
    world.z += cos(uTime * 1.1 + world.x * 0.2) * 0.06;
  #endif
  // Instance scales are uniform, so normalization suffices for these leaf normals.
  vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vec4 view = viewMatrix * world;
  vDepth = -view.z;
  gl_Position = projectionMatrix * view;
}
`;

/** Texture sampling + continuous four-season color interpolation + diffuse lighting. */
export const LEAF_FRAGMENT = /* glsl */`
uniform sampler2D uLeafMap;
uniform float uSeason;
uniform float uCoverage;
uniform float uFall;
uniform vec3 uSpring;
uniform vec3 uSummer;
uniform vec3 uAutumn;
uniform vec3 uWinterColor;
uniform vec3 uLightColor;
uniform vec3 uLightDirection;
uniform vec3 uFogColor;
varying vec2 vUv;
varying float vSeed;
varying vec3 vNormal;
varying float vDepth;
void main() {
  vec4 texel = texture2D(uLeafMap, vUv);
  if (texel.a < 0.36) discard;
  #ifdef FALLING
    if (vSeed > uFall) discard;
  #else
    if (vSeed > uCoverage) discard;
  #endif
  float phase = mod(uSeason, 4.0);
  float t = smoothstep(0.0, 1.0, fract(phase));
  vec3 autumn = mix(uAutumn * vec3(1.0, 0.42, 0.36), uAutumn * vec3(1.2, 1.17, 0.65), vSeed);
  // Spring is Sakura season: varied pale/deep pink canopy, held through mid-spring.
  vec3 sakura = mix(uSpring * vec3(1.08, 1.04, 1.06), uSpring * vec3(0.93, 0.67, 0.80), vSeed);
  vec3 pigment;
  if (phase < 1.0) {
    float springToSummer = smoothstep(0.52, 1.0, phase);
    pigment = mix(sakura, uSummer, springToSummer);
  }
  else if (phase < 2.0) pigment = mix(uSummer, autumn, t);
  else if (phase < 3.0) pigment = mix(autumn, uWinterColor, t);
  else pigment = mix(uWinterColor, sakura, smoothstep(0.28, 1.0, t));
  #ifdef FALLING
    // Falling foliage keeps the current season pigment instead of being forced to autumn.
    // Spring -> Sakura pink, Summer -> green, Autumn -> amber/red/gold, Winter -> dry brown.
  #endif
  // Two-sided foliage: wrap lighting approximates light passing through a thin leaf.
  vec3 N = normalize(vNormal);
  float diffuse = abs(dot(N, normalize(uLightDirection)));
  vec3 lighting = vec3(0.44, 0.48, 0.39) + uLightColor * (0.38 + diffuse * 0.67);
  vec3 color = texel.rgb * pigment * lighting * mix(0.84, 1.15, vSeed);
  color = mix(color, uFogColor, smoothstep(78.0, 155.0, vDepth));
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const WATER_VERTEX = /* glsl */`
uniform float uTime;
varying vec2 vUv;
varying vec3 vWorld;
varying float vDepth;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  world.y += sin(world.z * 1.4 + uTime * 1.6) * 0.025
    + cos(world.x * 2.7 + uTime) * 0.012;
  vWorld = world.xyz;
  vec4 view = viewMatrix * world;
  vDepth = -view.z;
  gl_Position = projectionMatrix * view;
}
`;
export const WATER_FRAGMENT = /* glsl */`
uniform sampler2D uMap;
uniform float uTime;
uniform float uWinter;
uniform vec3 uLightColor;
uniform vec3 uFogColor;
varying vec2 vUv;
varying vec3 vWorld;
varying float vDepth;
void main() {
  float n1 = texture2D(uMap, vec2(vUv.x * 2.0, vUv.y * 10.0 - uTime * 0.028)).r;
  float n2 = texture2D(uMap, vec2(vUv.x * 3.0 + uTime * 0.018, vUv.y * 14.0)).r;
  vec3 deep = vec3(0.035, 0.19, 0.18);
  vec3 shallow = vec3(0.14, 0.43, 0.35);
  float edge = smoothstep(0.26, 0.49, abs(vUv.x - 0.5));
  vec3 color = mix(deep, shallow, edge * 0.8 + n1 * 0.25);
  float ripple = pow(max(0.0, sin(vWorld.z * 5.0 + n1 * 9.0 - uTime * 2.3)), 18.0);
  color += vec3(0.30, 0.39, 0.31) * ripple * n2 * 0.26;
  color += edge * smoothstep(0.56, 0.76, n2) * vec3(0.40, 0.47, 0.37);
  color = mix(color, vec3(0.38, 0.56, 0.60) + n1 * 0.15, uWinter * 0.72);
  color *= vec3(0.53) + uLightColor * 0.62;
  color = mix(color, uFogColor, smoothstep(78.0, 155.0, vDepth));
  gl_FragColor = vec4(color, 0.96);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function makeLeafMaterial(textures, shared, falling = false) {
  return new THREE.ShaderMaterial({
    name: falling ? 'Custom seasonal leaf-fall GLSL' : 'Custom seasonal foliage GLSL',
    uniforms: {
      uLeafMap: { value: textures.leaf },
      uTime: shared.time, uSeason: shared.season, uCoverage: shared.coverage,
      uFall: shared.leafFall, uLightColor: shared.lightColor,
      uLightDirection: shared.lightDirection, uFogColor: shared.fogColor,
      uSpring: { value: new THREE.Color('#f6b6c8') },
      uSummer: { value: new THREE.Color('#528a42') },
      uAutumn: { value: new THREE.Color('#d99837') },
      uWinterColor: { value: new THREE.Color('#99754d') }
    },
    vertexShader: LEAF_VERTEX, fragmentShader: LEAF_FRAGMENT,
    defines: falling ? { FALLING: 1 } : {}, side: THREE.DoubleSide
  });
}
export function makeWaterMaterial(textures, shared) {
  return new THREE.ShaderMaterial({
    name: 'Custom textured river GLSL',
    uniforms: { uMap: { value: textures.noise }, uTime: shared.time,
      uWinter: shared.winter, uLightColor: shared.lightColor, uFogColor: shared.fogColor },
    vertexShader: WATER_VERTEX, fragmentShader: WATER_FRAGMENT,
    transparent: true, side: THREE.DoubleSide
  });
}

/** Keep Three.js PBR lighting/shadows, but blend snow into the sampled surface. */
export function addSnowToMaterial(material, winterUniform, strength = 1) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uSnow = winterUniform;
    shader.vertexShader = 'varying vec3 vSnowNormal;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvSnowNormal = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = 'uniform float uSnow;\nvarying vec3 vSnowNormal;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
      `#include <map_fragment>\nfloat snowMask = smoothstep(0.12, 0.82, normalize(vSnowNormal).y);\nfloat grain = dot(diffuseColor.rgb, vec3(0.3, 0.5, 0.2));\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.86, 0.90) * (0.86 + grain * 0.22), uSnow * snowMask * ${strength.toFixed(2)});`);
  };
  material.customProgramCacheKey = () => `forest-snow-${strength}`;
  return material;
}
