import THREE from './three.js';
import { noise2 } from './math.js';

/**
 * Procedural sky dome.
 * A CanvasTexture supplies soft cloud noise and a custom shader blends
 * horizon/zenith colors plus a sun glow. The dome follows the camera so it
 * always behaves like a distant atmosphere rather than a nearby sphere.
 */
export function createSkyDome(scene, sunDirection) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable for the sky texture.');

  const image = ctx.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      // Several low-frequency octaves create soft, non-repeating cloud masses.
      const nx = x / canvas.width * 7.5;
      const ny = y / canvas.height * 4.0;
      const n = noise2(nx, ny) * 0.52
        + noise2(nx * 2.1 + 11.0, ny * 2.1 + 7.0) * 0.30
        + noise2(nx * 4.3 + 3.0, ny * 4.3 + 17.0) * 0.18;
      const value = Math.max(0, Math.min(255, Math.round(n * 255)));
      const i = (y * canvas.width + x) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  const cloudMap = new THREE.CanvasTexture(canvas);
  cloudMap.name = 'Procedural sky cloud texture';
  cloudMap.colorSpace = THREE.NoColorSpace;
  cloudMap.wrapS = THREE.RepeatWrapping;
  cloudMap.wrapT = THREE.ClampToEdgeWrapping;
  cloudMap.minFilter = THREE.LinearMipmapLinearFilter;
  cloudMap.magFilter = THREE.LinearFilter;

  const uniforms = {
    uCloudMap: { value: cloudMap },
    uTime: { value: 0 },
    uTopColor: { value: new THREE.Color('#4f91d8') },
    uHorizonColor: { value: new THREE.Color('#dfeff6') },
    uCloudColor: { value: new THREE.Color('#ffffff') },
    uSunColor: { value: new THREE.Color('#fff0c0') },
    uSunDirection: { value: sunDirection.clone().normalize() }
  };

  const material = new THREE.ShaderMaterial({
    name: 'Procedural textured atmospheric sky',
    uniforms,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vDirection;
      void main() {
        vUv = uv;
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D uCloudMap;
      uniform float uTime;
      uniform vec3 uTopColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uCloudColor;
      uniform vec3 uSunColor;
      uniform vec3 uSunDirection;
      varying vec2 vUv;
      varying vec3 vDirection;

      void main() {
        vec3 dir = normalize(vDirection);
        float height01 = dir.y * 0.5 + 0.5;
        float zenithMix = smoothstep(0.50, 0.97, height01);
        vec3 color = mix(uHorizonColor, uTopColor, zenithMix);

        // Slowly drift the sampled cloud texture around the dome.
        vec2 cloudUv = vec2(fract(vUv.x + uTime * 0.0013), vUv.y);
        float cloudNoise = texture2D(uCloudMap, cloudUv).r;
        float cloudBand = smoothstep(0.49, 0.59, height01)
          * (1.0 - smoothstep(0.84, 0.98, height01));
        float cloud = smoothstep(0.56, 0.76, cloudNoise) * cloudBand * 0.58;
        color = mix(color, uCloudColor, cloud);

        // A broad halo plus a small bright core creates a readable sun glow.
        float sunDot = max(dot(dir, normalize(uSunDirection)), 0.0);
        float sunHalo = pow(sunDot, 18.0) * 0.28;
        float sunCore = pow(sunDot, 260.0) * 0.85;
        color += uSunColor * (sunHalo + sunCore);

        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false
  });

  const sky = new THREE.Mesh(new THREE.SphereGeometry(220, 64, 32), material);
  sky.name = 'Textured procedural sky dome';
  sky.frustumCulled = false;
  sky.renderOrder = -1000;
  scene.add(sky);

  return {
    mesh: sky,
    material,
    cloudMap,
    setPreset(preset) {
      uniforms.uTopColor.value.set(preset.skyTop);
      uniforms.uHorizonColor.value.set(preset.skyHorizon);
      uniforms.uCloudColor.value.set(preset.skyCloud);
      uniforms.uSunColor.value.set(preset.skySun);
    },
    update(camera, time) {
      sky.position.copy(camera.position);
      uniforms.uTime.value = time;
    }
  };
}
