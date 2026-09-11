import {
  createMatch,
  moveActor,
  surfaceAt,
  normalize,
  distance,
  findPath,
  traceShot,
  applyDamage,
  outcome,
  WEAPONS,
  seededRandom,
  type Actor,
  type World,
  type Vec3,
  type WeaponId,
  type Team,
} from './rules.ts';
export type GameStatus = 'menu' | 'playing' | 'paused' | 'won' | 'lost';
export type Controls = {
  forward?: number;
  strafe?: number;
  yaw?: number;
  pitch?: number;
  fire?: boolean;
  jump?: boolean;
  assist?: boolean;
};
export type Projectile = Vec3 & {
  id: number;
  direction: Vec3;
  speed: number;
  range: number;
  travelled: number;
  damage: number;
  team: Team;
  owner: string;
  weapon: WeaponId;
};
export type GameEvent = {
  type: 'shot' | 'hit' | 'defeat' | 'hurt' | 'revive';
  point: Vec3;
  weapon?: WeaponId;
  owner?: string;
  target?: string;
};
export class Simulation {
  world: World;
  match;
  status: GameStatus = 'menu';
  projectiles: Projectile[] = [];
  events: GameEvent[] = [];
  buddyMode: 'follow' | 'cover' = 'follow';
  pitch = 0;
  private serial = 0;
  private random = seededRandom(813);
  private lastDamage = -10;
  private reviveTimer = 0;
  constructor(world: World) {
    this.world = world;
    this.match = createMatch(world);
  }
  start() {
    this.status = 'playing';
    this.match.player.cooldown = 0;
  }
  pause() {
    if (this.status === 'playing') this.status = 'paused';
  }
  resume() {
    if (this.status === 'paused') this.status = 'playing';
  }
  command(mode: 'follow' | 'cover') {
    this.buddyMode = mode;
    this.match.buddy.path = [];
    this.match.buddy.repath = 0;
  }
  update(dt: number, input: Controls) {
    if (this.status !== 'playing') return;
    dt = Math.min(dt, 0.05);
    this.events = [];
    this.match.time += dt;
    const { player: p, buddy: b, enemies } = this.match;
    for (const a of [p, b, ...enemies]) {
      a.cooldown = Math.max(0, a.cooldown - dt);
      a.hit = Math.max(0, a.hit - dt);
      a.repath -= dt;
    }
    if (input.yaw !== undefined) p.yaw = input.yaw;
    if (input.pitch !== undefined) this.pitch = input.pitch;
    let f = input.forward ?? 0,
      s = input.strafe ?? 0;
    const mag = Math.max(1, Math.hypot(f, s));
    f /= mag;
    s /= mag;
    if (input.jump && p.y <= surfaceAt(this.world, p.x, p.z) + 0.04) p.vy = 8.2;
    moveActor(
      this.world,
      p,
      (-Math.sin(p.yaw) * f + Math.cos(p.yaw) * s) * 6.6 * dt,
      (-Math.cos(p.yaw) * f - Math.sin(p.yaw) * s) * 6.6 * dt,
      dt,
    );
    if (input.fire && p.cooldown <= 0) {
      const aim = {
        x: -Math.sin(p.yaw) * Math.cos(this.pitch),
        y: Math.sin(this.pitch),
        z: -Math.cos(p.yaw) * Math.cos(this.pitch),
      };
      this.shoot(p, aim, input.assist !== false);
    }
    if (b.hp > 0) {
      const target = this.closestVisible(b, enemies, 36);
      if (this.buddyMode === 'follow' && distance(b, p) > 3.4)
        this.walkTo(b, p, 5.5, dt);
      else {
        b.path = [];
        moveActor(this.world, b, 0, 0, dt);
      }
      if (target) {
        const dir = normalize({
          x: target.x - b.x,
          y: target.y - b.y - 0.25,
          z: target.z - b.z,
        });
        b.yaw = Math.atan2(-dir.x, -dir.z);
        if (b.cooldown <= 0) this.shoot(b, dir, false);
      }
      this.reviveTimer = 0;
      if (this.match.time - this.lastDamage > 7)
        b.hp = Math.min(100, b.hp + dt * 5);
    } else {
      this.reviveTimer += dt;
      if (this.reviveTimer >= 12) {
        b.hp = 100;
        this.events.push({ type: 'revive', point: { ...b }, target: b.id });
        this.reviveTimer = 0;
      }
    }
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const candidates = [p, ...(b.hp > 0 ? [b] : [])];
      let target = candidates.reduce(
        (a, c) => (distance(e, c) < distance(e, a) ? c : a),
        p,
      );
      const visible = this.closestVisible(
        e,
        candidates,
        WEAPONS[e.weapon].melee ? 5 : 48,
      );
      if (visible) target = visible;
      const dist = distance(e, target),
        weapon = WEAPONS[e.weapon];
      if (
        visible &&
        dist < weapon.range &&
        (!weapon.melee || dist < weapon.range - 0.25)
      ) {
        e.path = [];
        moveActor(this.world, e, 0, 0, dt);
        const dir = normalize({
          x: target.x - e.x,
          y: target.y - e.y - 0.15,
          z: target.z - e.z,
        });
        e.yaw = Math.atan2(-dir.x, -dir.z);
        if (e.cooldown <= 0) {
          const spread = weapon.melee ? 0 : 0.055;
          dir.x += (this.random() - 0.5) * spread;
          dir.y += (this.random() - 0.5) * spread;
          dir.z += (this.random() - 0.5) * spread;
          this.shoot(e, normalize(dir), false);
        }
      } else this.walkTo(e, target, weapon.melee ? 2.6 : 2, dt);
    }
    this.updateProjectiles(dt);
    if (p.hp > 0 && this.match.time - this.lastDamage > 6)
      p.hp = Math.min(100, p.hp + dt * 3.5);
    const state = outcome(this.match);
    if (state !== 'playing') this.status = state;
  }
  private closestVisible(
    from: Actor,
    targets: Actor[],
    range: number,
  ): Actor | undefined {
    const origin = { x: from.x, y: from.y + 1.4, z: from.z };
    return targets
      .filter((t) => t.hp > 0 && distance(from, t) < range)
      .sort((a, b) => distance(from, a) - distance(from, b))
      .find((t) => {
        const dir = normalize({
          x: t.x - origin.x,
          y: t.y + 1.15 - origin.y,
          z: t.z - origin.z,
        });
        return (
          traceShot(this.world, origin, dir, [t], range)?.actor?.id === t.id
        );
      });
  }
  private walkTo(a: Actor, target: Vec3, speed: number, dt: number) {
    if (a.repath <= 0) {
      a.path = findPath(this.world, a, target);
      a.repath = 0.85 + this.random() * 0.4;
    }
    while (
      a.path.length &&
      Math.hypot(a.path[0].x - a.x, a.path[0].z - a.z) < 0.12
    )
      a.path.shift();
    const next = a.path[0];
    if (!next) {
      moveActor(this.world, a, 0, 0, dt);
      return;
    }
    const dx = next.x - a.x,
      dz = next.z - a.z,
      d = Math.hypot(dx, dz) || 1,
      step = Math.min(d, speed * dt);
    a.yaw = Math.atan2(-dx, -dz);
    moveActor(this.world, a, (dx / d) * step, (dz / d) * step, dt);
  }
  private damage(target: Actor, amount: number, source: Actor, point: Vec3) {
    if (target.team === source.team) return;
    const defeated = applyDamage(target, amount, source.team);
    this.events.push({
      type: 'hit',
      point: { ...point },
      owner: source.id,
      target: target.id,
    });
    if (target.team === 'squad') this.lastDamage = this.match.time;
    if (target.id === 'player')
      this.events.push({ type: 'hurt', point, owner: source.id });
    if (defeated) {
      source.kills++;
      this.events.push({
        type: 'defeat',
        point: { x: target.x, y: target.y + 1, z: target.z },
        owner: source.id,
        target: target.id,
      });
    }
  }
  private shoot(a: Actor, direction: Vec3, assist: boolean) {
    const weapon = WEAPONS[a.weapon],
      player = a.id === 'player';
    a.cooldown = player
      ? weapon.interval
      : a.team === 'squad'
        ? 0.44
        : weapon.interval + 1.1;
    const origin = { x: a.x, y: a.y + (player ? 1.62 : 1.4), z: a.z };
    const targets =
      a.team === 'squad'
        ? this.match.enemies
        : [this.match.player, this.match.buddy];
    if ((assist || weapon.melee) && player) {
      let bestDot = weapon.melee ? 0.68 : 0.988;
      for (const t of targets) {
        if (t.hp <= 0) continue;
        const dir = normalize({
          x: t.x - origin.x,
          y: t.y + 1.1 - origin.y,
          z: t.z - origin.z,
        });
        const dot =
          dir.x * direction.x + dir.y * direction.y + dir.z * direction.z;
        if (
          dot > bestDot &&
          traceShot(this.world, origin, dir, [t], weapon.range)?.actor?.id ===
            t.id
        ) {
          bestDot = dot;
          direction = dir;
        }
      }
    }
    this.events.push({
      type: 'shot',
      point: origin,
      weapon: a.weapon,
      owner: a.id,
    });
    const damage = player
      ? weapon.damage
      : a.team === 'squad'
        ? 18
        : Math.min(22, weapon.damage * 0.25);
    if (weapon.melee) {
      const hit = traceShot(
        this.world,
        origin,
        direction,
        targets,
        weapon.range,
      );
      if (hit?.actor) this.damage(hit.actor, damage, a, hit.point);
    } else
      this.projectiles.push({
        ...origin,
        id: ++this.serial,
        direction,
        speed:
          a.team === 'enemy' ? (a.weapon === 'sniper' ? 38 : 24) : weapon.speed,
        range: weapon.range,
        travelled: 0,
        damage,
        team: a.team,
        owner: a.id,
        weapon: a.weapon,
      });
  }
  private updateProjectiles(dt: number) {
    this.projectiles = this.projectiles.filter((p) => {
      const step = Math.min(p.speed * dt, p.range - p.travelled);
      const targets =
        p.team === 'squad'
          ? this.match.enemies
          : [this.match.player, this.match.buddy];
      const hit = traceShot(this.world, p, p.direction, targets, step + 0.0001);
      if (hit) {
        if (hit.actor) {
          const source = [
            this.match.player,
            this.match.buddy,
            ...this.match.enemies,
          ].find((a) => a.id === p.owner)!;
          this.damage(hit.actor, p.damage, source, hit.point);
        } else
          this.events.push({ type: 'hit', point: hit.point, owner: p.owner });
        return false;
      }
      p.x += p.direction.x * step;
      p.y += p.direction.y * step;
      p.z += p.direction.z * step;
      p.travelled += step;
      return p.travelled < p.range && p.y > -0.1;
    });
  }
}
