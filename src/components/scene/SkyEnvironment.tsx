import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useShowStore } from '../../store/useShowStore';

/**
 * Natural sky + daylight. A gradient sky dome, a sun that rises and sets with
 * the time of day, and hemisphere / ambient fill whose strength follows the
 * day / night brightness settings. Show fixtures light the scene on top of this,
 * so a night value keeps the stage dark and lets the rig pop, while day floods
 * the concrete with neutral light for building.
 */

interface Sky {
  sunPos: [number, number, number];
  sunColor: string;
  sunIntensity: number;
  top: THREE.Color;
  bottom: THREE.Color;
  hemiSky: string;
  hemiIntensity: number;
  ambient: number;
  bg: string;
  day: number;
}

/** Derive the whole lighting/colour model from the three sky settings. */
function computeSky(hour: number, dayB: number, nightB: number): Sky {
  const t = ((hour - 6) / 12) * Math.PI; // 0 at 06:00, PI at 18:00
  const elev = Math.sin(t);
  const day = Math.max(0, elev); // 0 at night → 1 at noon
  const horizon = Math.max(0, 1 - Math.abs(elev) * 2.2); // sunrise / sunset warmth

  const dayTop = new THREE.Color(0.24, 0.52, 0.86);
  const dayBot = new THREE.Color(0.72, 0.82, 0.9);
  const nightTop = new THREE.Color(0.015, 0.03, 0.07);
  const nightBot = new THREE.Color(0.03, 0.05, 0.11);
  const sunset = new THREE.Color(0.95, 0.45, 0.22);

  const top = nightTop.clone().lerp(dayTop, day);
  const bottom = nightBot.clone().lerp(dayBot, day);
  bottom.lerp(sunset, horizon * 0.5 * (day > 0 ? 1 : 0.35));

  const sunColor = new THREE.Color(1.0, 0.55, 0.25).lerp(new THREE.Color(1.0, 0.96, 0.9), day);

  return {
    sunPos: [Math.cos(t) * 60, Math.sin(t) * 60 + 3, -25],
    sunColor: `#${sunColor.getHexString()}`,
    sunIntensity: day * dayB * 2.6,
    top,
    bottom,
    hemiSky: `#${top.clone().lerp(new THREE.Color(1, 1, 1), 0.2).getHexString()}`,
    hemiIntensity: day * dayB * 0.55 + (1 - day) * nightB * 0.6,
    ambient: day * dayB * 0.22 + (1 - day) * nightB * 0.55,
    bg: `#${bottom.getHexString()}`,
    day,
  };
}

const VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  uniform vec3 uTop;
  uniform vec3 uBottom;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uSun;
  varying vec3 vDir;
  void main() {
    vec3 dir = normalize(vDir);
    float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 col = mix(uBottom, uTop, pow(h, 0.62));
    float s = max(dot(dir, normalize(uSunDir)), 0.0);
    col += uSunColor * pow(s, 900.0) * uSun * 2.0;   // sun disc
    col += uSunColor * pow(s, 6.0) * uSun * 0.12;    // soft halo
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function SkyEnvironment() {
  const hour = useShowStore((s) => s.project.settings.timeOfDay ?? 13);
  const dayB = useShowStore((s) => s.project.settings.dayBrightness ?? 1);
  const nightB = useShowStore((s) => s.project.settings.nightBrightness ?? 0.12);
  const fog = useShowStore((s) => s.project.settings.fog);
  const workLight = useShowStore((s) => s.workLight);

  const sky = useMemo(() => computeSky(hour, dayB, nightB), [hour, dayB, nightB]);

  const skyMat = useMemo(() => {
    const dir = new THREE.Vector3(...sky.sunPos).normalize();
    return new THREE.ShaderMaterial({
      uniforms: {
        uTop: { value: sky.top },
        uBottom: { value: sky.bottom },
        uSunDir: { value: dir },
        uSunColor: { value: new THREE.Color(sky.sunColor) },
        uSun: { value: sky.day },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
  }, [sky]);
  useEffect(() => () => skyMat.dispose(), [skyMat]);

  const fogDensity = 0.0022 + (1 - sky.day) * 0.004;

  return (
    <group>
      <color attach="background" args={[sky.bg]} />
      {fog && !workLight && <fogExp2 attach="fog" args={[sky.bg, fogDensity]} />}

      {/* Sky dome */}
      <mesh material={skyMat} renderOrder={-1} frustumCulled={false}>
        <sphereGeometry args={[450, 32, 16]} />
      </mesh>

      {/* Natural lighting */}
      <ambientLight intensity={sky.ambient} color={sky.hemiSky} />
      <hemisphereLight args={[sky.hemiSky, '#3a3d42', sky.hemiIntensity]} />
      <directionalLight position={sky.sunPos} intensity={sky.sunIntensity} color={sky.sunColor} />
    </group>
  );
}
