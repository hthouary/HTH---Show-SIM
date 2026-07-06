import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SceneObject } from '../../types/show';
import { useShowStore } from '../../store/useShowStore';
import { audioEngine } from '../../utils/audio';
import { hypeMeter } from '../../utils/hype';
import { getBannerTexture, getDeckTexture, getGrillTexture } from './textures';
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

/** Raised stage deck with a plywood anti-slip top, skirt and edge strip. */
export function StagePlatform({ object }: { object: SceneObject }) {
  const deck = useMemo(() => getDeckTexture(), []);
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[14, 0.5, 8]} />
        <meshStandardMaterial color={object.color} metalness={0.25} roughness={0.75} />
      </mesh>
      {/* Textured deck surface (phenolic plywood panels) */}
      <mesh position={[0, 0.265, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[14, 8]} />
        <meshStandardMaterial map={deck} color="#ffffff" metalness={0.05} roughness={0.92} />
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

/**
 * Crowd safety barrier (Mojo-style). Convention: +Z faces the crowd. The crowd
 * leans on the slightly back-leaning front face and top rail, standing on the
 * ground plate (their weight anchors it); the diagonal support legs and kick
 * rail are on the -Z stage side, where security stands.
 */
export function Barrier({ object }: { object: SceneObject }) {
  const steel = useMemo(
    () => new THREE.MeshStandardMaterial({ color: object.color, metalness: 0.75, roughness: 0.35 }),
    [object.color],
  );
  useEffect(() => () => steel.dispose(), [steel]);
  return (
    <group>
      {/* Front face — leans slightly back; the crowd (+Z) pushes against it */}
      <mesh position={[0, 0, 0.16]} rotation={[-0.12, 0, 0]} material={steel}>
        <boxGeometry args={[1.2, 1.0, 0.04]} />
      </mesh>
      {/* Rounded top rail along the front edge (arms rest here) */}
      <mesh position={[0, 0.49, 0.1]} rotation={[0, 0, Math.PI / 2]} material={steel}>
        <cylinderGeometry args={[0.035, 0.035, 1.2, 10]} />
      </mesh>
      {/* Ground plate under the crowd's feet (+Z) — weight anchors the barrier */}
      <mesh position={[0, -0.53, 0.46]} material={steel}>
        <boxGeometry args={[1.2, 0.03, 0.62]} />
      </mesh>
      {/* Diagonal support legs on the stage side (-Z) */}
      {[-0.5, 0.5].map((x) => (
        <mesh key={x} position={[x, -0.09, -0.2]} rotation={[0.6, 0, 0]} material={steel}>
          <boxGeometry args={[0.04, 1.04, 0.04]} />
        </mesh>
      ))}
      {/* Kick rail linking the legs at the back */}
      <mesh position={[0, -0.5, -0.36]} rotation={[0, 0, Math.PI / 2]} material={steel}>
        <cylinderGeometry args={[0.025, 0.025, 1.06, 8]} />
      </mesh>
    </group>
  );
}

/** Front-of-house mix tower: scaffold frame, desk with glowing screens, roof. */
export function FohTower({ object }: { object: SceneObject }) {
  const scaffold = useMemo(
    () => new THREE.MeshStandardMaterial({ color: object.color, metalness: 0.8, roughness: 0.4 }),
    [object.color],
  );
  useEffect(() => () => scaffold.dispose(), [scaffold]);
  const W = 1.4; // half width
  const H = 1.3; // half height
  return (
    <group>
      {/* Corner posts */}
      {[-W, W].map((x) =>
        [-W, W].map((z) => (
          <mesh key={`${x}_${z}`} position={[x, 0, z]} material={scaffold}>
            <boxGeometry args={[0.09, H * 2, 0.09]} />
          </mesh>
        )),
      )}
      {/* Horizontal rails (two levels, both axes) */}
      {[-H + 0.5, H - 0.25].map((y) => (
        <group key={y}>
          {[-W, W].map((z) => (
            <mesh key={`x${z}`} position={[0, y, z]} material={scaffold}>
              <boxGeometry args={[W * 2, 0.06, 0.06]} />
            </mesh>
          ))}
          {[-W, W].map((x) => (
            <mesh key={`z${x}`} position={[x, y, 0]} material={scaffold}>
              <boxGeometry args={[0.06, 0.06, W * 2]} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Roof tarp */}
      <mesh position={[0, H + 0.06, 0]}>
        <boxGeometry args={[W * 2 + 0.3, 0.08, W * 2 + 0.3]} />
        <meshStandardMaterial color="#101318" roughness={0.9} metalness={0.1} />
      </mesh>
      {/* Mixing desk facing the stage (-Z) with a glowing console strip */}
      <mesh position={[0, -H + 0.75, -W + 0.5]}>
        <boxGeometry args={[1.9, 0.1, 0.8]} />
        <meshStandardMaterial color="#15181f" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, -H + 0.82, -W + 0.5]} rotation={[-Math.PI / 2.6, 0, 0]}>
        <planeGeometry args={[1.7, 0.35]} />
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.5} toneMapped={false} />
      </mesh>
      {/* Rack case beside the desk */}
      <mesh position={[1.0, -H + 0.45, -W + 0.55]}>
        <boxGeometry args={[0.55, 0.9, 0.6]} />
        <meshStandardMaterial color="#0c0e14" metalness={0.6} roughness={0.45} />
      </mesh>
    </group>
  );
}

/** Flown PA line-array: stacked cabinets with perforated grills, slight splay. */
export function Speaker({ object }: { object: SceneObject }) {
  const cab = useMemo(() => new THREE.MeshStandardMaterial({ color: object.color, metalness: 0.35, roughness: 0.6 }), [object.color]);
  const grill = useMemo(
    () => new THREE.MeshStandardMaterial({ map: getGrillTexture(), color: '#ffffff', metalness: 0.4, roughness: 0.55 }),
    [],
  );
  useEffect(() => () => {
    cab.dispose();
    grill.dispose();
  }, [cab, grill]);
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
            {/* Perforated grill face */}
            <mesh position={[0, 0, 0.478]} material={grill}>
              <planeGeometry args={[1.16, 0.52]} />
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

/** Trouser tones — jeans, blacks, khakis. */
const PANTS = ['#33404f', '#2a3542', '#23262c', '#3d3a33', '#40484f', '#1f232a'];

interface Person {
  x: number;
  z: number;
  h: number;
  phase: number;
  energy: number;
  wide: number;
  cloth: string;
  skin: string;
  pants: string;
  armUp: boolean;
  side: 1 | -1;
  phone: boolean;
  rotY: number;
}

/**
 * Audience — instanced people with real anatomy: two legs, a torso, two hanging
 * arms, a head, and (for a share of them) a raised arm holding a glowing phone.
 * All instanced (7 draw calls for ~360 people). They sway idly and jump to the
 * show; phone screens only really read at night, like at a real gig.
 */
export function CrowdBlock({ object }: { object: SceneObject }) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const legRef = useRef<THREE.InstancedMesh>(null);
  const armDownRef = useRef<THREE.InstancedMesh>(null);
  const armRef = useRef<THREE.InstancedMesh>(null);
  const phoneRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const phoneMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#cfe0ff', toneMapped: false, transparent: true, opacity: 1, side: THREE.DoubleSide }),
    [],
  );
  // Raised arm pivots at the shoulder (points up); hanging arm pivots at the
  // shoulder too (points down).
  const armGeo = useMemo(() => {
    const g = new THREE.CapsuleGeometry(0.042, 0.5, 3, 6);
    g.translate(0, 0.29, 0);
    return g;
  }, []);
  const armDownGeo = useMemo(() => {
    const g = new THREE.CapsuleGeometry(0.045, 0.42, 3, 6);
    g.translate(0, -0.26, 0);
    return g;
  }, []);
  useEffect(() => () => {
    phoneMat.dispose();
    armGeo.dispose();
    armDownGeo.dispose();
  }, [phoneMat, armGeo, armDownGeo]);

  const people = useMemo<Person[]>(() => {
    const arr: Person[] = [];
    for (let r = 0; r < CROWD_ROWS; r++) {
      for (let c = 0; c < CROWD_COLS; c++) {
        const armUp = Math.random() < 0.32;
        arr.push({
          x: (c - CROWD_COLS / 2) * 0.8 + (Math.random() - 0.5) * 0.45,
          z: r * 0.8 + (Math.random() - 0.5) * 0.4,
          h: 1.55 + Math.random() * 0.3,
          phase: Math.random() * Math.PI * 2,
          energy: 0.35 + Math.random() * 0.65,
          wide: 0.88 + Math.random() * 0.28,
          cloth: CLOTHES[Math.floor(Math.random() * CLOTHES.length)],
          skin: SKIN[Math.floor(Math.random() * SKIN.length)],
          pants: PANTS[Math.floor(Math.random() * PANTS.length)],
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

  // Per-person clothing / skin / trouser colours (set once).
  useEffect(() => {
    const c = new THREE.Color();
    people.forEach((p, i) => {
      c.set(p.cloth);
      bodyRef.current?.setColorAt(i, c);
      armDownRef.current?.setColorAt(i * 2, c);
      armDownRef.current?.setColorAt(i * 2 + 1, c);
      c.set(p.skin);
      headRef.current?.setColorAt(i, c);
      c.set(p.pants);
      legRef.current?.setColorAt(i * 2, c);
      legRef.current?.setColorAt(i * 2 + 1, c);
    });
    arms.forEach((p, i) => {
      c.set(p.cloth);
      armRef.current?.setColorAt(i, c);
    });
    for (const ref of [bodyRef, headRef, legRef, armDownRef, armRef]) {
      if (ref.current?.instanceColor) ref.current.instanceColor.needsUpdate = true;
    }
  }, [people, arms]);

  useFrame(({ clock }) => {
    if (!bodyRef.current || !headRef.current || !legRef.current || !armDownRef.current) return;
    const t = clock.elapsedTime;
    const st = useShowStore.getState();
    const playing = st.isPlaying;
    const level = audioEngine.level;
    const hype = hypeMeter.value;
    // Phones read at night; almost invisible in daylight (and blaze when hyped).
    const hour = st.project.settings.timeOfDay ?? 13;
    const day = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
    phoneMat.opacity = Math.min(1, (0.22 + (1 - day) * 0.78) * (0.5 + hype * 0.75));
    // Idle sway; the pit jumps to the show — more the higher the hype.
    const amp = 0.045 + (playing ? 0.05 + hype * 0.2 + level * 0.12 : 0);

    let ai = 0;
    let pi = 0;
    for (let i = 0; i < CROWD_TOTAL; i++) {
      const p = people[i];
      const bob = Math.abs(Math.sin(t * 3.1 * p.energy + p.phase)) * amp * p.energy;
      const sway = Math.sin(t * 0.9 + p.phase) * 0.03;
      const x = p.x + sway;
      const rotY = p.rotY * 0.06;

      // Human proportions from total height
      const legLen = p.h * 0.47;
      const torsoLen = p.h * 0.36;
      const shoulderY = legLen + torsoLen * 0.9 + bob;
      const hipOff = 0.085 * p.wide;

      // Legs (jump with the body)
      for (let s = 0; s < 2; s++) {
        const lx = x + (s === 0 ? -hipOff : hipOff);
        dummy.position.set(lx, legLen / 2 + bob, p.z);
        dummy.rotation.set(0, rotY, 0);
        dummy.scale.set(1, legLen / 0.73, 1);
        dummy.updateMatrix();
        legRef.current.setMatrixAt(i * 2 + s, dummy.matrix);
      }

      // Torso (sits on the legs)
      dummy.position.set(x, legLen + torsoLen / 2 + bob, p.z);
      dummy.rotation.set(0, rotY, 0);
      dummy.scale.set(p.wide, torsoLen / 0.82, p.wide);
      dummy.updateMatrix();
      bodyRef.current.setMatrixAt(i, dummy.matrix);

      // Head
      dummy.position.set(x, legLen + torsoLen + 0.1 + bob, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      headRef.current.setMatrixAt(i, dummy.matrix);

      // Hanging arms at the sides (skip the side that's raised)
      for (let s = 0; s < 2; s++) {
        const sideSign = s === 0 ? -1 : 1;
        const hidden = p.armUp && sideSign === p.side;
        const ax = x + sideSign * (0.17 * p.wide + 0.055);
        dummy.position.set(ax, shoulderY, p.z);
        dummy.rotation.set(Math.sin(t * 0.9 + p.phase) * 0.06, 0, sideSign * 0.12);
        dummy.scale.setScalar(hidden ? 0.001 : 1);
        dummy.updateMatrix();
        armDownRef.current.setMatrixAt(i * 2 + s, dummy.matrix);
      }

      // Raised arm (+ phone at its tip)
      if (p.armUp && armRef.current) {
        const theta = p.side * (0.32 + Math.sin(t * (1.15 + hype) + p.phase) * (0.13 + hype * 0.14));
        dummy.position.set(x + p.side * 0.19 * p.wide, shoulderY, p.z);
        dummy.rotation.set(0, 0, theta);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        armRef.current.setMatrixAt(ai, dummy.matrix);
        ai++;
        if (p.phone && phoneRef.current) {
          dummy.position.set(x + p.side * 0.19 * p.wide - Math.sin(theta) * 0.62, shoulderY + Math.cos(theta) * 0.62, p.z);
          dummy.rotation.set(0, p.rotY, theta);
          dummy.updateMatrix();
          phoneRef.current.setMatrixAt(pi, dummy.matrix);
          pi++;
        }
      }
    }
    bodyRef.current.instanceMatrix.needsUpdate = true;
    headRef.current.instanceMatrix.needsUpdate = true;
    legRef.current.instanceMatrix.needsUpdate = true;
    armDownRef.current.instanceMatrix.needsUpdate = true;
    if (armRef.current) armRef.current.instanceMatrix.needsUpdate = true;
    if (phoneRef.current) phoneRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* Torsos — the clickable body of the crowd. */}
      <instancedMesh ref={bodyRef} args={[undefined, undefined, CROWD_TOTAL]} frustumCulled={false} castShadow>
        <capsuleGeometry args={[0.165, 0.5, 4, 8]} />
        <meshStandardMaterial color="#ffffff" roughness={0.92} metalness={0} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, CROWD_TOTAL]} frustumCulled={false} raycast={ignoreRaycast}>
        <sphereGeometry args={[0.1, 10, 8]} />
        <meshStandardMaterial color="#ffffff" roughness={0.85} metalness={0} />
      </instancedMesh>
      {/* Legs (2 per person) */}
      <instancedMesh ref={legRef} args={[undefined, undefined, CROWD_TOTAL * 2]} frustumCulled={false} raycast={ignoreRaycast}>
        <capsuleGeometry args={[0.062, 0.6, 3, 6]} />
        <meshStandardMaterial color="#ffffff" roughness={0.95} metalness={0} />
      </instancedMesh>
      {/* Hanging arms (2 per person, one hidden when raised) */}
      <instancedMesh ref={armDownRef} args={[armDownGeo, undefined, CROWD_TOTAL * 2]} frustumCulled={false} raycast={ignoreRaycast}>
        <meshStandardMaterial color="#ffffff" roughness={0.92} metalness={0} />
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

// --------------------------------------------------------- Festival grounds

/** Deterministic 0..1 hash from the object's position — stable per placement,
 *  so duplicated / arrayed decor gets natural variation for free. */
function seed01(object: SceneObject, salt = 0): number {
  const s = Math.sin(object.position[0] * 12.9898 + object.position[2] * 78.233 + salt * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

/** Muted, natural greens (real foliage is far less saturated than "game green"). */
const FOLIAGE = ['#3a4d33', '#44573b', '#31422b', '#4c5f42', '#3d5238'];

/**
 * Lumpy organic foliage: an icosahedron whose vertices are displaced radially by
 * a position-hash (same displacement for co-located verts → no cracks). Reads as
 * a leaf mass rather than a smooth ball.
 */
function makeFoliageGeo(seed: number, detail = 2): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 91.3) * 43758.5453;
    const r = 1 + (h - Math.floor(h) - 0.5) * 0.42;
    pos.setXYZ(i, x * r, y * r * 1.08, z * r);
  }
  g.computeVertexNormals();
  return g;
}

/** A park tree: tapered trunk, a low branch, and lumpy leaf masses. */
export function Tree({ object }: { object: SceneObject }) {
  const rot = seed01(object) * Math.PI * 2;
  const foliageGeo = useMemo(() => makeFoliageGeo(seed01(object) * 100), [object.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => foliageGeo.dispose(), [foliageGeo]);
  const leaf = (i: number) => FOLIAGE[Math.floor(seed01(object, i + 1) * FOLIAGE.length)];
  const bark = <meshStandardMaterial color="#4a3a2b" roughness={0.95} />;
  return (
    <group rotation={[0, rot, 0]}>
      {/* Trunk (base at -2.3) + a forked branch */}
      <mesh position={[0, -1.05, 0]}>
        <cylinderGeometry args={[0.14, 0.26, 2.5, 8]} />
        {bark}
      </mesh>
      <mesh position={[0.35, -0.15, 0.1]} rotation={[0, 0, -0.55]}>
        <cylinderGeometry args={[0.06, 0.1, 1.3, 6]} />
        {bark}
      </mesh>
      {/* Leaf masses — slightly squashed, overlapping, muted greens */}
      {[
        [0, 1.05, 0, 1.45],
        [0.85, 0.5, 0.3, 1.0],
        [-0.8, 0.42, -0.25, 0.95],
        [0.15, 0.4, 0.85, 0.85],
        [-0.25, 1.7, 0.15, 0.8],
      ].map(([x, y, z, sc], i) => (
        <mesh key={i} geometry={foliageGeo} position={[x, y, z]} scale={[sc, sc * 0.88, sc]}>
          <meshStandardMaterial color={leaf(i)} roughness={0.98} />
        </mesh>
      ))}
    </group>
  );
}

/** A low hedge/bush cluster (same lumpy foliage, ground-hugging). */
export function Bush({ object }: { object: SceneObject }) {
  const rot = seed01(object) * Math.PI * 2;
  const foliageGeo = useMemo(() => makeFoliageGeo(seed01(object) * 55 + 7), [object.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => foliageGeo.dispose(), [foliageGeo]);
  return (
    <group rotation={[0, rot, 0]}>
      {[
        [0, -0.12, 0, 0.62],
        [0.48, -0.22, 0.15, 0.44],
        [-0.42, -0.24, -0.1, 0.4],
        [0.1, -0.2, -0.42, 0.38],
      ].map(([x, y, z, sc], i) => (
        <mesh key={i} geometry={foliageGeo} position={[x, y, z]} scale={[sc, sc * 0.78, sc]}>
          <meshStandardMaterial color={FOLIAGE[(i * 2 + 1) % FOLIAGE.length]} roughness={0.98} />
        </mesh>
      ))}
    </group>
  );
}

const BOTTLE_COLORS = ['#2e5c2e', '#6b4a2a', '#3a5f77', '#5c2e34', '#4a4a52', '#6e5c33'];
const CANVAS_WHITE = '#e7e4dc';

/**
 * Festival bar tent — the real thing: a long white marquee (7 m), a plank
 * counter along the whole front, staff area behind with bottle shelves, a warm
 * light strip under the roof and a printed "BAR" banner on the gable.
 */
export function BarStand({ object }: { object: SceneObject }) {
  const banner = useMemo(() => getBannerTexture('BAR', '#ffffff', object.color), [object.color]);
  const canvasMat = useMemo(() => new THREE.MeshStandardMaterial({ color: CANVAS_WHITE, roughness: 0.92, side: THREE.DoubleSide }), []);
  const postMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5f666f', metalness: 0.7, roughness: 0.4 }), []);
  useEffect(() => () => {
    canvasMat.dispose();
    postMat.dispose();
  }, [canvasMat, postMat]);
  const W = 3.5; // half length
  return (
    <group>
      {/* Posts along front + back */}
      {[-W + 0.2, 0, W - 0.2].map((x) =>
        [-1.35, 1.35].map((z) => (
          <mesh key={`${x}_${z}`} position={[x, -0.25, z]} material={postMat}>
            <cylinderGeometry args={[0.035, 0.035, 2.5, 8]} />
          </mesh>
        )),
      )}
      {/* Gabled canvas roof (two pitched panels meeting at a ridge) */}
      <mesh position={[0, 1.2, 0.78]} rotation={[0.52, 0, 0]} material={canvasMat}>
        <planeGeometry args={[W * 2 + 0.5, 1.85]} />
      </mesh>
      <mesh position={[0, 1.2, -0.78]} rotation={[-0.52, 0, 0]} material={canvasMat}>
        <planeGeometry args={[W * 2 + 0.5, 1.85]} />
      </mesh>
      {/* Canvas back wall + gable ends */}
      <mesh position={[0, 0.05, -1.42]} material={canvasMat}>
        <planeGeometry args={[W * 2 + 0.3, 2.1]} />
      </mesh>
      {/* Valance strip along the front edge */}
      <mesh position={[0, 0.92, 1.44]} material={canvasMat}>
        <planeGeometry args={[W * 2 + 0.5, 0.28]} />
      </mesh>
      {/* Printed banner on the valance, centred */}
      <mesh position={[0, 0.93, 1.455]}>
        <planeGeometry args={[1.9, 0.55]} />
        <meshStandardMaterial map={banner} roughness={0.8} />
      </mesh>
      {/* Long plank counter across the front */}
      <mesh position={[0, -0.85, 1.05]}>
        <boxGeometry args={[W * 2 - 0.4, 0.95, 0.55]} />
        <meshStandardMaterial color="#6e5638" roughness={0.85} />
      </mesh>
      <mesh position={[0, -0.34, 1.05]}>
        <boxGeometry args={[W * 2 - 0.25, 0.06, 0.72]} />
        <meshStandardMaterial color="#8a6c46" roughness={0.7} />
      </mesh>
      {/* Back bar: shelf + realistic glass-bottle row (subtle, not neon) */}
      <mesh position={[0, -0.7, -1.15]}>
        <boxGeometry args={[W * 2 - 0.8, 1.2, 0.35]} />
        <meshStandardMaterial color="#3a3f47" roughness={0.7} metalness={0.2} />
      </mesh>
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh key={i} position={[-W + 0.85 + i * 0.52, 0.06, -1.15]}>
          <cylinderGeometry args={[0.045, 0.055, 0.3, 8]} />
          <meshStandardMaterial color={BOTTLE_COLORS[i % BOTTLE_COLORS.length]} roughness={0.25} metalness={0.1} />
        </mesh>
      ))}
      {/* Warm service light under the ridge (reads at night) */}
      <mesh position={[0, 1.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W * 2 - 1, 0.14]} />
        <meshStandardMaterial color="#ffd9a0" emissive="#ffd9a0" emissiveIntensity={0.9} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Market-style food stall: small canvas gable tent, counter, printed banner. */
export function FoodStand({ object }: { object: SceneObject }) {
  const banner = useMemo(() => getBannerTexture('FOOD', '#ffffff', object.color), [object.color]);
  const canvasMat = useMemo(() => new THREE.MeshStandardMaterial({ color: CANVAS_WHITE, roughness: 0.92, side: THREE.DoubleSide }), []);
  useEffect(() => () => canvasMat.dispose(), [canvasMat]);
  return (
    <group>
      {/* Corner posts */}
      {[-1.45, 1.45].map((x) =>
        [-1.05, 1.05].map((z) => (
          <mesh key={`${x}_${z}`} position={[x, -0.2, z]}>
            <cylinderGeometry args={[0.032, 0.032, 2.4, 8]} />
            <meshStandardMaterial color="#5f666f" metalness={0.7} roughness={0.4} />
          </mesh>
        )),
      )}
      {/* Gabled canvas roof + valance */}
      <mesh position={[0, 1.12, 0.58]} rotation={[0.55, 0, 0]} material={canvasMat}>
        <planeGeometry args={[3.2, 1.4]} />
      </mesh>
      <mesh position={[0, 1.12, -0.58]} rotation={[-0.55, 0, 0]} material={canvasMat}>
        <planeGeometry args={[3.2, 1.4]} />
      </mesh>
      <mesh position={[0, 0.88, 1.08]} material={canvasMat}>
        <planeGeometry args={[3.2, 0.24]} />
      </mesh>
      {/* Printed banner */}
      <mesh position={[0, 0.89, 1.095]}>
        <planeGeometry args={[1.5, 0.45]} />
        <meshStandardMaterial map={banner} roughness={0.8} />
      </mesh>
      {/* Stall body + counter top */}
      <mesh position={[0, -0.72, 0.2]}>
        <boxGeometry args={[2.6, 1.05, 0.8]} />
        <meshStandardMaterial color="#454a52" roughness={0.8} />
      </mesh>
      <mesh position={[0, -0.16, 0.2]}>
        <boxGeometry args={[2.7, 0.06, 0.95]} />
        <meshStandardMaterial color="#8a6c46" roughness={0.7} />
      </mesh>
      {/* Back wall + lit menu board */}
      <mesh position={[0, 0.05, -1.02]} material={canvasMat}>
        <planeGeometry args={[3.0, 2.0]} />
      </mesh>
      <mesh position={[0, 0.45, -0.99]}>
        <planeGeometry args={[1.5, 0.55]} />
        <meshStandardMaterial color="#f4ead6" emissive="#f4ead6" emissiveIntensity={0.45} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Canvas pagoda tent: fabric walls + pyramid roof. */
export function Tent({ object }: { object: SceneObject }) {
  return (
    <group>
      <mesh position={[0, -0.55, 0]}>
        <boxGeometry args={[2.2, 1.4, 2.2]} />
        <meshStandardMaterial color={object.color} roughness={0.95} />
      </mesh>
      {/* Pyramid roof (4-sided cone rotated 45°) */}
      <mesh position={[0, 0.72, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[1.85, 1.1, 4]} />
        <meshStandardMaterial color="#c9c2b4" roughness={0.95} flatShading />
      </mesh>
      <mesh position={[0, 1.3, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.35, 6]} />
        <meshStandardMaterial color="#1a1d26" metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  );
}

/**
 * Festival sanitary block — half cabin, half open urinal, like the real thing:
 * a lockable cabin on the left (door, handle, occupancy dot, roof cap, vents)
 * and an open urinal bay on the right (modesty screens + trough).
 */
export function Portaloo({ object }: { object: SceneObject }) {
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: object.color, roughness: 0.62 }), [object.color]);
  useEffect(() => () => body.dispose(), [body]);
  const free = seed01(object) > 0.5; // some cabins show green, some red — lived-in
  return (
    <group>
      {/* --- Cabin (left half) --- */}
      <group position={[-0.62, 0, 0]}>
        <mesh material={body}>
          <boxGeometry args={[1.05, 2.25, 1.05]} />
        </mesh>
        <mesh position={[0, 1.16, 0]}>
          <boxGeometry args={[1.12, 0.1, 1.12]} />
          <meshStandardMaterial color="#dde3ea" roughness={0.5} />
        </mesh>
        {/* Door seam, handle, occupancy dot, vents */}
        <mesh position={[0, -0.05, 0.531]}>
          <planeGeometry args={[0.8, 1.9]} />
          <meshStandardMaterial color="#000000" transparent opacity={0.22} />
        </mesh>
        <mesh position={[0.3, -0.1, 0.54]}>
          <boxGeometry args={[0.05, 0.14, 0.03]} />
          <meshStandardMaterial color="#e8ecf2" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0.3, 0.18, 0.535]}>
          <circleGeometry args={[0.03, 10]} />
          <meshStandardMaterial color={free ? '#2fae4e' : '#c43a3a'} emissive={free ? '#2fae4e' : '#c43a3a'} emissiveIntensity={0.4} toneMapped={false} />
        </mesh>
        {[0.78, 0.9].map((y) => (
          <mesh key={y} position={[0, y, 0.531]}>
            <planeGeometry args={[0.6, 0.04]} />
            <meshStandardMaterial color="#0c0e14" />
          </mesh>
        ))}
      </group>

      {/* --- Open urinal bay (right half) --- */}
      <group position={[0.62, 0, 0]}>
        {/* Back panel + side modesty screens (waist-to-shoulder height) */}
        <mesh position={[0, -0.28, -0.5]} material={body}>
          <boxGeometry args={[1.05, 1.7, 0.06]} />
        </mesh>
        <mesh position={[0.5, -0.35, -0.05]} material={body}>
          <boxGeometry args={[0.06, 1.55, 0.95]} />
        </mesh>
        {/* Urinal trough along the back */}
        <mesh position={[0, -0.62, -0.32]} rotation={[0.5, 0, 0]}>
          <boxGeometry args={[0.95, 0.09, 0.34]} />
          <meshStandardMaterial color="#aeb6bf" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0, -0.42, -0.44]}>
          <boxGeometry args={[0.95, 0.5, 0.05]} />
          <meshStandardMaterial color="#c3cad2" metalness={0.55} roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Tall pole with a cloth flag. The flag is a segmented plane whose vertices
 * ripple in a travelling wave (amplitude grows toward the free end), pinned at
 * the pole — it reads as real fabric in the wind, not a rotating board.
 */
export function FlagPole({ object }: { object: SceneObject }) {
  const phase = seed01(object) * Math.PI * 2;
  const flagW = 1.35;
  const geo = useMemo(() => new THREE.PlaneGeometry(flagW, 0.8, 12, 6), []);
  useEffect(() => () => geo.dispose(), [geo]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i); // -w/2 (pole side) .. +w/2 (free end)
      const u = (x + flagW / 2) / flagW; // 0 at the pole, 1 free
      const wave = Math.sin(u * 6.5 - t * 4.2 + phase) * 0.14 + Math.sin(u * 11 - t * 6.4 + phase * 1.7) * 0.05;
      pos.setZ(i, wave * u * u); // pinned at the pole, freer at the tip
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  });

  return (
    <group>
      <mesh>
        <cylinderGeometry args={[0.035, 0.05, 5, 8]} />
        <meshStandardMaterial color="#8a919c" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, 2.52, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#d9dee6" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh geometry={geo} position={[flagW / 2 + 0.05, 2.05, 0]}>
        <meshStandardMaterial color={object.color} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Galvanised perimeter fence panel (heras): feet, frame and wire grid. */
export function FencePanel({ object }: { object: SceneObject }) {
  const steel = useMemo(
    () => new THREE.MeshStandardMaterial({ color: object.color, metalness: 0.75, roughness: 0.4 }),
    [object.color],
  );
  useEffect(() => () => steel.dispose(), [steel]);
  return (
    <group>
      {/* Feet */}
      {[-0.95, 0.95].map((x) => (
        <mesh key={x} position={[x, -0.97, 0]} material={steel}>
          <boxGeometry args={[0.28, 0.08, 0.5]} />
        </mesh>
      ))}
      {/* Frame */}
      {[-0.99, 0.99].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[0, 0, Math.PI / 2]} material={steel}>
          <cylinderGeometry args={[0.025, 0.025, 2.2, 6]} />
        </mesh>
      ))}
      {[-1.08, 1.08].map((x) => (
        <mesh key={x} position={[x, 0, 0]} material={steel}>
          <cylinderGeometry args={[0.025, 0.025, 2.0, 6]} />
        </mesh>
      ))}
      {/* Wire grid — a few thin bars read as mesh from a distance */}
      {[-0.72, -0.36, 0, 0.36, 0.72].map((x) => (
        <mesh key={`v${x}`} position={[x, 0, 0]} material={steel}>
          <boxGeometry args={[0.015, 1.95, 0.015]} />
        </mesh>
      ))}
      {[-0.5, 0, 0.5].map((y) => (
        <mesh key={`h${y}`} position={[0, y, 0]} material={steel}>
          <boxGeometry args={[2.12, 0.015, 0.015]} />
        </mesh>
      ))}
    </group>
  );
}
