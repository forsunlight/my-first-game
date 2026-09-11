export type Vec3 = { x: number; y: number; z: number };
export type WeaponId =
  | 'laser'
  | 'katana'
  | 'dagger'
  | 'sniper'
  | 'pistol'
  | 'staff';
export type Team = 'squad' | 'enemy';
export type Weapon = {
  name: string;
  label: string;
  damage: number;
  interval: number;
  range: number;
  speed: number;
  length: number;
  color: number;
  melee: boolean;
};
export const WEAPONS: Record<WeaponId, Weapon> = {
  laser: {
    name: '分节激光枪',
    label: 'RED PULSE',
    damage: 26,
    interval: 0.19,
    range: 82,
    speed: 66,
    length: 1.5,
    color: 0xff304e,
    melee: false,
  },
  katana: {
    name: '武士刀',
    label: 'KATANA',
    damage: 65,
    interval: 0.65,
    range: 3.2,
    speed: 0,
    length: 0,
    color: 0xdaf4ff,
    melee: true,
  },
  dagger: {
    name: '匕首',
    label: 'DAGGER',
    damage: 38,
    interval: 0.32,
    range: 2.5,
    speed: 0,
    length: 0,
    color: 0xe4faff,
    melee: true,
  },
  sniper: {
    name: '狙击枪',
    label: 'LONGSHOT',
    damage: 100,
    interval: 1.4,
    range: 130,
    speed: 180,
    length: 5,
    color: 0xffe3a0,
    melee: false,
  },
  pistol: {
    name: '手枪',
    label: 'SIDEKICK',
    damage: 35,
    interval: 0.38,
    range: 55,
    speed: 92,
    length: 0.7,
    color: 0xffd481,
    melee: false,
  },
  staff: {
    name: '金箍棒',
    label: 'GOLDEN STAFF',
    damage: 78,
    interval: 0.85,
    range: 4.5,
    speed: 0,
    length: 0,
    color: 0xffcd39,
    melee: true,
  },
};
export const WEAPON_ORDER: WeaponId[] = [
  'laser',
  'pistol',
  'sniper',
  'katana',
  'dagger',
  'staff',
];
export type Building = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  ramp: number;
  color: number;
};
export type Rock = {
  x: number;
  z: number;
  radius: number;
  h: number;
  rotation: number;
};
export type World = {
  buildings: Building[];
  rocks: Rock[];
  spawnBuilding: number;
  enemySpawns: Vec3[];
  size: number;
};
export type Actor = Vec3 & {
  id: string;
  team: Team;
  hp: number;
  radius: number;
  weapon: WeaponId;
  vy: number;
  yaw: number;
  cooldown: number;
  hit: number;
  kills: number;
  path: Vec3[];
  repath: number;
};
export type Match = {
  player: Actor;
  buddy: Actor;
  enemies: Actor[];
  time: number;
};
export function seededRandom(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function surfaceAt(world: World, x: number, z: number): number {
  let height = 0;
  for (const b of world.buildings) {
    if (Math.abs(x - b.x) <= b.w / 2 && Math.abs(z - b.z) <= b.d / 2)
      height = Math.max(height, b.h);
    const start = b.x + b.w / 2;
    if (x >= start && x <= start + b.ramp && Math.abs(z - b.z) <= 2)
      height = Math.max(height, b.h * (1 - (x - start) / b.ramp));
  }
  return height;
}
export function canMove(
  world: World,
  actor: { y: number; radius: number },
  x: number,
  z: number,
): boolean {
  const r = actor.radius;
  if (Math.abs(x) > world.size / 2 - r || Math.abs(z) > world.size / 2 - r)
    return false;
  for (const [dx, dz] of [
    [0, 0],
    [-r, 0],
    [r, 0],
    [0, -r],
    [0, r],
  ]) {
    if (surfaceAt(world, x + dx, z + dz) > actor.y + 0.55) return false;
  }
  return !world.rocks.some(
    (rock) =>
      actor.y < rock.h && Math.hypot(x - rock.x, z - rock.z) < rock.radius + r,
  );
}
export function createWorld(random = Math.random): World {
  const world: World = {
    size: 100,
    spawnBuilding: Math.floor(random() * 5),
    rocks: [],
    enemySpawns: [],
    buildings: [
      { x: -26, z: -24, w: 10, d: 10, h: 5, ramp: 12, color: 0xeb985e },
      { x: 12, z: -26, w: 10, d: 10, h: 6, ramp: 12, color: 0x5b9fa2 },
      { x: -28, z: 14, w: 10, d: 10, h: 4, ramp: 12, color: 0x7f9c7e },
      { x: 12, z: 16, w: 10, d: 10, h: 5, ramp: 12, color: 0xe9b853 },
      { x: -8, z: 36, w: 10, d: 10, h: 4, ramp: 12, color: 0x5b9fa2 },
    ],
  };
  const clear = (x: number, z: number, margin: number) =>
    world.buildings.every(
      (b) =>
        !(
          x > b.x - b.w / 2 - margin &&
          x < b.x + b.w / 2 + b.ramp + margin &&
          Math.abs(z - b.z) < b.d / 2 + margin
        ),
    );
  for (
    let attempts = 0;
    world.rocks.length < 9 && attempts < 1000;
    attempts++
  ) {
    const x = (random() - 0.5) * 86,
      z = (random() - 0.5) * 86;
    if (
      Math.hypot(x, z) < 12 ||
      !clear(x, z, 3) ||
      world.rocks.some((r) => Math.hypot(x - r.x, z - r.z) < 5)
    )
      continue;
    world.rocks.push({
      x,
      z,
      radius: 0.8 + random() * 0.65,
      h: 1.1 + random() * 0.9,
      rotation: random() * Math.PI,
    });
  }
  for (
    let attempts = 0;
    world.enemySpawns.length < 10 && attempts < 5000;
    attempts++
  ) {
    const x = (random() - 0.5) * 86,
      z = (random() - 0.5) * 86;
    const spawn = world.buildings[world.spawnBuilding];
    if (
      !clear(x, z, 1.5) ||
      !canMove(world, { y: 0, radius: 0.5 }, x, z) ||
      Math.hypot(x - spawn.x, z - spawn.z) < 12 ||
      world.enemySpawns.some((e) => Math.hypot(x - e.x, z - e.z) < 5)
    )
      continue;
    world.enemySpawns.push({ x, y: 0, z });
  }
  return world;
}
function actor(id: string, p: Vec3, team: Team, weapon: WeaponId): Actor {
  return {
    ...p,
    id,
    team,
    weapon,
    hp: 100,
    radius: 0.4,
    vy: 0,
    yaw: 0,
    cooldown: 1.5,
    hit: 0,
    kills: 0,
    path: [],
    repath: 0,
  };
}
export function createMatch(world: World): Match {
  const b = world.buildings[world.spawnBuilding];
  const arms: WeaponId[] = ['katana', 'dagger', 'sniper', 'pistol', 'staff'];
  return {
    player: actor('player', { x: b.x, y: b.h, z: b.z }, 'squad', 'laser'),
    buddy: actor('buddy', { x: b.x + 2, y: b.h, z: b.z + 1 }, 'squad', 'laser'),
    enemies: world.enemySpawns.map((p, i) =>
      actor(`enemy-${i}`, p, 'enemy', arms[i % arms.length]),
    ),
    time: 0,
  };
}
export function moveActor(
  world: World,
  a: Actor,
  dx: number,
  dz: number,
  dt: number,
) {
  // Horizontal sliding, continuous slopes and gravity; feet never pass below terrain.
  if (canMove(world, a, a.x + dx, a.z)) a.x += dx;
  if (canMove(world, a, a.x, a.z + dz)) a.z += dz;
  const floor = surfaceAt(world, a.x, a.z);
  a.vy -= 22 * dt;
  a.y += a.vy * dt;
  if (a.y <= floor) {
    a.y = floor;
    a.vy = 0;
  }
}
export function distance(a: Vec3, b: Vec3) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
export function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

// A navigation edge must be walkable by the same footprint as a moving actor.
// Endpoint heights alone admit impossible approaches through the side of a ramp.
function walkableSegment(world: World, from: Vec3, to: Vec3): boolean {
  const steps = Math.max(
    1,
    Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.16),
  );
  let y = surfaceAt(world, from.x, from.z);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps,
      x = from.x + (to.x - from.x) * t,
      z = from.z + (to.z - from.z) * t;
    const floor = surfaceAt(world, x, z);
    if (
      Math.abs(floor - y) > 0.24 ||
      !canMove(world, { y, radius: 0.45 }, x, z)
    )
      return false;
    y = floor;
  }
  return true;
}
const navigationEdges = new WeakMap<World, Map<string, boolean>>();

// A* over a two-metre grid. Elevation-aware edges let actors use ramps without teleporting onto roofs.
export function findPath(world: World, from: Vec3, to: Vec3): Vec3[] {
  const step = 2,
    half = 48,
    width = 49;
  const key = (x: number, z: number) =>
    Math.round((z + half) / step) * width + Math.round((x + half) / step);
  const coords = (k: number): Vec3 => {
    const x = (k % width) * step - half,
      z = Math.floor(k / width) * step - half;
    return { x, y: surfaceAt(world, x, z), z };
  };
  const snap = (p: Vec3) =>
    key(
      Math.max(-half, Math.min(half, p.x)),
      Math.max(-half, Math.min(half, p.z)),
    );
  const reachableNode = (point: Vec3): number | undefined => {
    const center = coords(snap(point)),
      candidates: number[] = [];
    for (let dx = -4; dx <= 4; dx += step)
      for (let dz = -4; dz <= 4; dz += step) {
        const x = center.x + dx,
          z = center.z + dz;
        if (Math.abs(x) <= half && Math.abs(z) <= half)
          candidates.push(key(x, z));
      }
    candidates.sort(
      (a, b) => distance(coords(a), point) - distance(coords(b), point),
    );
    return candidates.find(
      (k) =>
        walkableSegment(world, point, coords(k)) &&
        walkableSegment(world, coords(k), point),
    );
  };
  const start = reachableNode(from),
    end = reachableNode(to);
  if (start === undefined || end === undefined) return [];
  let edges = navigationEdges.get(world);
  if (!edges) {
    edges = new Map();
    navigationEdges.set(world, edges);
  }
  const heuristic = (k: number) => {
    const p = coords(k),
      q = coords(end);
    return Math.abs(p.x - q.x) + Math.abs(p.z - q.z);
  };
  const scores = new Map<number, number>([[start, 0]]),
    parents = new Map<number, number>();
  const closed = new Set<number>();
  const heap: { k: number; f: number }[] = [];
  const push = (k: number, f: number) => {
    heap.push({ k, f });
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].f <= f) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const first = heap[0],
      last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      while (true) {
        let s = i;
        const l = 2 * i + 1,
          r = l + 1;
        if (l < heap.length && heap[l].f < heap[s].f) s = l;
        if (r < heap.length && heap[r].f < heap[s].f) s = r;
        if (s === i) break;
        [heap[i], heap[s]] = [heap[s], heap[i]];
        i = s;
      }
    }
    return first.k;
  };
  push(start, heuristic(start));
  while (heap.length) {
    const k = pop();
    if (closed.has(k)) continue;
    if (k === end) {
      const path: Vec3[] = [];
      let cursor = k;
      while (cursor !== start) {
        path.unshift(coords(cursor));
        cursor = parents.get(cursor)!;
      }
      if (path.length === 0 || !walkableSegment(world, from, path[0]))
        path.unshift(coords(start));
      const goal = { x: to.x, y: surfaceAt(world, to.x, to.z), z: to.z };
      if (distance(path[path.length - 1], goal) > 0.1) path.push(goal);
      return path;
    }
    closed.add(k);
    const p = coords(k);
    for (const [dx, dz] of [
      [step, 0],
      [-step, 0],
      [0, step],
      [0, -step],
    ]) {
      const x = p.x + dx,
        z = p.z + dz;
      if (Math.abs(x) > half || Math.abs(z) > half) continue;
      const next = key(x, z),
        q = coords(next);
      if (closed.has(next) || Math.abs(q.y - p.y) > 1.05) continue;
      const edgeKey = k < next ? `${k}:${next}` : `${next}:${k}`;
      if (!edges.has(edgeKey))
        edges.set(
          edgeKey,
          walkableSegment(world, p, q) && walkableSegment(world, q, p),
        );
      if (!edges.get(edgeKey)) continue;
      const cost = scores.get(k)! + step + Math.abs(q.y - p.y) * 0.2;
      if (cost < (scores.get(next) ?? Infinity)) {
        scores.set(next, cost);
        parents.set(next, k);
        push(next, cost + heuristic(next));
      }
    }
  }
  return [];
}
function rayBox(
  o: Vec3,
  d: Vec3,
  min: Vec3,
  max: Vec3,
  range: number,
): number | null {
  let near = 0,
    far = range;
  for (const axis of ['x', 'y', 'z'] as const) {
    if (Math.abs(d[axis]) < 1e-8) {
      if (o[axis] < min[axis] || o[axis] > max[axis]) return null;
      continue;
    }
    const a = (min[axis] - o[axis]) / d[axis],
      b = (max[axis] - o[axis]) / d[axis];
    near = Math.max(near, Math.min(a, b));
    far = Math.min(far, Math.max(a, b));
    if (near > far) return null;
  }
  return near;
}
function rayRamp(o: Vec3, d: Vec3, b: Building, range: number): number | null {
  const left = b.x + b.w / 2,
    right = left + b.ramp;
  // Convex wedge described by six half-spaces n·p <= c.
  const planes = [
    { n: { x: 1, y: 0, z: 0 }, c: right },
    { n: { x: -1, y: 0, z: 0 }, c: -left },
    { n: { x: 0, y: 0, z: 1 }, c: b.z + 2 },
    { n: { x: 0, y: 0, z: -1 }, c: 2 - b.z },
    { n: { x: 0, y: -1, z: 0 }, c: 0 },
    { n: { x: b.h / b.ramp, y: 1, z: 0 }, c: (right * b.h) / b.ramp },
  ];
  let enter = 0,
    leave = range;
  for (const { n, c } of planes) {
    const numerator = c - n.x * o.x - n.y * o.y - n.z * o.z,
      den = n.x * d.x + n.y * d.y + n.z * d.z;
    if (Math.abs(den) < 1e-8) {
      if (numerator < 0) return null;
      continue;
    }
    const t = numerator / den;
    if (den < 0) enter = Math.max(enter, t);
    else leave = Math.min(leave, t);
    if (enter > leave) return null;
  }
  return enter;
}
export type Hit = { distance: number; point: Vec3; actor?: Actor };
export function traceShot(
  world: World,
  origin: Vec3,
  dir: Vec3,
  targets: Actor[],
  range: number,
): Hit | null {
  let closest = range;
  let found = false;
  let target: Actor | undefined;
  const consider = (n: number | null, a?: Actor) => {
    if (n !== null && n >= 0 && n < closest) {
      closest = n;
      found = true;
      target = a;
    }
  };
  for (const b of world.buildings) {
    consider(
      rayBox(
        origin,
        dir,
        { x: b.x - b.w / 2, y: 0, z: b.z - b.d / 2 },
        { x: b.x + b.w / 2, y: b.h, z: b.z + b.d / 2 },
        closest,
      ),
    );
    consider(rayRamp(origin, dir, b, closest));
  }
  for (const r of world.rocks)
    consider(
      rayBox(
        origin,
        dir,
        { x: r.x - r.radius, y: 0, z: r.z - r.radius },
        { x: r.x + r.radius, y: r.h, z: r.z + r.radius },
        closest,
      ),
    );
  if (dir.y < 0) consider(-origin.y / dir.y);
  for (const a of targets) {
    if (a.hp <= 0) continue;
    consider(
      rayBox(
        origin,
        dir,
        { x: a.x - a.radius, y: a.y + 0.1, z: a.z - a.radius },
        { x: a.x + a.radius, y: a.y + 1.9, z: a.z + a.radius },
        closest,
      ),
      a,
    );
  }
  return found
    ? {
        distance: closest,
        point: {
          x: origin.x + dir.x * closest,
          y: origin.y + dir.y * closest,
          z: origin.z + dir.z * closest,
        },
        actor: target,
      }
    : null;
}
export function applyDamage(
  target: Actor,
  damage: number,
  source: Team,
): boolean {
  if (target.team === source || target.hp <= 0) return false;
  target.hp = Math.max(0, target.hp - damage);
  target.hit = 0.18;
  return target.hp === 0;
}
export function outcome(m: Match): 'playing' | 'won' | 'lost' {
  if (m.player.hp <= 0) return 'lost';
  if (m.enemies.every((e) => e.hp <= 0)) return 'won';
  return 'playing';
}
