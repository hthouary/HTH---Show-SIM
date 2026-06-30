import * as THREE from 'three';

/**
 * Volumetric beam material for light fixtures. A hollow cone is shaded with:
 *  - a Fresnel term so the beam glows brightest at its silhouette edges and is
 *    hollow in the middle (the classic "shaft of light in haze" look), and
 *  - a length attenuation so the beam is bright at the lens and dissolves into
 *    the distance instead of ending in a hard, glassy cone.
 */
const VERT = /* glsl */ `
  uniform float uLength;
  varying float vT;
  varying vec3 vViewNormal;
  varying vec3 vViewPos;
  void main() {
    vT = clamp(-position.y / uLength, 0.0, 1.0);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    vViewNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vT;
  varying vec3 vViewNormal;
  varying vec3 vViewPos;
  void main() {
    vec3 V = normalize(-vViewPos);
    float fres = 1.0 - abs(dot(V, normalize(vViewNormal)));
    fres = pow(fres, 1.7);
    // Bright near the lens, fading into the distance (atmospheric falloff).
    float lengthFade = pow(1.0 - vT, 1.5);
    lengthFade *= smoothstep(0.0, 0.05, vT); // soften the apex hotspot
    float a = uOpacity * (fres * 0.85 + 0.15) * lengthFade;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

export function makeBeamMaterial(length: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color('#ffffff') },
      uOpacity: { value: 0 },
      uLength: { value: length },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}
