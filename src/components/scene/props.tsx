import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SceneObject } from '../../types/show';
import { useShowStore } from '../../store/useShowStore';
import { audioEngine } from '../../utils/audio';
import { ignoreRaycast } from './interaction';

/**
 * Static stage hardware — trusses, towers, PA, deck, DJ booth, crowd — plus the
 * physical bodies for the FX machines. Built entirely from primitives (no
 * external assets) and styled to read like real touring gear: dark powder-coat
 * metal, colored accents and emissive detailing.
 */

// --------------------------------------------------------------- Truss lattice

const _m = new THREE.Matrix4();
const _e = new THREE.Euler();

/** Push a single strut (a thin box, length along local X) into `parts`. */
function strut(parts: THREE.BufferGeometry[], len: number, thick: number, x: number, y: number, z: number, rx: number, ry: number, rz: number) {
  const g = new THREE.BoxGeometry(len, thick, thick);
  _e.set(rx, ry, rz);
  _m.makeRotationFromEuler(_e);
  _m.setPosition(x, y, z);
  g.applyMatrix4(_m);
  parts.push(g);
}

/**
 * Build one merged box-truss geometry (4 chords + rung frames + zig-zag web),
 * centred on the origin and running along local X. Merging keeps a whole truss
 * at a single draw call, so towers/arches with lots of struts stay cheap.
 */
function buildTrussGeometry(length: number, size = 0.34, thick = 0.05): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const s = size / 2;
  const half = length / 2;
  const cells = Math.max(2, Math.round(length / (size * 2.6)));
  const step = length / cells;
  const diagLen = Math.hypot(step, size);
  const ang = Math.atan2(size, step);

  // Four main chords running the length.
  for (const [y, z] of [[s, s], [s, -s], [-s, s], [-s, -s]]) strut(parts, length, thick, 0, y, z, 0, 0, 0);

  // Square rung frames at every node.
  for (let k = 0; k <= cells; k++) {
    const x = -half + k * step;
    strut(parts, size, thick, x, s, 0, 0, Math.PI / 2, 0);
    strut(parts, size, thick, x, -s, 0, 0, Math.PI / 2, 0);
    strut(parts, size, thick, x, 0, s, 0, 0, Math.PI / 2);
    strut(parts, size, thick, x, 0, -s, 0, 0, Math.PI / 2);
  }

  // Zig-zag diagonal web on all four faces.
  for (let k = 0; k < cells; k++) {
    const xc = -half + (k + 0.5) * step;
    const dir = k % 2 === 0 ? 1 : -1;
    strut(parts, diagLen, thick * 0.8, xc, 0, s, 0, 0, dir * ang);
    strut(parts, diagLen, thick * 0.8, xc, 0, -s, 0, 0, -dir * ang);
    strut(parts, diagLen, thick * 0.8, xc, s, 0, 0, dir * ang, 0);
    strut(parts, diagLen, thick * 0.8, xc, -s, 0, 0, -dir * ang, 0);
  }

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged ?? new THREE.BufferGeometry();
}

/** A single length of box truss (centred on the origin, along local X). */
function BoxTruss({ length, color, size = 0.34 }: { length: number; color: string; size?: number }) {
  const geo = useMemo(() => buildTrussGeometry(length, size), [length, size]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, metalness: 0.86, roughness: 0.32 }), [color]);
  useEffect(() => () => {
    geo.dispose();
    mat.dispose();
  }, [geo, mat]);
  return <mesh geometry={geo} material={mat} />;
}

const PLATE = <meshStandardMaterial color="#0c0e14" metalness={0.5} roughness={0.6} />;

/** Overhead horizontal truss beam. */
export function Truss({ object }: { object: SceneObject }) {
  return <BoxTruss length={15} color={object.color} />;
}

/** Ground-supported vertical truss column with base + top plate. */
export function TrussTower({ object }: { object: SceneObject }) {
  const H = 5;
  return (
    <group>
      <group rotation={[0, 0, Math.PI / 2]}>
        <BoxTruss length={H} color={object.color} />
      </group>
      <mesh position={[0, -H / 2 + 0.03, 0]}>
        <boxGeometry args={[0.72, 0.06, 0.72]} />
        {PLATE}
      </mesh>
      <mesh position={[0, H / 2 - 0.02, 0]}>
        <boxGeometry args={[0.55, 0.05, 0.55]} />
        {PLATE}
      </mesh>
    </group>
  );
}

/** Goalpost arch: two vertical legs bridged by a horizontal top beam. */
export function TrussArch({ object }: { object: SceneObject }) {
  const legH = 4.6;
  const spanX = 3.4;
  const topY = 2.25;
  const corner = useMemo(() => new THREE.MeshStandardMaterial({ color: object.color, metalness: 0.86, roughness: 0.32 }), [object.color]);
  useEffect(() => () => corner.dispose(), [corner]);
  return (
    <group>
      {[-spanX, spanX].map((x, i) => (
        <group key={i} position={[x, -2.6 + legH / 2, 0]}>
          <group rotation={[0, 0, Math.PI / 2]}>
            <BoxTruss length={legH} color={object.color} />
          </group>
          <mesh position={[0, -legH / 2 + 0.03, 0]}>
            <boxGeometry args={[0.72, 0.06, 0.72]} />
            {PLATE}
          </mesh>
        </group>
      ))}
      <group position={[0, topY, 0]}>
        <BoxTruss length={spanX * 2 + 0.34} color={object.color} />
      </group>
      {[-spanX, spanX].map((x, i) => (
        <mesh key={i} position={[x, topY - 0.15, 0]} material={corner}>
          <boxGeometry args={[0.4, 0.5, 0.4]} />
        </mesh>
      ))}
    </group>
  );
}

/** Raised stage deck with skirt and a glowing edge strip. */
export function StagePlatform({ object }: { object: SceneObject }) {
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[14, 0.5, 8]} />
        <meshStandardMaterial color={object.color} metalness={0.25} roughness={0.75} />
      </mesh>
      {/* Matte deck surface */}
      <mesh position={[0, 0.26, 0]}>
        <boxGeometry args={[14, 0.04, 8]} />
        <meshStandardMaterial color="#0c0e14" metalness={0.1} roughness={0.95} />
      </mesh>
      {/* Dark skirt band around the base */}
      <mesh position={[0, -0.18, 0]}>
        <boxGeometry args={[14.1, 0.2, 8.1]} />
        <meshStandardMaterial color="#05060a" metalness={0.2} roughness={0.9} />
      </mesh>
      {/* Glowing front edge strip */}
      <mesh position={[0, 0.1, 4.03]}>
        <boxGeometry args={[14, 0.06, 0.05]} />
        <meshBasicMaterial color="#22d3ee" toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Flown PA line-array: stacked cabinets with a slight downward splay. */
export function Speaker({ object }: { object: SceneObject }) {
  const cab = useMemo(() => new THREE.MeshStandardMaterial({ color: object.color, metalness: 0.35, roughness: 0.6 }), [object.color]);
  const cone = useMemo(() => new THREE.MeshStandardMaterial({ color: '#05060a', metalness: 0.2, roughness: 0.5 }), []);
  useEffect(() => () => {
    cab.dispose();
    cone.dispose();
  }, [cab, cone]);
  return (
    <group>
      {/* Fly bar */}
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[1.3, 0.08, 0.9]} />
        {PLATE}
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const y = 1.12 - i * 0.72;
        return (
          <group key={i} position={[0, y, 0]} rotation={[i * 0.05, 0, 0]}>
            <mesh material={cab}>
              <boxGeometry args={[1.25, 0.6, 0.95]} />
            </mesh>
            {/* Twin drivers + horn slot on the front baffle */}
            <mesh position={[-0.32, 0.06, 0.48]} material={cone}>
              <circleGeometry args={[0.17, 20]} />
            </mesh>
            <mesh position={[0.32, 0.06, 0.48]} material={cone}>
              <circleGeometry args={[0.17, 20]} />
            </mesh>
            <mesh position={[0, -0.18, 0.48]}>
              <boxGeometry args={[0.95, 0.12, 0.02]} />
              <meshStandardMaterial color="#111419" roughness={0.6} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** DJ booth with decks + mixer and a faintly glowing facade. */
export function DjBooth({ object }: { object: SceneObject }) {
  return (
    <group>
      <mesh>
        <boxGeometry args={[3.2, 1.4, 1.4]} />
        <meshStandardMaterial color={object.color} metalness={0.3} roughness={0.7} />
      </mesh>
      {/* Glowing facade panel */}
      <mesh position={[0, 0.1, 0.71]}>
        <planeGeometry args={[3, 1]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.16} toneMapped={false} />
      </mesh>
      {/* Booth top surface */}
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[3.4, 0.1, 1.6]} />
        <meshStandardMaterial color="#05060a" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* Two CDJ decks + a mixer between them */}
      {[-1, 1].map((x) => (
        <mesh key={x} position={[x, 0.83, 0.1]}>
          <boxGeometry args={[0.9, 0.08, 0.7]} />
          <meshStandardMaterial color="#15181f" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 0.83, 0.1]}>
        <boxGeometry args={[0.7, 0.08, 0.7]} />
        <meshStandardMaterial color="#0c0e14" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.88, 0.1]}>
        <planeGeometry args={[0.55, 0.5]} />
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.4} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------- Crowd

const CROWD_COLS = 30;
const CROWD_ROWS = 12;
const CROWD_TOTAL = CROWD_COLS * CROWD_ROWS;
/** Varied dark "clothing" tones so the crowd doesn't read as a uniform mass. */
const CLOTHES = ['#22242c', '#2b2e38', '#3a2e2e', '#26323a', '#332b3d', '#1f2a24', '#3d3d46', '#402f26', '#2e2431', '#24303c'];
const SKIN = ['#c9976f', '#a97c53', '#8a5f3d', '#6b452c', '#e0b48f', '#553524'];

interface Person {
  x: number;
  z: number;
  h: number;
  phase: number;
  energy: number;
  wide: number;
  cloth: string;
  skin: string;
  armUp: boolean;
  side: 1 | -1;
  phone: boolean;
  rotY: number;
}

/**
 * Audience — instanced people (torso + head, a share of them with a raised arm
 * holding a glowing phone). They sway idly and jump to the music while the show
 * plays; phone screens only really read at night, like at a real gig.
 */
export function CrowdBlock({ object }: { object: SceneObject }) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const armRef = useRef<THREE.InstancedMesh>(null);
  const phoneRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const phoneMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#cfe0ff', toneMapped: false, transparent: true, opacity: 1, side: THREE.DoubleSide }),
    [],
  );
  const armGeo = useMemo(() => {
    const g = new THREE.CapsuleGeometry(0.042, 0.5, 3, 6);
    g.translate(0, 0.29, 0); // pivot at the shoulder
    return g;
  }, []);
  useEffect(() => () => {
    phoneMat.dispose();
    armGeo.dispose();
  }, [phoneMat, armGeo]);

  const people = useMemo<Person[]>(() => {
    const arr: Person[] = [];
    for (let r = 0; r < CROWD_ROWS; r++) {
      for (let c = 0; c < CROWD_COLS; c++) {
        const armUp = Math.random() < 0.32;
        arr.push({
          x: (c - CROWD_COLS / 2) * 0.8 + (Math.random() - 0.5) * 0.45,
          z: r * 0.8 + (Math.random() - 0.5) * 0.4,
          h: 1.45 + Math.random() * 0.35,
          phase: Math.random() * Math.PI * 2,
          energy: 0.35 + Math.random() * 0.65,
          wide: 0.88 + Math.random() * 0.28,
          cloth: CLOTHES[Math.floor(Math.random() * CLOTHES.length)],
          skin: SKIN[Math.floor(Math.random() * SKIN.length)],
          armUp,
          side: Math.random() < 0.5 ? 1 : -1,
          phone: armUp && Math.random() < 0.7,
          rotY: Math.random() * Math.PI * 2,
        });
      }
    }
    return arr;
  }, []);
  const arms = useMemo(() => people.filter((p) => p.armUp), [people]);
  const phones = useMemo(() => arms.filter((p) => p.phone), [arms]);

  // Per-person clothing / skin colours (set once).
  useEffect(() => {
    const c = new THREE.Color();
    people.forEach((p, i) => {
      c.set(p.cloth);
      bodyRef.current?.setColorAt(i, c);
      c.set(p.skin);
      headRef.current?.setColorAt(i, c);
    });
    arms.forEach((p, i) => {
      c.set(p.cloth);
      armRef.current?.setColorAt(i, c);
    });
    for (const ref of [bodyRef, headRef, armRef]) {
      if (ref.current?.instanceColor) ref.current.instanceColor.needsUpdate = true;
    }
  }, [people, arms]);

  useFrame(({ clock }) => {
    if (!bodyRef.current || !headRef.current) return;
    const t = clock.elapsedTime;
    const st = useShowStore.getState();
    const playing = st.isPlaying;
    const level = audioEngine.level;
    // Phones read at night; almost invisible in daylight (like reality).
    const hour = st.project.settings.timeOfDay ?? 13;
    const day = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
    phoneMat.opacity = 0.22 + (1 - day) * 0.78;
    // Idle sway; the pit jumps when the show is playing (more with the music).
    const amp = 0.045 + (playing ? 0.11 + level * 0.22 : 0);

    let ai = 0;
    let pi = 0;
    for (let i = 0; i < CROWD_TOTAL; i++) {
      const p = people[i];
      const bob = Math.abs(Math.sin(t * 3.1 * p.energy + p.phase)) * amp * p.energy;
      const sway = Math.sin(t * 0.9 + p.phase) * 0.03;
      const bodyH = p.h - 0.24;
      const x = p.x + sway;

      // Torso
      dummy.rotation.set(0, p.rotY * 0.06, 0);
      dummy.position.set(x, bodyH / 2 + bob, p.z);
      dummy.scale.set(p.wide, bodyH / 1.28, p.wide);
      dummy.updateMatrix();
      bodyRef.current.setMatrixAt(i, dummy.matrix);

      // Head
      dummy.rotation.set(0, 0, 0);
      dummy.position.set(x, bodyH + 0.12 + bob, p.z);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      headRef.current.setMatrixAt(i, dummy.matrix);

      // Raised arm (+ phone at its tip)
      if (p.armUp && armRef.current) {
        const shoulderY = p.h * 0.72 + bob;
        const theta = p.side * (0.32 + Math.sin(t * 1.15 + p.phase) * 0.13);
        dummy.position.set(x + p.side * 0.2 * p.wide, shoulderY, p.z);
        dummy.rotation.set(0, 0, theta);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        armRef.current.setMatrixAt(ai, dummy.matrix);
        ai++;
        if (p.phone && phoneRef.current) {
          dummy.position.set(x + p.side * 0.2 * p.wide - Math.sin(theta) * 0.62, shoulderY + Math.cos(theta) * 0.62, p.z);
          dummy.rotation.set(0, p.rotY, theta);
          dummy.updateMatrix();
          phoneRef.current.setMatrixAt(pi, dummy.matrix);
          pi++;
        }
      }
    }
    bodyRef.current.instanceMatrix.needsUpdate = true;
    headRef.current.instanceMatrix.needsUpdate = true;
    if (armRef.current) armRef.current.instanceMatrix.needsUpdate = true;
    if (phoneRef.current) phoneRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* Torsos — the clickable body of the crowd. */}
      <instancedMesh ref={bodyRef} args={[undefined, undefined, CROWD_TOTAL]} frustumCulled={false} castShadow>
        <capsuleGeometry args={[0.21, 0.86, 4, 8]} />
        <meshStandardMaterial color="#ffffff" roughness={0.92} metalness={0} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, CROWD_TOTAL]} frustumCulled={false} raycast={ignoreRaycast}>
        <sphereGeometry args={[0.105, 10, 8]} />
        <meshStandardMaterial color="#ffffff" roughness={0.85} metalness={0} />
      </instancedMesh>
      <instancedMesh ref={armRef} args={[armGeo, undefined, arms.length]} frustumCulled={false} raycast={ignoreRaycast}>
        <meshStandardMaterial color="#ffffff" roughness={0.92} metalness={0} />
      </instancedMesh>
      {/* Phone screens (bright, tone-mapping bypassed → they glow at night). */}
      <instancedMesh ref={phoneRef} args={[undefined, phoneMat, phones.length]} frustumCulled={false} raycast={ignoreRaycast}>
        <planeGeometry args={[0.07, 0.13]} />
      </instancedMesh>
      {/* Keep the object's colour relevant: a faint tinted ground disc under the crowd. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, CROWD_ROWS * 0.4]} raycast={ignoreRaycast}>
        <planeGeometry args={[CROWD_COLS * 0.85, CROWD_ROWS * 0.9]} />
        <meshStandardMaterial color={object.color} transparent opacity={0.25} roughness={1} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------- FX machines

/** Two posts + a bar — a carry handle used on the FX machine bodies. */
function Handle({ y, w = 0.44 }: { y: number; w?: number }) {
  return (
    <group>
      <mesh position={[-w / 2, y - 0.06, 0]}>
        <boxGeometry args={[0.03, 0.14, 0.03]} />
        {PLATE}
      </mesh>
      <mesh position={[w / 2, y - 0.06, 0]}>
        <boxGeometry args={[0.03, 0.14, 0.03]} />
        {PLATE}
      </mesh>
      <mesh position={[0, y, 0]}>
        <boxGeometry args={[w, 0.03, 0.03]} />
        {PLATE}
      </mesh>
    </group>
  );
}

/** Low, wide hazer/fogger with a front nozzle and a colored status strip. */
export function SmokeMachineBody({ color }: { color: string }) {
  return (
    <group>
      <mesh>
        <boxGeometry args={[0.86, 0.4, 0.56]} />
        <meshStandardMaterial color="#171a22" metalness={0.55} roughness={0.5} />
      </mesh>
      {/* Front barrel nozzle */}
      <mesh position={[0, 0, 0.32]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.15, 0.16, 20]} />
        <meshStandardMaterial color="#0a0c12" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0.41]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.1, 20]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} toneMapped={false} />
      </mesh>
      {/* Status strip */}
      <mesh position={[0, 0.05, 0.285]}>
        <planeGeometry args={[0.5, 0.05]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} toneMapped={false} />
      </mesh>
      <Handle y={0.34} />
    </group>
  );
}

/** Upright flame-projector canister with a base plate and top nozzle. */
export function FlameJetBody({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, -0.3, 0]}>
        <cylinderGeometry args={[0.24, 0.26, 0.06, 22]} />
        {PLATE}
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.16, 0.17, 0.5, 24]} />
        <meshStandardMaterial color="#1a1d26" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.172, 0.172, 0.06, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.32, 0]}>
        <cylinderGeometry args={[0.05, 0.1, 0.16, 16]} />
        <meshStandardMaterial color="#0a0c12" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}

/** Cryo/CO2 jet: a tall bottle with a valve head and an upward nozzle. */
export function Co2JetBody({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, -0.35, 0]}>
        <cylinderGeometry args={[0.2, 0.22, 0.06, 22]} />
        {PLATE}
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.14, 0.15, 0.62, 24]} />
        <meshStandardMaterial color="#20242e" metalness={0.55} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.151, 0.151, 0.05, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} toneMapped={false} />
      </mesh>
      {/* Valve head + nozzle */}
      <mesh position={[0, 0.36, 0]}>
        <cylinderGeometry args={[0.09, 0.11, 0.12, 16]} />
        <meshStandardMaterial color="#0a0c12" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.46, 0.02]} rotation={[0.2, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.05, 0.12, 14]} />
        <meshStandardMaterial color="#0a0c12" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}

/** Confetti blower: a stand base and a big upward-angled launch tube. */
export function ConfettiCannonBody({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, -0.38, 0]}>
        <cylinderGeometry args={[0.28, 0.3, 0.08, 20]} />
        {PLATE}
      </mesh>
      {/* Blower housing */}
      <mesh position={[0, -0.18, -0.02]}>
        <boxGeometry args={[0.4, 0.34, 0.42]} />
        <meshStandardMaterial color="#171a22" metalness={0.55} roughness={0.5} />
      </mesh>
      {/* Upward-angled launch tube */}
      <group rotation={[-0.32, 0, 0]}>
        <mesh position={[0, 0.18, 0.06]}>
          <cylinderGeometry args={[0.16, 0.2, 0.6, 22, 1, true]} />
          <meshStandardMaterial color="#0c0e14" metalness={0.6} roughness={0.4} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.47, 0.06]}>
          <torusGeometry args={[0.16, 0.02, 10, 22]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
