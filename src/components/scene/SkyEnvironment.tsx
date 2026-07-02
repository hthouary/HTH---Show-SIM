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
  moonPos: [number, number, number];
  sunColor: string;
  sunIntensity: number;
  top: THREE.Color;
  bottom: THREE.Color;
  hemiSky: string;
  hemiIntensity: number;
  ambient: number;
  bg: string;
  day: number;
  night: number;
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
    moonPos: [-Math.cos(t) * 60, -Math.sin(t) * 60 + 3, -25],
    sunColor: `#${sunColor.getHexString()}`,
    sunIntensity: day * dayB * 2.6,
    top,
    bottom,
    hemiSky: `#${top.clone().lerp(new THREE.Color(1, 1, 1), 0.2).getHexString()}`,
    hemiIntensity: day * dayB * 0.55 + (1 - day) * nightB * 0.6,
    ambient: day * dayB * 0.22 + (1 - day) * nightB * 0.55,
    bg: `#${bottom.getHexString()}`,
    day,
    night: Math.max(0, 1 - day * 3), // fully 1 once the sun is well down
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

/** Random star field on the upper sky dome (positions built once). */
function buildStars(count: number, radius: number): Float32Array {
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    let x = 0;
    let y = 0;
    let z = 0;
    let d = 0;
    do {
      x = Math.random() * 2 - 1;
      y = Math.random();
      z = Math.random() * 2 - 1;
      d = Math.hypot(x, y, z);
    } while (d > 1 || d < 0.01 || y / d < 0.06);
    arr[i * 3] = (x / d) * radius;
    arr[i * 3 + 1] = (y / d) * radius;
    arr[i * 3 + 2] = (z / d) * radius;
  }
  return arr;
}

export function SkyEnvironment() {
  const hour = useShowStore((s) => s.project.settings.timeOfDay ?? 13);
  const dayB = useShowStore((s) => s.project.settings.dayBrightness ?? 1);
  const nightB = useShowStore((s) => s.project.settings.nightBrightness ?? 0.12);
  const fog = useShowStore((s) => s.project.settings.fog);
  const workLight = useShowStore((s) => s.workLight);
  const high = useShowStore((s) => s.quality === 'high');

  const sky = useMemo(() => computeSky(hour, dayB, nightB), [hour, dayB, nightB]);

  const starGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(buildStars(550, 430), 3));
    return g;
  }, []);
  useEffect(() => () => starGeo.dispose(), [starGeo]);

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

      {/* Stars + moon fade in at night */}
      {sky.night > 0.02 && (
        <>
          <points geometry={starGeo} frustumCulled={false}>
            <pointsMaterial
              size={1.7}
              sizeAttenuation={false}
              color="#e5edff"
              transparent
              opacity={sky.night * 0.9}
              depthWrite={false}
              fog={false}
            />
          </points>
          <mesh position={sky.moonPos} frustumCulled={false}>
            <sphereGeometry args={[3.2, 16, 16]} />
            <meshBasicMaterial color="#e9eff8" transparent opacity={sky.night} fog={false} toneMapped={false} />
          </mesh>
        </>
      )}

      {/* Natural lighting */}
      <ambientLight intensity={sky.ambient} color={sky.hemiSky} />
      <hemisphereLight args={[sky.hemiSky, '#3a3d42', sky.hemiIntensity]} />
      {/* Sun — casts real shadows during the day (High quality). */}
      <directionalLight
        position={sky.sunPos}
        intensity={sky.sunIntensity}
        color={sky.sunColor}
        castShadow={high && sky.day > 0.03}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
        shadow-camera-near={1}
        shadow-camera-far={220}
        shadow-bias={-0.0004}
      />
      {/* Cool moonlight so the night isn't pitch black. */}
      <directionalLight position={sky.moonPos} intensity={sky.night * nightB * 1.1} color="#9fb4d8" />
    </group>
  );
}
