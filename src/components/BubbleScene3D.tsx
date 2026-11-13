import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  BOARD_HALF_WIDTH,
  BOARD_TOP_Y,
  BUBBLE_DIAMETER,
  BUBBLE_RADIUS,
  CANNON_Y,
  cellKey,
  DANGER_ROW,
  findNearestEmptyCell,
  gridToWorld,
  traceAimTrajectory,
} from '../game/hexGrid';
import {
  ActiveShotKind,
  BUBBLE_COLORS,
  BubbleColor,
  GridBubble,
  LevelConfig,
  ScreenMode,
} from '../game/types';

export interface ShotResultEvent {
  shot: ActiveShotKind;
  landRow: number;
  landCol: number;
}

export interface BubbleSceneHandle {
  fireAtAngle: (angleRad?: number) => void;
  spawnExplosion: (x: number, y: number, colorHex: number, count?: number, ringScale?: number) => void;
  spawnFallingBubbles: (bubbles: GridBubble[]) => void;
  spawnPopEffects: (bubbles: GridBubble[], heavy?: boolean) => void;
}

interface BubbleScene3DProps {
  mode: ScreenMode;
  level: LevelConfig;
  grid: Map<string, GridBubble>;
  gridVersion: number;
  activeShot: ActiveShotKind;
  nextColor: BubbleColor;
  aimGuideEnabled: boolean;
  canShoot: boolean;
  sceneRef: React.MutableRefObject<BubbleSceneHandle | null>;
  onShootFired: () => void;
  onWallBounce: () => void;
  onShotLanded: (event: ShotResultEvent) => void;
}

const MAX_PARTICLES = 160;
const MAX_AIM_DOTS = 28;
const MAX_SHOCKWAVES = 10;

interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scale: number;
  color: THREE.Color;
}

interface FallingBubbleItem {
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  life: number;
  colorHex: number;
}

interface ShockwaveItem {
  mesh: THREE.Mesh;
  active: boolean;
  life: number;
  maxLife: number;
  maxScale: number;
}

const _vec3 = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scaleVec = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export const BubbleScene3D: React.FC<BubbleScene3DProps> = ({
  mode,
  level,
  grid,
  gridVersion,
  activeShot,
  nextColor,
  aimGuideEnabled,
  canShoot,
  sceneRef,
  onShootFired,
  onWallBounce,
  onShotLanded,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Store latest props in refs so the Three.js scene mounts once and never resets on React HUD updates
  const propsRef = useRef({
    mode,
    level,
    grid,
    gridVersion,
    activeShot,
    nextColor,
    aimGuideEnabled,
    canShoot,
    onShootFired,
    onWallBounce,
    onShotLanded,
  });
  propsRef.current = {
    mode,
    level,
    grid,
    gridVersion,
    activeShot,
    nextColor,
    aimGuideEnabled,
    canShoot,
    onShootFired,
    onWallBounce,
    onShotLanded,
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    renderer.shadowMap.enabled = false; // Crisp reflections + fast mobile/software FPS

    const initW = Math.max(container.clientWidth, 320);
    const initH = Math.max(container.clientHeight, 480);
    renderer.setSize(initW, initH);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0c1b47');
    scene.fog = new THREE.FogExp2('#0c1b47', 0.015);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(45, initW / initH, 0.1, 120);

    const updateCameraFraming = (w: number, h: number) => {
      const aspect = Math.max(0.35, w / Math.max(1, h));
      const halfFovRad = THREE.MathUtils.degToRad(45 / 2);
      const tanHalf = Math.tan(halfFovRad);
      // Fit vertical board cleanly inside top/bottom HUD margins on both desktop and mobile
      const zForHeight = 8.3 / tanHalf;
      const zForWidth = 5.25 / (tanHalf * aspect);
      const targetZ = Math.max(zForHeight, zForWidth);
      camera.aspect = aspect;
      camera.position.set(0, -0.35, targetZ);
      camera.lookAt(0, -0.25, 0);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    updateCameraFraming(initW, initH);

    // Three-point + Hemisphere Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xa5f3fc, 0x1e1b4b, 0.95);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff5e8, 1.8);
    keyLight.position.set(6, 11, 14);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.15);
    rimLight.position.set(-8, -5, 8);
    scene.add(rimLight);

    const cannonPointLight = new THREE.PointLight(0x38bdf8, 2.5, 12, 1.8);
    cannonPointLight.position.set(0, CANNON_Y + 0.5, 2.2);
    scene.add(cannonPointLight);

    // Gradient Backdrop Plane behind the board
    const bgUniforms = {
      uTop: { value: new THREE.Color('#0c1b47') },
      uMid: { value: new THREE.Color('#17377a') },
      uBottom: { value: new THREE.Color('#2366a8') },
      uTime: { value: 0 },
    };
    const bgGeo = new THREE.PlaneGeometry(80, 60);
    const bgMat = new THREE.ShaderMaterial({
      uniforms: bgUniforms,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform vec3 uTop;
        uniform vec3 uMid;
        uniform vec3 uBottom;
        uniform float uTime;
        void main() {
          float y = vUv.y;
          vec3 col = mix(uBottom, uMid, smoothstep(0.0, 0.55, y));
          col = mix(col, uTop, smoothstep(0.45, 1.0, y));
          float shimmer = sin(vUv.x * 8.0 + uTime * 0.4) * cos(vUv.y * 6.0 - uTime * 0.3) * 0.035;
          gl_FragColor = vec4(col + shimmer, 1.0);
        }
      `,
    });
    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    bgMesh.position.set(0, 0, -14);
    scene.add(bgMesh);

    // Shared Geometries & Materials
    const sphereOuterGeo = new THREE.SphereGeometry(BUBBLE_RADIUS * 0.96, 22, 18);
    const sphereCoreGeo = new THREE.SphereGeometry(BUBBLE_RADIUS * 0.72, 16, 12);
    const highlightGeo = new THREE.SphereGeometry(BUBBLE_RADIUS * 0.25, 10, 8);
    const stoneGeo = new THREE.DodecahedronGeometry(BUBBLE_RADIUS * 0.92, 1);
    const ringGeo = new THREE.TorusGeometry(BUBBLE_RADIUS * 1.16, 0.045, 8, 28);

    const colorOuterMaterials = new Map<BubbleColor, THREE.MeshPhysicalMaterial>();
    const colorCoreMaterials = new Map<BubbleColor, THREE.MeshStandardMaterial>();

    (Object.keys(BUBBLE_COLORS) as BubbleColor[]).forEach((cKey) => {
      const spec = BUBBLE_COLORS[cKey];
      const outer = new THREE.MeshPhysicalMaterial({
        color: spec.hex,
        emissive: spec.emissive,
        emissiveIntensity: 0.24,
        roughness: 0.05,
        metalness: 0.02,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        iridescence: 0.9,
        iridescenceIOR: 1.32,
        iridescenceThicknessMinimum: 140,
        iridescenceThicknessMaximum: 420,
        envMapIntensity: 1.6,
        transparent: true,
        opacity: isSoftwareGl ? 0.68 : 0.78,
      });
      const core = new THREE.MeshStandardMaterial({
        color: spec.hex,
        emissive: spec.hex,
        emissiveIntensity: 0.55,
        roughness: 0.18,
        metalness: 0.05,
      });
      colorOuterMaterials.set(cKey, outer);
      colorCoreMaterials.set(cKey, core);
    });

    const specularDotMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
    });

    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.42,
      metalness: 0.68,
      emissive: 0x0f172a,
      emissiveIntensity: 0.35,
    });

    const rainbowMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      emissive: 0x4c1d95,
      emissiveIntensity: 0.45,
      roughness: 0.04,
      metalness: 0.15,
      clearcoat: 1.0,
      iridescence: 1.0,
      iridescenceIOR: 1.65,
      iridescenceThicknessMinimum: 150,
      iridescenceThicknessMaximum: 680,
      envMapIntensity: 1.8,
    });

    const bombMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.25,
      metalness: 0.75,
      emissive: 0xdc2626,
      emissiveIntensity: 0.65,
    });

    const fireMat = new THREE.MeshPhysicalMaterial({
      color: 0xff5722,
      emissive: 0xff9100,
      emissiveIntensity: 0.9,
      roughness: 0.12,
      clearcoat: 1.0,
    });

    const lightningMat = new THREE.MeshPhysicalMaterial({
      color: 0x00e5ff,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.95,
      roughness: 0.08,
      clearcoat: 1.0,
    });

    const haloGoldMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.9,
    });

    const createBubbleMesh = (kind: 'color' | 'stone' | 'bomb' | 'rainbow' | 'fire' | 'lightning', color: BubbleColor | null): THREE.Group => {
      const grp = new THREE.Group();
      if (kind === 'stone') {
        const stone = new THREE.Mesh(stoneGeo, stoneMat);
        const rim = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.25 }));
        rim.scale.setScalar(0.84);
        grp.add(stone, rim);
        return grp;
      }

      if (kind === 'bomb' || kind === 'rainbow' || kind === 'fire' || kind === 'lightning') {
        const mat =
          kind === 'bomb'
            ? bombMat
            : kind === 'rainbow'
            ? rainbowMat
            : kind === 'fire'
            ? fireMat
            : lightningMat;
        const sphere = new THREE.Mesh(sphereOuterGeo, mat);
        const ring = new THREE.Mesh(ringGeo, haloGoldMat);
        ring.rotation.x = 0.55;
        grp.add(sphere, ring);
        if (kind === 'lightning') {
          const ring2 = new THREE.Mesh(ringGeo, haloGoldMat);
          ring2.rotation.y = 0.85;
          grp.add(ring2);
        }
        return grp;
      }

      const cKey = color ?? 'cyan';
      const outer = new THREE.Mesh(sphereOuterGeo, colorOuterMaterials.get(cKey)!);
      const core = new THREE.Mesh(sphereCoreGeo, colorCoreMaterials.get(cKey)!);
      const sheen = new THREE.Mesh(highlightGeo, specularDotMat);
      sheen.position.set(-BUBBLE_RADIUS * 0.34, BUBBLE_RADIUS * 0.36, BUBBLE_RADIUS * 0.65);
      grp.add(core, outer, sheen);
      return grp;
    };

    // Playfield Group (hidden on title/home/levels, visible on playing/paused/victory/gameover)
    const arenaGroup = new THREE.Group();
    scene.add(arenaGroup);

    // Side glass rails + top barrier
    const railGeo = new THREE.CylinderGeometry(0.11, 0.11, 12.6, 12);
    const railMat = new THREE.MeshPhysicalMaterial({
      color: 0x93c5fd,
      roughness: 0.15,
      metalness: 0.55,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.72,
    });
    const leftRail = new THREE.Mesh(railGeo, railMat);
    leftRail.position.set(-BOARD_HALF_WIDTH - 0.12, -0.3, 0);
    const rightRail = new THREE.Mesh(railGeo, railMat);
    rightRail.position.set(BOARD_HALF_WIDTH + 0.12, -0.3, 0);
    const topBarGeo = new THREE.CylinderGeometry(0.14, 0.14, BOARD_HALF_WIDTH * 2 + 0.48, 12);
    topBarGeo.rotateZ(Math.PI / 2);
    const topBar = new THREE.Mesh(topBarGeo, railMat);
    topBar.position.set(0, BOARD_TOP_Y + BUBBLE_RADIUS + 0.16, 0);

    // Subtle glowing danger line at DANGER_ROW
    const dangerY = gridToWorld(DANGER_ROW, 0).y + BUBBLE_RADIUS * 0.5;
    const dangerLineGeo = new THREE.PlaneGeometry(BOARD_HALF_WIDTH * 2 - 0.2, 0.045);
    const dangerLineMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.45,
    });
    const dangerLine = new THREE.Mesh(dangerLineGeo, dangerLineMat);
    dangerLine.position.set(0, dangerY, -0.1);
    arenaGroup.add(leftRail, rightRail, topBar, dangerLine);

    // Grid Bubble Container
    const gridContainer = new THREE.Group();
    arenaGroup.add(gridContainer);
    const gridMeshes = new Map<number, { mesh: THREE.Group; targetX: number; targetY: number; popIn: number }>();

    // Composite 6-part 3D Shooter Cannon Group
    const cannonRoot = new THREE.Group();
    cannonRoot.position.set(0, CANNON_Y, 0);
    arenaGroup.add(cannonRoot);

    const metalDarkMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.85,
    });
    const metalSilverMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.18,
      metalness: 0.9,
    });
    const cannonGlowMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    });

    // Part 1: Stationary Pedestal Base
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.38, 0.36, 24),
      metalDarkMat
    );
    pedestal.rotation.x = Math.PI / 2;
    pedestal.position.z = -0.35;
    cannonRoot.add(pedestal);

    // Rotating Turret Assembly
    const turretPivot = new THREE.Group();
    cannonRoot.add(turretPivot);

    // Part 2: Yoke Cradle
    const yokeBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.88, 0.45, 20),
      metalSilverMat
    );
    yokeBase.rotation.x = Math.PI / 2;
    turretPivot.add(yokeBase);

    // Part 3: Tapered Lathe Barrel
    const barrelPoints = [
      new THREE.Vector2(0.42, 0.0),
      new THREE.Vector2(0.56, 0.3),
      new THREE.Vector2(0.52, 0.95),
      new THREE.Vector2(0.62, 1.25),
      new THREE.Vector2(0.48, 1.28),
    ];
    const barrelGeo = new THREE.LatheGeometry(barrelPoints, 24);
    const barrelMesh = new THREE.Mesh(barrelGeo, metalDarkMat);
    barrelMesh.position.y = 0.05;
    turretPivot.add(barrelMesh);

    // Part 4: Glowing Energy Collar
    const collarMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.57, 0.075, 10, 24),
      cannonGlowMat
    );
    collarMesh.rotation.x = Math.PI / 2;
    collarMesh.position.y = 0.95;
    turretPivot.add(collarMesh);

    // Part 5 & 6: Twin Side Stabilizer Fins
    const finGeo = new THREE.BoxGeometry(0.16, 0.82, 0.36);
    const leftFin = new THREE.Mesh(finGeo, metalSilverMat);
    leftFin.position.set(-0.68, 0.48, 0);
    leftFin.rotation.z = 0.16;
    const rightFin = new THREE.Mesh(finGeo, metalSilverMat);
    rightFin.position.set(0.68, 0.48, 0);
    rightFin.rotation.z = -0.16;
    turretPivot.add(leftFin, rightFin);

    // Loaded Shot Preview Mesh mounted on turret muzzle
    const loadedBubbleHolder = new THREE.Group();
    loadedBubbleHolder.position.set(0, 0.72, 0.25);
    turretPivot.add(loadedBubbleHolder);

    // Next Bubble Pod to the left of cannon
    const nextPodHolder = new THREE.Group();
    nextPodHolder.position.set(-2.35, CANNON_Y - 0.08, 0);
    arenaGroup.add(nextPodHolder);
    const nextRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.58, 0.06, 10, 24),
      metalSilverMat
    );
    nextPodHolder.add(nextRing);

    // Aiming Guide Dots + Landing Target Ring
    const aimDotsGroup = new THREE.Group();
    arenaGroup.add(aimDotsGroup);
    const aimDotGeo = new THREE.SphereGeometry(0.11, 10, 8);
    const aimDotMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
    });
    const aimDots: THREE.Mesh[] = [];
    for (let i = 0; i < MAX_AIM_DOTS; i++) {
      const dot = new THREE.Mesh(aimDotGeo, aimDotMat);
      dot.visible = false;
      aimDotsGroup.add(dot);
      aimDots.push(dot);
    }
    const targetHalo = new THREE.Mesh(
      new THREE.TorusGeometry(BUBBLE_RADIUS * 0.95, 0.055, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })
    );
    targetHalo.visible = false;
    aimDotsGroup.add(targetHalo);

    // Ambient Floating Menu Bubbles (for Splash / Home / Level Select backdrop)
    const menuGroup = new THREE.Group();
    scene.add(menuGroup);
    const menuBubbles: Array<{
      mesh: THREE.Group;
      baseX: number;
      baseY: number;
      baseZ: number;
      speed: number;
      phase: number;
    }> = [];
    const colorKeys = Object.keys(BUBBLE_COLORS) as BubbleColor[];
    for (let i = 0; i < 24; i++) {
      const cKey = colorKeys[i % colorKeys.length];
      const bMesh = createBubbleMesh('color', cKey);
      const scale = 0.65 + (i % 5) * 0.25;
      bMesh.scale.setScalar(scale);
      const bx = ((i * 3.7) % 14) - 7;
      const by = ((i * 2.9) % 13) - 6.5;
      const bz = -2 - (i % 6) * 1.4;
      bMesh.position.set(bx, by, bz);
      menuGroup.add(bMesh);
      menuBubbles.push({
        mesh: bMesh,
        baseX: bx,
        baseY: by,
        baseZ: bz,
        speed: 0.4 + (i % 4) * 0.18,
        phase: i * 0.8,
      });
    }

    // Pooled InstancedMesh Particles (zero GC in render loop)
    const particleGeo = new THREE.SphereGeometry(0.12, 8, 6);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const particleInstanced = new THREE.InstancedMesh(
      particleGeo,
      particleMat,
      MAX_PARTICLES
    );
    particleInstanced.frustumCulled = false;
    particleInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(particleInstanced);

    const particles: ParticleSlot[] = Array.from({ length: MAX_PARTICLES }, () => ({
      active: false,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: 0.6,
      scale: 0,
      color: new THREE.Color(0xffffff),
    }));
    let particleCursor = 0;

    // Pooled Shockwave Rings
    const shockwaveGeo = new THREE.RingGeometry(0.35, 0.55, 28);
    const shockwaves: ShockwaveItem[] = Array.from({ length: MAX_SHOCKWAVES }, () => {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
      });
      const m = new THREE.Mesh(shockwaveGeo, mat);
      m.visible = false;
      scene.add(m);
      return { mesh: m, active: false, life: 0, maxLife: 0.4, maxScale: 3 };
    });

    const fallingBubbles: FallingBubbleItem[] = [];

    // Simulation state
    let aimAngle = 0; // radians from +Y (-1.22 to +1.22)
    let cannonRecoil = 0;
    let cameraTrauma = 0;
    let lastGridVersion = -1;
    let lastLoadedSig = '';
    let lastNextSig = '';

    // Active flying projectile
    let flyingShot: {
      active: boolean;
      shot: ActiveShotKind;
      mesh: THREE.Group | null;
      x: number;
      y: number;
      vx: number;
      vy: number;
    } = {
      active: false,
      shot: { kind: 'color', color: 'red' },
      mesh: null,
      x: 0,
      y: CANNON_Y,
      vx: 0,
      vy: 0,
    };

    const spawnExplosion = (
      x: number,
      y: number,
      colorHex: number,
      count = 12,
      ringScale = 2.4
    ) => {
      for (let i = 0; i < count; i++) {
        const slot = particles[particleCursor];
        particleCursor = (particleCursor + 1) % MAX_PARTICLES;
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        const speed = 2.5 + Math.random() * 5.2;
        slot.active = true;
        slot.x = x;
        slot.y = y;
        slot.z = 0.2;
        slot.vx = Math.cos(angle) * speed;
        slot.vy = Math.sin(angle) * speed + 1.2;
        slot.vz = (Math.random() - 0.3) * 3.8;
        slot.life = 0;
        slot.maxLife = 0.42 + Math.random() * 0.28;
        slot.scale = 0.8 + Math.random() * 0.85;
        slot.color.setHex(colorHex);
      }

      const wave = shockwaves.find((s) => !s.active) ?? shockwaves[0];
      wave.active = true;
      wave.life = 0;
      wave.maxLife = 0.36;
      wave.maxScale = ringScale;
      wave.mesh.visible = true;
      wave.mesh.position.set(x, y, 0.35);
      wave.mesh.scale.setScalar(0.4);
      (wave.mesh.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
      (wave.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85;
    };

    const spawnPopEffects = (bubbles: GridBubble[], heavy = false) => {
      if (heavy) {
        cameraTrauma = Math.min(1, cameraTrauma + 0.55);
      } else if (bubbles.length >= 4) {
        cameraTrauma = Math.min(1, cameraTrauma + 0.28);
      }
      for (const b of bubbles) {
        const pos = gridToWorld(b.row, b.col);
        const hex = b.color ? BUBBLE_COLORS[b.color].hex : 0xfbbf24;
        spawnExplosion(pos.x, pos.y, hex, heavy ? 14 : 9, heavy ? 3.2 : 2.1);
      }
    };

    const spawnFallingBubbles = (bubbles: GridBubble[]) => {
      for (const b of bubbles) {
        const pos = gridToWorld(b.row, b.col);
        const mesh = createBubbleMesh(b.kind, b.color);
        mesh.position.set(pos.x, pos.y, 0);
        scene.add(mesh);
        const hex = b.color ? BUBBLE_COLORS[b.color].hex : 0x94a3b8;
        fallingBubbles.push({
          mesh,
          x: pos.x,
          y: pos.y,
          z: 0,
          vx: (Math.random() - 0.5) * 3.4,
          vy: 1.5 + Math.random() * 2.2,
          vz: 0.8 + Math.random() * 1.4,
          rx: (Math.random() - 0.5) * 8,
          ry: (Math.random() - 0.5) * 8,
          life: 0,
          colorHex: hex,
        });
      }
    };

    const fireAtAngle = (overrideAngle?: number) => {
      const p = propsRef.current;
      if (p.mode !== 'playing' || !p.canShoot || flyingShot.active) return;
      if (typeof overrideAngle === 'number') {
        aimAngle = THREE.MathUtils.clamp(overrideAngle, -1.24, 1.24);
      }
      const speed = 23.5;
      const startX = Math.sin(aimAngle) * 0.72;
      const startY = CANNON_Y + Math.cos(aimAngle) * 0.72;
      const shotKind = p.activeShot;
      const meshKind = shotKind.kind === 'color' ? 'color' : shotKind.kind;
      const meshColor = shotKind.kind === 'color' ? shotKind.color : null;
      const projMesh = createBubbleMesh(meshKind, meshColor);
      projMesh.position.set(startX, startY, 0);
      arenaGroup.add(projMesh);

      flyingShot = {
        active: true,
        shot: shotKind,
        mesh: projMesh,
        x: startX,
        y: startY,
        vx: Math.sin(aimAngle) * speed,
        vy: Math.cos(aimAngle) * speed,
      };
      cannonRecoil = 0.28;
      p.onShootFired();
    };

    sceneRef.current = {
      fireAtAngle,
      spawnExplosion,
      spawnFallingBubbles,
      spawnPopEffects,
    };

    // Sync grid meshes whenever gridVersion changes
    const syncGridMeshes = () => {
      const currentGrid = propsRef.current.grid;
      const activeIds = new Set<number>();
      for (const b of currentGrid.values()) {
        activeIds.add(b.id);
        const pos = gridToWorld(b.row, b.col);
        if (!gridMeshes.has(b.id)) {
          const mesh = createBubbleMesh(b.kind, b.color);
          mesh.position.set(pos.x, pos.y, 0);
          mesh.scale.setScalar(0.15);
          gridContainer.add(mesh);
          gridMeshes.set(b.id, { mesh, targetX: pos.x, targetY: pos.y, popIn: 0 });
        } else {
          const entry = gridMeshes.get(b.id)!;
          entry.targetX = pos.x;
          entry.targetY = pos.y;
        }
      }
      for (const [id, entry] of gridMeshes.entries()) {
        if (!activeIds.has(id)) {
          gridContainer.remove(entry.mesh);
          gridMeshes.delete(id);
        }
      }
    };

    const syncCannonBubbles = () => {
      const p = propsRef.current;
      const shot = p.activeShot;
      const loadedSig =
        shot.kind === 'color' ? `c:${shot.color}` : `p:${shot.kind}`;
      if (loadedSig !== lastLoadedSig) {
        lastLoadedSig = loadedSig;
        while (loadedBubbleHolder.children.length > 0) {
          loadedBubbleHolder.remove(loadedBubbleHolder.children[0]);
        }
        const m = createBubbleMesh(
          shot.kind === 'color' ? 'color' : shot.kind,
          shot.kind === 'color' ? shot.color : null
        );
        m.scale.setScalar(0.86);
        loadedBubbleHolder.add(m);

        const glowHex =
          shot.kind === 'color'
            ? BUBBLE_COLORS[shot.color].hex
            : shot.kind === 'bomb'
            ? 0xef4444
            : shot.kind === 'fire'
            ? 0xf97316
            : shot.kind === 'lightning'
            ? 0x06b6d4
            : 0xe879f9;
        cannonGlowMat.color.setHex(glowHex);
        cannonGlowMat.emissive.setHex(glowHex);
        cannonPointLight.color.setHex(glowHex);
      }

      const nextSig = p.nextColor;
      if (nextSig !== lastNextSig) {
        lastNextSig = nextSig;
        while (nextPodHolder.children.length > 1) {
          nextPodHolder.remove(nextPodHolder.children[1]);
        }
        const nm = createBubbleMesh('color', p.nextColor);
        nm.scale.setScalar(0.75);
        nextPodHolder.add(nm);
      }
    };

    // Pointer / Touch Aiming & Shooting via Raycast onto Z=0 Plane
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const zPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const intersectPt = new THREE.Vector3();
    let isAiming = false;
    let aimCanceled = false;

    const updateAimFromPointer = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      if (raycaster.ray.intersectPlane(zPlane, intersectPt)) {
        const dx = intersectPt.x;
        const dy = intersectPt.y - CANNON_Y;
        if (dy < -0.35) {
          if (isAiming) {
            aimCanceled = true;
          }
          return;
        }
        aimCanceled = false;
        const safeDy = Math.max(0.45, dy);
        aimAngle = THREE.MathUtils.clamp(Math.atan2(dx, safeDy), -1.22, 1.22);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      const p = propsRef.current;
      if (p.mode !== 'playing' || !p.canShoot) return;
      isAiming = true;
      aimCanceled = false;
      updateAimFromPointer(e.clientX, e.clientY);
    };

    const onPointerMove = (e: PointerEvent) => {
      const p = propsRef.current;
      if (p.mode !== 'playing') return;
      if (isAiming || e.pointerType === 'mouse') {
        updateAimFromPointer(e.clientX, e.clientY);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isAiming) return;
      isAiming = false;
      updateAimFromPointer(e.clientX, e.clientY);
      if (!aimCanceled) {
        fireAtAngle();
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // Keyboard aim & shoot (ArrowLeft/Right, A/D, Space)
    const keysHeld = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      if (propsRef.current.mode !== 'playing') return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        keysHeld.add('left');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        keysHeld.add('right');
      } else if (e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault();
        fireAtAngle();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        keysHeld.delete('left');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        keysHeld.delete('right');
      }
    };
    const onWindowBlur = () => {
      keysHeld.clear();
      isAiming = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);

    // ResizeObserver for crisp layout across desktop & mobile
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(240, Math.round(entry.contentRect.width));
        const h = Math.max(320, Math.round(entry.contentRect.height));
        updateCameraFraming(w, h);
      }
    });
    resizeObserver.observe(container);

    // Main Simulation + Render Loop with software-WebGL afterDraw pacing
    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const wallMinX = -BOARD_HALF_WIDTH + BUBBLE_RADIUS;
    const wallMaxX = BOARD_HALF_WIDTH - BUBBLE_RADIUS;
    const collisionDistSq = (BUBBLE_DIAMETER * 0.88) ** 2;
    const _skyTop = new THREE.Color();
    const _skyMid = new THREE.Color();
    const _skyBottom = new THREE.Color();

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const elapsed = now * 0.001;

      const p = propsRef.current;
      const isMenuMode =
        p.mode === 'splash' || p.mode === 'home' || p.mode === 'levels';

      arenaGroup.visible = !isMenuMode;
      menuGroup.visible = isMenuMode;

      // Update sky backdrop theme smoothly without per-frame allocations
      const sky = p.level.skyTheme;
      _skyTop.set(sky.top);
      _skyMid.set(sky.mid);
      _skyBottom.set(sky.bottom);
      bgUniforms.uTop.value.lerp(_skyTop, 0.08);
      bgUniforms.uMid.value.lerp(_skyMid, 0.08);
      bgUniforms.uBottom.value.lerp(_skyBottom, 0.08);
      bgUniforms.uTime.value = elapsed;

      if (isMenuMode) {
        for (const mb of menuBubbles) {
          mb.mesh.position.y =
            mb.baseY + Math.sin(elapsed * mb.speed + mb.phase) * 0.65;
          mb.mesh.position.x =
            mb.baseX + Math.cos(elapsed * mb.speed * 0.7 + mb.phase) * 0.35;
          mb.mesh.rotation.y += dt * 0.45;
          mb.mesh.rotation.x += dt * 0.25;
        }
      } else {
        // Sync React grid & cannon visuals cleanly
        if (p.gridVersion !== lastGridVersion) {
          lastGridVersion = p.gridVersion;
          syncGridMeshes();
        }
        syncCannonBubbles();

        // Keyboard fine aiming
        if (p.mode === 'playing') {
          if (keysHeld.has('left')) aimAngle = Math.max(-1.22, aimAngle - 1.65 * dt);
          if (keysHeld.has('right')) aimAngle = Math.min(1.22, aimAngle + 1.65 * dt);
        }

        // Smooth turret rotation & recoil spring
        turretPivot.rotation.z = THREE.MathUtils.damp(
          turretPivot.rotation.z,
          -aimAngle,
          16,
          dt
        );
        cannonRecoil = THREE.MathUtils.damp(cannonRecoil, 0, 14, dt);
        barrelMesh.position.y = 0.05 - cannonRecoil * 0.55;
        loadedBubbleHolder.visible = !flyingShot.active && p.canShoot;
        loadedBubbleHolder.rotation.y += dt * 1.1;
        nextPodHolder.rotation.y += dt * 0.9;

        // Animate grid bubble pop-in & gentle idle shimmer
        for (const entry of gridMeshes.values()) {
          entry.popIn = Math.min(1, entry.popIn + dt * 6.5);
          const s = 0.2 + 0.8 * (1 - Math.pow(1 - entry.popIn, 3));
          entry.mesh.scale.setScalar(s);
          entry.mesh.position.x = THREE.MathUtils.damp(
            entry.mesh.position.x,
            entry.targetX,
            18,
            dt
          );
          entry.mesh.position.y = THREE.MathUtils.damp(
            entry.mesh.position.y,
            entry.targetY,
            18,
            dt
          );
          entry.mesh.rotation.y += dt * 0.35;
        }

        // Update 3D Aiming Guide Trajectory Dots
        if (
          p.mode === 'playing' &&
          p.aimGuideEnabled &&
          p.canShoot &&
          !flyingShot.active &&
          !aimCanceled
        ) {
          const trace = traceAimTrajectory(aimAngle, p.grid);
          const pts = trace.points;
          const snapWorld = trace.snapCell
            ? gridToWorld(trace.snapCell.row, trace.snapCell.col)
            : null;
          for (let i = 0; i < MAX_AIM_DOTS; i++) {
            const dot = aimDots[i];
            if (i < pts.length && i > 0) {
              const pt = pts[i];
              const tooCloseToHalo =
                snapWorld !== null &&
                Math.hypot(pt.x - snapWorld.x, pt.y - snapWorld.y) < BUBBLE_RADIUS * 1.1;
              if (tooCloseToHalo) {
                dot.visible = false;
              } else {
                dot.visible = true;
                dot.position.set(pt.x, pt.y, 0.15);
                const t = 1 - i / Math.max(1, pts.length);
                dot.scale.setScalar(0.65 + t * 0.45);
              }
            } else {
              dot.visible = false;
            }
          }
          if (snapWorld) {
            targetHalo.visible = true;
            targetHalo.position.set(snapWorld.x, snapWorld.y, 0.25);
            targetHalo.scale.setScalar(0.95 + Math.sin(elapsed * 7) * 0.08);
          } else {
            targetHalo.visible = false;
          }
        } else {
          for (const dot of aimDots) dot.visible = false;
          targetHalo.visible = false;
        }

        // Advance flying projectile with sub-stepped collision physics
        if (flyingShot.active && flyingShot.mesh && p.mode === 'playing') {
          const subSteps = 4;
          const subDt = dt / subSteps;
          let landed = false;

          for (let s = 0; s < subSteps; s++) {
            flyingShot.x += flyingShot.vx * subDt;
            flyingShot.y += flyingShot.vy * subDt;

            if (flyingShot.x <= wallMinX) {
              flyingShot.x = wallMinX + (wallMinX - flyingShot.x);
              flyingShot.vx = Math.abs(flyingShot.vx);
              p.onWallBounce();
              spawnExplosion(wallMinX, flyingShot.y, 0x7dd3fc, 5, 1.3);
            } else if (flyingShot.x >= wallMaxX) {
              flyingShot.x = wallMaxX - (flyingShot.x - wallMaxX);
              flyingShot.vx = -Math.abs(flyingShot.vx);
              p.onWallBounce();
              spawnExplosion(wallMaxX, flyingShot.y, 0x7dd3fc, 5, 1.3);
            }

            // Check grid bubble collisions
            for (const b of p.grid.values()) {
              const bp = gridToWorld(b.row, b.col);
              const dx = flyingShot.x - bp.x;
              const dy = flyingShot.y - bp.y;
              if (dx * dx + dy * dy <= collisionDistSq) {
                landed = true;
                break;
              }
            }

            if (landed || flyingShot.y >= BOARD_TOP_Y) {
              landed = true;
              break;
            }
          }

          flyingShot.mesh.position.set(flyingShot.x, flyingShot.y, 0);
          flyingShot.mesh.rotation.z += dt * 8;

          if (landed) {
            const snap = findNearestEmptyCell(
              flyingShot.x,
              Math.min(BOARD_TOP_Y, flyingShot.y),
              p.grid
            );
            arenaGroup.remove(flyingShot.mesh);
            const landedShot = flyingShot.shot;
            flyingShot.active = false;
            flyingShot.mesh = null;

            const fallbackCell = snap ?? { row: 0, col: 4 };
            // Guard against occupied cell
            const finalCell = p.grid.has(cellKey(fallbackCell.row, fallbackCell.col))
              ? findNearestEmptyCell(0, BOARD_TOP_Y - 1, p.grid) ?? fallbackCell
              : fallbackCell;

            p.onShotLanded({
              shot: landedShot,
              landRow: finalCell.row,
              landCol: finalCell.col,
            });
          }
        }
      }

      // Update Falling Floating Bubbles
      for (let i = fallingBubbles.length - 1; i >= 0; i--) {
        const fb = fallingBubbles[i];
        fb.life += dt;
        fb.vy -= 18.5 * dt;
        fb.x += fb.vx * dt;
        fb.y += fb.vy * dt;
        fb.z += fb.vz * dt;
        fb.mesh.position.set(fb.x, fb.y, fb.z);
        fb.mesh.rotation.x += fb.rx * dt;
        fb.mesh.rotation.y += fb.ry * dt;

        if (fb.y < CANNON_Y - 0.8 || fb.life > 1.4) {
          spawnExplosion(fb.x, Math.max(CANNON_Y - 0.5, fb.y), fb.colorHex, 6, 1.5);
          scene.remove(fb.mesh);
          fallingBubbles.splice(i, 1);
        }
      }

      // Update Pooled Instanced Particles
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const pt = particles[i];
        if (!pt.active) {
          _scaleVec.set(0, 0, 0);
          _mat4.compose(_vec3.set(0, -100, 0), _quat, _scaleVec);
          particleInstanced.setMatrixAt(i, _mat4);
          continue;
        }
        pt.life += dt;
        if (pt.life >= pt.maxLife) {
          pt.active = false;
          _scaleVec.set(0, 0, 0);
          _mat4.compose(_vec3.set(0, -100, 0), _quat, _scaleVec);
          particleInstanced.setMatrixAt(i, _mat4);
          continue;
        }
        pt.vy -= 9.5 * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.z += pt.vz * dt;
        const progress = pt.life / pt.maxLife;
        const s = pt.scale * (1 - progress);
        _vec3.set(pt.x, pt.y, pt.z);
        _scaleVec.set(s, s, s);
        _mat4.compose(_vec3, _quat, _scaleVec);
        particleInstanced.setMatrixAt(i, _mat4);
        particleInstanced.setColorAt(i, pt.color);
      }
      particleInstanced.instanceMatrix.needsUpdate = true;
      if (particleInstanced.instanceColor) {
        particleInstanced.instanceColor.needsUpdate = true;
      }

      // Update Shockwaves
      for (const sw of shockwaves) {
        if (!sw.active) continue;
        sw.life += dt;
        const t = sw.life / sw.maxLife;
        if (t >= 1) {
          sw.active = false;
          sw.mesh.visible = false;
        } else {
          sw.mesh.scale.setScalar(0.4 + t * sw.maxScale);
          (sw.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.78;
        }
      }

      // Decaying trauma camera shake
      if (cameraTrauma > 0) {
        cameraTrauma = Math.max(0, cameraTrauma - dt * 2.2);
        const shake = cameraTrauma * cameraTrauma * 0.25;
        camera.position.x = (Math.random() - 0.5) * shake;
        camera.position.y = -0.35 + (Math.random() - 0.5) * shake;
      } else {
        camera.position.x = THREE.MathUtils.damp(camera.position.x, 0, 12, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, -0.35, 12, dt);
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
      sceneRef.current = null;

      envRT.dispose();
      sphereOuterGeo.dispose();
      sphereCoreGeo.dispose();
      highlightGeo.dispose();
      stoneGeo.dispose();
      ringGeo.dispose();
      railGeo.dispose();
      topBarGeo.dispose();
      dangerLineGeo.dispose();
      bgGeo.dispose();
      bgMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      shockwaveGeo.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [sceneRef]);

  return (
    <div
      ref={mountRef}
      data-testid="bubble-3d-canvas-mount"
      className="fixed inset-0 z-0 w-full h-full select-none"
    />
  );
};
