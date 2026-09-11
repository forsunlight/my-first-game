'use client';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import {
  Crosshair,
  ArrowUpRight,
  Volume2,
  VolumeX,
  Shield,
  Users,
  MoveUpRight,
  Pause,
  Play,
  RotateCcw,
  Heart,
  ArrowUp,
  Footprints,
  ScanLine,
  Zap,
  Sword,
  CircleDot,
  Minus,
  Maximize,
  Home as HomeIcon,
  Trophy,
  Smartphone,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { WEAPONS, WEAPON_ORDER, type WeaponId } from '../game/rules';
import type { GameEngine, HUD } from '../game/engine';
import { registerGameTools } from '../game/webmcp';

const INITIAL: HUD = {
  status: 'menu',
  hp: 100,
  buddyHp: 100,
  remaining: 10,
  time: 0,
  kills: 0,
  buddyKills: 0,
  weapon: 'laser',
  mode: 'follow',
  hit: false,
  hurt: false,
  scoped: false,
  touch: false,
  muted: false,
  toast: '',
  buddyDistance: 0,
  spawn: 1,
};
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0')}`;
const WeaponIcon = ({ id, size = 21 }: { id: WeaponId; size?: number }) =>
  id === 'laser' ? (
    <Zap size={size} />
  ) : id === 'katana' || id === 'dagger' ? (
    <Sword size={size} />
  ) : id === 'sniper' ? (
    <ScanLine size={size} />
  ) : id === 'staff' ? (
    <Minus size={size} />
  ) : (
    <CircleDot size={size} />
  );

export default function Home() {
  const canvas = useRef<HTMLCanvasElement>(null),
    map = useRef<HTMLCanvasElement>(null),
    engine = useRef<GameEngine | null>(null);
  const stick = useRef<HTMLDivElement>(null),
    knob = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<HUD>(INITIAL),
    [ready, setReady] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false,
      unregister = () => {};
    import('../game/engine')
      .then(({ GameEngine }) => {
        if (cancelled || !canvas.current) return;
        engine.current = new GameEngine(canvas.current, setHud);
        setReady(true);
        unregister = registerGameTools(engine.current);
      })
      .catch((e: unknown) => {
        console.error('Game initialization failed', e);
        setError('3D 画面未能启动，请更新 Safari 或 Chrome 后重新打开。');
      });
    return () => {
      cancelled = true;
      unregister();
      engine.current?.dispose();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    engine.current?.setMinimap(map.current);
    return () => engine.current?.setMinimap(null);
  }, [hud.status, ready]);
  useEffect(() => {
    if (stick.current && knob.current && engine.current)
      return engine.current.input.bindJoystick(stick.current, knob.current);
  }, [hud.status, hud.touch, ready]);
  const playing = hud.status === 'playing',
    menu = hud.status === 'menu',
    result = hud.status === 'won' || hud.status === 'lost';
  const start = () => {
    setError('');
    try {
      engine.current?.start();
    } catch (e) {
      console.error(e);
      setError('战场未能开始，请刷新后再试。');
    }
  };
  const fireDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    if (engine.current && playing) engine.current.input.fire = true;
  };
  const fireUp = () => {
    if (engine.current) engine.current.input.fire = false;
  };
  const fullscreen = () => {
    const root = document.documentElement;
    if (!document.fullscreenElement)
      void root.requestFullscreen?.().catch(() => {});
    else void document.exitFullscreen?.().catch(() => {});
  };
  return (
    <main
      className={`game-shell ${hud.touch ? 'is-touch' : ''} ${playing ? 'in-game' : ''}`}
    >
      <canvas
        ref={canvas}
        className="world-canvas"
        aria-label="草坪战场三维画面"
        tabIndex={-1}
      />
      {menu && (
        <>
          <div className="menu-shade" />
          <header className="topbar">
            <div className="brand">
              <Crosshair size={26} />
              <span>
                FIELD<span className="brand-light">/</span>OPS
              </span>
              <i>草坪突击队</i>
            </div>
            <div className="top-meta">
              <span className="status-dot" /> 双人小队 · 合作行动{' '}
              <button
                className="icon-button"
                onClick={() => engine.current?.toggleMute()}
                aria-label={hud.muted ? '开启声音' : '关闭声音'}
              >
                {hud.muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
              </button>
            </div>
          </header>
          <section className="start-panel">
            <div className="eyebrow">
              <span /> OPERATION 01 <i>一起出发</i>
            </div>
            <h1>
              草坪
              <span>
                突击队<span className="title-period">.</span>
              </span>
            </h1>
            <p className="intro">
              带上你的激光枪。
              <br />
              这一次，你有一个可靠的 AI 队友。
            </p>
            <div className="squad-card">
              <div className="squad-avatar">
                <Users size={27} />
              </div>
              <div>
                <strong>
                  阿光 <span>AI 队友</span>
                </strong>
                <p>
                  <span className="status-dot" /> 已就位，等你一起出发
                </p>
              </div>
              <Shield size={24} className="squad-shield" />
            </div>
            <button className="start-button" disabled={!ready} onClick={start}>
              <span>{ready ? '出发，队友！' : '准备战场…'}</span>
              <ArrowUpRight size={27} />
            </button>
            <div className="start-note" role={error ? 'alert' : undefined}>
              {error || '清除 10 名敌人 · 和阿光一起赢下这场战斗'}
            </div>
          </section>
          <aside className="mission-tag">
            <span className="tiny-cross">+</span>
            <span>
              绿野基地<strong>GREENFIELD</strong>
            </span>
            <span className="map-coordinate">
              AREA 01
              <br />
              小队行动
            </span>
          </aside>
          <div className="weapon-note">
            <div className="red-pulses">
              <i />
              <i />
              <i />
              <i />
            </div>
            <span>
              你的原创武器<strong>红色 · 分节激光枪</strong>
            </span>
            <MoveUpRight size={20} />
          </div>
          <footer className="menu-footer">
            <span>
              <span className="keycap">W A S D</span> 移动{' '}
              <span className="keycap">鼠标</span> 瞄准射击
            </span>
            <span>
              {hud.touch ? '左摇杆移动 · 右侧滑动瞄准' : '支持 iPad 触屏'}
              <span className="footer-line" /> 横屏体验更好
            </span>
            <span className="edition">01 / FIELD EDITION</span>
          </footer>
        </>
      )}
      {!menu && (
        <>
          <div className="hud-vignette" />
          <header className="battle-header">
            <div className="brand">
              <Crosshair size={23} />
              <span>
                FIELD<span className="brand-light">/</span>OPS
              </span>
            </div>
            <div className="mission-count">
              <span className="mission-label">清除敌人</span>
              <strong>
                {10 - hud.remaining}
                <i>/ 10</i>
              </strong>
              <span className="match-clock">{clock(hud.time)}</span>
            </div>
            <div className="battle-actions">
              <button
                className="hud-icon"
                onClick={() => engine.current?.toggleMute()}
                aria-label={hud.muted ? '开启声音' : '关闭声音'}
              >
                {hud.muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <button
                className="hud-icon fullscreen-button"
                onClick={fullscreen}
                aria-label="全屏"
              >
                <Maximize size={20} />
              </button>
              <button
                className="hud-icon"
                onClick={() => engine.current?.pause()}
                aria-label="暂停游戏"
              >
                <Pause size={20} />
              </button>
            </div>
          </header>
          <div className="health-panel">
            <div className="health-heading">
              <Heart size={18} />
              <span>你</span>
              <strong className={hud.hp < 30 ? 'low-health' : ''}>
                {hud.hp}
                <small> / 100</small>
              </strong>
            </div>
            <Progress
              value={hud.hp}
              aria-label="玩家生命"
              className={`health-progress ${hud.hp < 30 ? 'low-health' : ''}`}
            />
            <div className="buddy-health">
              <Shield size={16} />
              <span>阿光</span>
              <span className="buddy-mode-label">
                {hud.buddyHp > 0
                  ? `${hud.mode === 'follow' ? '跟随中' : '掩护中'} · ${hud.buddyDistance}m`
                  : '修复中…'}
              </span>
              <strong>{hud.buddyHp}</strong>
            </div>
            <Progress
              value={hud.buddyHp}
              aria-label="阿光生命"
              className="buddy-progress"
            />
          </div>
          <aside className="minimap-panel">
            <div className="map-heading">
              <span>绿野基地</span>
              <span>N ↑</span>
            </div>
            <canvas
              ref={map}
              width={220}
              height={220}
              aria-label="小地图：浅黄为你，蓝色为队友，红色为敌人"
            />
            <div className="map-legend">
              <span>
                <i />你
              </span>
              <span>
                <i />
                阿光
              </span>
              <span>
                <i />
                敌人
              </span>
            </div>
          </aside>
          {playing && (
            <>
              <div
                className={`crosshair ${hud.hit ? 'confirmed-hit' : ''} ${hud.scoped ? 'scoped' : ''}`}
                aria-hidden="true"
              >
                <i />
                <i />
                <i />
                <i />
                <b />
              </div>
              {hud.scoped && hud.weapon === 'sniper' && (
                <div className="scope-mask" />
              )}
              {hud.hurt && <div className="damage-flash" />}
              {hud.toast && (
                <output className="buddy-message">
                  <Shield size={17} />
                  <span>{hud.toast}</span>
                </output>
              )}
              <div className="loadout">
                <div className="current-weapon">
                  <span className="weapon-label">
                    {WEAPONS[hud.weapon].label}
                  </span>
                  <strong>{WEAPONS[hud.weapon].name}</strong>
                  <span className="ammo">
                    {WEAPONS[hud.weapon].melee ? '近战' : '∞'}
                    <small>
                      {WEAPONS[hud.weapon].melee ? '靠近攻击' : '无限能量'}
                    </small>
                  </span>
                </div>
                <div className="weapon-slots" aria-label="切换武器">
                  {WEAPON_ORDER.map((id, i) => (
                    <button
                      key={id}
                      className={hud.weapon === id ? 'selected' : ''}
                      onClick={() => engine.current?.equip(id)}
                      aria-label={`装备${WEAPONS[id].name}`}
                      aria-pressed={hud.weapon === id}
                    >
                      <small>{i + 1}</small>
                      <WeaponIcon id={id} />
                      <span>
                        {id === 'laser' ? '激光枪' : WEAPONS[id].name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <button
                className="command-button"
                onClick={() => engine.current?.command()}
              >
                <Shield size={18} />
                <span>{hud.mode === 'follow' ? '掩护我' : '跟我走'}</span>
                {!hud.touch && <kbd>C</kbd>}
              </button>
              {hud.touch ? (
                <div className="touch-controls">
                  <div className="joystick" ref={stick} aria-label="移动摇杆">
                    <span className="stick-direction up">⌃</span>
                    <span className="stick-direction down">⌄</span>
                    <span className="stick-direction left">‹</span>
                    <span className="stick-direction right">›</span>
                    <div className="stick-knob" ref={knob}>
                      <Footprints size={24} />
                    </div>
                  </div>
                  <span className="look-hint">滑动右侧 · 瞄准</span>
                  <button
                    className="touch-button jump-button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      engine.current?.jump();
                    }}
                    aria-label="跳跃"
                  >
                    <ArrowUp size={24} />
                    <span>跳跃</span>
                  </button>
                  <button
                    className={`touch-button scope-button ${hud.scoped ? 'active' : ''}`}
                    onClick={() => engine.current?.scope()}
                    aria-label="切换精确瞄准"
                  >
                    <ScanLine size={25} />
                  </button>
                  <button
                    className="fire-button"
                    onPointerDown={fireDown}
                    onPointerUp={fireUp}
                    onPointerCancel={fireUp}
                    onLostPointerCapture={fireUp}
                    aria-label="按住攻击"
                  >
                    <Crosshair size={39} />
                    <span>{WEAPONS[hud.weapon].melee ? '攻击' : '开火'}</span>
                  </button>
                </div>
              ) : (
                <div className="keyboard-hints">
                  <span>
                    <kbd>WASD</kbd> 移动
                  </span>
                  <span>
                    <kbd>空格</kbd> 跳跃
                  </span>
                  <span>
                    <kbd>Q</kbd> 换武器
                  </span>
                  <span>
                    <kbd>右键</kbd> 瞄准
                  </span>
                  <span>
                    <kbd>Esc</kbd> 暂停
                  </span>
                </div>
              )}
            </>
          )}
        </>
      )}
      {(hud.status === 'paused' || result) && (
        <div className="pause-backdrop">
          <section
            className={`pause-screen ${result ? 'result-screen' : ''}`}
            aria-label={result ? '战斗结果' : '游戏已暂停'}
          >
            <div className="result-symbol">
              {result ? <Trophy size={38} /> : <Pause size={35} />}
            </div>
            <div className="eyebrow">
              {result
                ? hud.status === 'won'
                  ? 'MISSION COMPLETE'
                  : 'TRY TOGETHER AGAIN'
                : 'TAKE A BREATHER'}
            </div>
            <h2>
              {hud.status === 'won'
                ? '我们赢啦！'
                : hud.status === 'lost'
                  ? '再一起试一次'
                  : '休息一下'}
            </h2>
            <p>
              {hud.status === 'won'
                ? '你和阿光完成了任务，绿野基地安全了。'
                : hud.status === 'lost'
                  ? '阿光在等你。换个位置，再来一次！'
                  : '战场已暂停，阿光会等你回来。'}
            </p>
            {result ? (
              <div className="result-stats">
                <div>
                  <strong>{hud.kills}</strong>
                  <span>你的击败</span>
                </div>
                <div>
                  <strong>{hud.buddyKills}</strong>
                  <span>阿光的击败</span>
                </div>
                <div>
                  <strong>{clock(hud.time)}</strong>
                  <span>行动时间</span>
                </div>
              </div>
            ) : (
              <div className="pause-instructions">
                <span>
                  {hud.touch ? '左摇杆' : 'W A S D'}
                  <b>移动</b>
                </span>
                <span>
                  {hud.touch ? '右侧滑动' : '鼠标'}
                  <b>瞄准</b>
                </span>
                <span>
                  {hud.touch ? '按住开火' : '左键'}
                  <b>攻击</b>
                </span>
                <span>
                  {hud.touch ? '跳跃按钮' : '空格'}
                  <b>跳跃</b>
                </span>
                <span>
                  {hud.touch ? '点击武器' : '1–6 / Q'}
                  <b>换武器</b>
                </span>
                <span>
                  {hud.touch ? '掩护我' : 'C'}
                  <b>指挥阿光</b>
                </span>
              </div>
            )}
            <button
              className="start-button"
              onClick={() => (result ? start() : engine.current?.resume())}
            >
              <span>{result ? '再来一局' : '继续行动'}</span>
              {result ? <RotateCcw size={22} /> : <Play size={22} />}
            </button>
            {!result && (
              <button className="secondary-button" onClick={start}>
                <RotateCcw size={16} /> 重新开始
              </button>
            )}
            <button
              className="text-button"
              onClick={() => engine.current?.home()}
            >
              <HomeIcon size={15} /> 返回基地
            </button>
          </section>
        </div>
      )}
      <div className="portrait-hint">
        <Smartphone size={25} />
        <span>把 iPad 横过来，视野更开阔</span>
      </div>
      {error && !menu && (
        <div role="alert" className="error-banner">
          {error}
        </div>
      )}
    </main>
  );
}
