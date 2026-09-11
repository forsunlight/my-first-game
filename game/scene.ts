import * as THREE from 'three';
import {
  type World,
  type Actor,
  type WeaponId,
  WEAPONS,
  seededRandom,
} from './rules';

const matCache = new Map<number, THREE.MeshStandardMaterial>();
function material(color: number) {
  if (!matCache.has(color))
    matCache.set(
      color,
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.84,
        flatShading: true,
      }),
    );
  return matCache.get(color)!;
}
export function box(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  color: number,
  x = 0,
  y = 0,
  z = 0,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function cylinder(
  parent: THREE.Object3D,
  r1: number,
  r2: number,
  h: number,
  color: number,
  x: number,
  y: number,
  z: number,
  segments = 8,
) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(r1, r2, h, segments),
    material(color),
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function label(
  text: string,
  foreground: string,
  background: string,
  size = 256,
) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = foreground;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${size * 0.64}px Arial`;
  ctx.fillText(text, size / 2, size / 2 + 5);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
export function createArena(world: World): THREE.Group {
  const arena = new THREE.Group();
  const random = seededRandom(29);
  box(arena, 100, 0.5, 100, 0x8ba958, 0, -0.26, 0);
  // Large strips of cut grass give the play space direction without expensive textures.
  for (let i = 0; i < 10; i++)
    box(
      arena,
      10,
      0.008,
      100,
      i % 2 ? 0x91ad5e : 0x88a554,
      -45 + i * 10,
      0.003,
      0,
    );
  box(arena, 8, 0.018, 100, 0xccceb1, -2, 0.015, 0);
  box(arena, 100, 0.018, 5, 0xccceb1, 0, 0.016, -5);
  for (let i = 0; i < world.buildings.length; i++) {
    const b = world.buildings[i],
      g = new THREE.Group();
    g.position.set(b.x, 0, b.z);
    arena.add(g);
    box(g, b.w + 0.3, 0.18, b.d + 0.3, 0xc9ccb6, 0, 0.05, 0);
    box(g, b.w, b.h, b.d, 0xe5e2cd, 0, b.h / 2, 0);
    box(g, b.w + 0.15, 0.22, b.d + 0.15, b.color, 0, b.h - 0.28, 0);
    box(g, b.w, 0.12, b.d, 0xd4d6c2, 0, b.h - 0.05, 0);
    box(g, b.w, 0.32, 0.12, b.color, 0, 0.42, b.d / 2 + 0.01);
    // Windows are recessed dark panels with sunlit trims.
    for (const side of [-1, 1])
      for (let j = -1; j <= 1; j++) {
        box(
          g,
          1.65,
          1.2,
          0.06,
          0x395f66,
          j * 2.8,
          b.h * 0.5,
          side * (b.d / 2 + 0.035),
        );
        box(
          g,
          1.8,
          0.09,
          0.14,
          0xf6edcf,
          j * 2.8,
          b.h * 0.5 - 0.62,
          side * (b.d / 2 + 0.06),
        );
        box(
          g,
          0.055,
          1.2,
          0.07,
          0x84b9b6,
          j * 2.8,
          b.h * 0.5,
          side * (b.d / 2 + 0.07),
        );
      }
    box(g, 0.06, 2, 1.3, 0x46646a, -b.w / 2 - 0.04, 1, 0);
    box(g, 1, 0.07, 1, 0xedc779, -b.w / 2 - 0.4, 0.03, 0);
    // Roof marker and perimeter paint are traversable, with no invisible rails.
    const roofSign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 3.4),
      new THREE.MeshStandardMaterial({
        map: label(`0${i + 1}`, '#f5f0da', '#8f9d83'),
        roughness: 1,
      }),
    );
    roofSign.rotation.x = -Math.PI / 2;
    roofSign.position.set(0, b.h + 0.018, 0);
    g.add(roofSign);
    for (const side of [-1, 1])
      box(
        g,
        b.w - 0.6,
        0.016,
        0.13,
        0xf1dfb2,
        0,
        b.h + 0.014,
        side * (b.d / 2 - 0.35),
      );
    box(g, 0.13, 0.016, b.d - 0.6, 0xf1dfb2, -b.w / 2 + 0.35, b.h + 0.014, 0);
    const wallSign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 1.7),
      new THREE.MeshStandardMaterial({
        map: label(`0${i + 1}`, '#fff3d7', `#${b.color.toString(16)}`),
      }),
    );
    wallSign.position.set(b.w / 2 - 0.95, b.h - 1.4, b.d / 2 + 0.045);
    g.add(wallSign);
    const start = b.x + b.w / 2,
      end = start + b.ramp,
      z = b.z;
    const vertices = new Float32Array([
      start,
      b.h,
      z - 2,
      start,
      b.h,
      z + 2,
      end,
      0,
      z + 2,
      start,
      b.h,
      z - 2,
      end,
      0,
      z + 2,
      end,
      0,
      z - 2,
      start,
      0,
      z - 2,
      start,
      b.h,
      z - 2,
      end,
      0,
      z - 2,
      start,
      b.h,
      z + 2,
      start,
      0,
      z + 2,
      end,
      0,
      z + 2,
    ]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    const ramp = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: 0xb9c2a7,
        side: THREE.DoubleSide,
        roughness: 1,
      }),
    );
    ramp.receiveShadow = true;
    arena.add(ramp);
    for (let s = 0; s < 8; s++) {
      const x = start + (b.ramp * (s + 0.5)) / 8,
        y = b.h * (1 - (s + 0.5) / 8) + 0.02;
      const stripe = box(
        arena,
        0.14,
        0.025,
        3.8,
        s % 2 ? 0xc5ccb5 : 0xe1d6a5,
        x,
        y,
        z,
      );
      stripe.rotation.z = -Math.atan2(b.h, b.ramp);
    }
  }
  for (const r of world.rocks) {
    const mesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1, 0),
      material(0x8e9c8c),
    );
    mesh.position.set(r.x, r.h * 0.43, r.z);
    mesh.scale.set(r.radius, r.h * 0.65, r.radius * 0.92);
    mesh.rotation.set(0.2, r.rotation, 0.16);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    arena.add(mesh);
  }
  // Boundary forest: silhouettes frame the arena and keep the grass central.
  for (let i = 0; i < 68; i++) {
    const angle = (i / 68) * Math.PI * 2,
      rad = 59 + random() * 8,
      x = Math.cos(angle) * rad,
      z = Math.sin(angle) * rad;
    const h = 5 + random() * 4;
    cylinder(arena, 0.27, 0.4, h * 0.6, 0x716d46, x, h * 0.3, z, 5);
    cylinder(
      arena,
      0,
      2.3 + random(),
      h * 0.8,
      i % 3 ? 0x4e7952 : 0x6b8c52,
      x,
      h * 0.8,
      z,
      6,
    );
    cylinder(arena, 0, 1.8, h * 0.55, 0x668d55, x, h * 1.08, z, 6);
  }
  for (let i = 0; i < 4; i++) {
    const horizontal = i < 2,
      offset = i % 2 ? 50 : -50;
    box(
      arena,
      horizontal ? 100 : 0.22,
      0.75,
      horizontal ? 0.22 : 100,
      0x77956e,
      horizontal ? 0 : offset,
      0.38,
      horizontal ? offset : 0,
    );
    for (let j = -48; j <= 48; j += 8)
      box(
        arena,
        0.35,
        1.15,
        0.35,
        0xc3c5a4,
        horizontal ? j : offset,
        0.55,
        horizontal ? offset : j,
      );
  }
  for (let i = 0; i < 14; i++) {
    const x = (random() - 0.5) * 220,
      z = (random() - 0.5) * 220;
    const cloud = new THREE.Group();
    cloud.position.set(x, 24 + random() * 15, z);
    arena.add(cloud);
    for (let j = 0; j < 3; j++) {
      const puff = new THREE.Mesh(
        new THREE.IcosahedronGeometry(3 + random() * 3, 0),
        material(0xf0f3e8),
      );
      puff.position.set(j * 4, random() * 1.3, 0);
      puff.scale.set(1.6, 0.45, 1);
      cloud.add(puff);
    }
  }
  return arena;
}
export function makeWeapon(id: WeaponId, firstPerson = false): THREE.Group {
  const g = new THREE.Group(),
    w = WEAPONS[id];
  if (w.melee) {
    if (id === 'staff') {
      cylinder(g, 0.052, 0.052, 1.65, 0x932e27, 0, 0.15, 0);
      cylinder(g, 0.075, 0.075, 0.3, 0xf4c553, 0, 0.88, 0);
      cylinder(g, 0.075, 0.075, 0.3, 0xf4c553, 0, -0.58, 0);
      cylinder(g, 0.085, 0.085, 0.05, 0xffdf77, 0, 0.71, 0);
    } else {
      box(g, 0.09, 0.26, 0.1, 0x273b42, 0, -0.18, 0);
      box(g, 0.31, 0.045, 0.17, 0xe8bd5b, 0, -0.035, 0);
      box(
        g,
        0.095,
        id === 'katana' ? 1 : 0.42,
        0.025,
        0xd4f3f1,
        0,
        id === 'katana' ? 0.49 : 0.21,
        0,
      );
      box(
        g,
        0.024,
        id === 'katana' ? 1 : 0.42,
        0.03,
        0xffffff,
        0.05,
        id === 'katana' ? 0.49 : 0.21,
        0,
      );
    }
    g.rotation.z = -0.22;
    g.rotation.x = -0.25;
  } else {
    const long = id === 'sniper' ? 1.1 : id === 'pistol' ? 0.42 : 0.83;
    box(g, 0.24, 0.23, long, 0x273a43, 0, 0, -long * 0.28);
    box(
      g,
      0.19,
      0.12,
      long * 0.75,
      id === 'laser' ? 0xe8ddc7 : 0x76968c,
      0,
      0.16,
      -long * 0.26,
    );
    const grip = box(g, 0.14, 0.32, 0.18, 0x34434b, 0, -0.22, 0.08);
    grip.rotation.x = -0.16;
    box(g, 0.14, 0.13, 0.25, 0x172c33, 0, 0, -long * 0.85);
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.07, 0.04),
      new THREE.MeshBasicMaterial({ color: w.color }),
    );
    glow.position.set(0, 0, -long * 0.99);
    g.add(glow);
    if (id === 'laser') {
      for (let i = 0; i < 3; i++)
        box(g, 0.253, 0.05, 0.065, 0xff4c56, 0, 0.03, -0.12 - i * 0.15);
      box(g, 0.05, 0.055, 0.32, 0xff5a64, 0.125, 0.09, -0.24);
    }
    if (id === 'sniper') {
      const scope = cylinder(g, 0.07, 0.07, 0.4, 0x253c45, 0, 0.25, -0.25);
      scope.rotation.x = Math.PI / 2;
      const glass = cylinder(g, 0.048, 0.048, 0.008, 0x77e7e2, 0, 0.25, -0.454);
      glass.rotation.x = Math.PI / 2;
    }
  }
  if (firstPerson) {
    box(g, 0.17, 0.26, 0.22, 0x52716a, 0.035, -0.28, 0.13);
    box(g, 0.15, 0.13, 0.15, 0xefc6a1, 0.025, -0.15, 0.08);
  }
  return g;
}
export function makeRobot(a: Actor): THREE.Group {
  const g = new THREE.Group();
  const blue = a.team === 'squad',
    color = blue ? 0x48adac : 0xd76c52,
    dark = blue ? 0x295869 : 0x683d3b;
  box(g, 0.63, 0.62, 0.36, color, 0, 1.07, 0);
  box(g, 0.45, 0.2, 0.42, dark, 0, 0.68, 0);
  box(g, 0.57, 0.43, 0.46, 0xe6dfc9, 0, 1.64, 0);
  box(g, 0.47, 0.19, 0.07, 0x263e49, 0, 1.66, -0.25);
  box(g, 0.33, 0.035, 0.075, blue ? 0x8ffff0 : 0xffc967, 0, 1.66, -0.255);
  box(g, 0.48, 0.075, 0.46, color, 0, 1.88, 0);
  box(g, 0.18, 0.27, 0.07, 0xeae3ca, 0, 1.13, -0.2);
  const left = new THREE.Group(),
    right = new THREE.Group();
  left.position.set(-0.18, 0.67, 0);
  right.position.set(0.18, 0.67, 0);
  g.add(left, right);
  box(left, 0.22, 0.46, 0.24, dark, 0, -0.23, 0);
  box(right, 0.22, 0.46, 0.24, dark, 0, -0.23, 0);
  box(left, 0.26, 0.15, 0.34, 0x273c40, 0, -0.56, -0.04);
  box(right, 0.26, 0.15, 0.34, 0x273c40, 0, -0.56, -0.04);
  const arm = box(g, 0.21, 0.53, 0.23, color, 0.43, 1.08, -0.1);
  arm.rotation.x = -0.4;
  box(g, 0.21, 0.5, 0.23, color, -0.43, 1.08, -0.1).rotation.x = -0.3;
  const weapon = makeWeapon(a.weapon);
  weapon.position.set(0.4, 0.99, -0.42);
  weapon.scale.setScalar(0.72);
  g.add(weapon);
  if (blue) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.57, 0.65, 24),
      new THREE.MeshBasicMaterial({
        color: 0x7bffe3,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    g.add(ring);
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.14),
      new THREE.MeshBasicMaterial({ color: 0x8bffe2 }),
    );
    diamond.position.y = 2.23;
    g.add(diamond);
  }
  g.userData = { left, right, weapon };
  return g;
}
export function disposeObject(object: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>();
  object.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        materials.add(m);
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => {
    const texture = (m as THREE.MeshStandardMaterial).map;
    texture?.dispose();
    m.dispose();
  });
  matCache.clear();
}
export class ArenaView {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(68, 1, 0.08, 250);
  arena: THREE.Group;
  actors = new Map<string, THREE.Group>();
  private resizeObserver: ResizeObserver;
  constructor(
    public canvas: HTMLCanvasElement,
    public world: World,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.scene.background = new THREE.Color(0xaecfd1);
    this.scene.fog = new THREE.Fog(0xaecfd1, 70, 175);
    this.scene.add(new THREE.HemisphereLight(0xe5f6ff, 0x8b9c52, 2.3));
    const sun = new THREE.DirectionalLight(0xffeed0, 3.1);
    sun.position.set(-28, 55, 22);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -65;
    sun.shadow.camera.right = 65;
    sun.shadow.camera.top = 65;
    sun.shadow.camera.bottom = -65;
    sun.shadow.camera.far = 150;
    sun.shadow.normalBias = 0.04;
    sun.shadow.bias = -0.0002;
    this.scene.add(sun);
    this.arena = createArena(world);
    this.scene.add(this.arena);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }
  resize() {
    const w = this.canvas.clientWidth,
      h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  setWorld(world: World) {
    disposeObject(this.arena);
    this.scene.remove(this.arena);
    this.world = world;
    this.arena = createArena(world);
    this.scene.add(this.arena);
    for (const m of this.actors.values()) {
      this.scene.remove(m);
      disposeObject(m);
    }
    this.actors.clear();
  }
  syncActors(actors: Actor[], t: number) {
    for (const a of actors) {
      let mesh = this.actors.get(a.id);
      if (!mesh) {
        mesh = makeRobot(a);
        this.actors.set(a.id, mesh);
        this.scene.add(mesh);
      }
      mesh.visible = a.hp > 0;
      mesh.position.set(a.x, a.y, a.z);
      mesh.rotation.y = a.yaw;
      const moving = a.path.length > 0;
      mesh.userData.left.rotation.x = moving ? Math.sin(t * 10) * 0.38 : 0;
      mesh.userData.right.rotation.x = moving ? -Math.sin(t * 10) * 0.38 : 0;
      mesh.scale.setScalar(a.hit > 0 ? 1.05 : 1);
    }
  }
  orbit(t: number) {
    const angle = -0.25 + Math.sin(t * 0.07) * 0.13;
    this.camera.position.set(
      52 * Math.cos(angle),
      36,
      55 + Math.sin(angle) * 10,
    );
    this.camera.lookAt(-5, 0, -5);
  }
  render() {
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.resizeObserver.disconnect();
    disposeObject(this.scene);
    this.renderer.dispose();
  }
}
