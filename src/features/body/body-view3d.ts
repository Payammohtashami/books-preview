/**
 * بیننده‌ی سه‌بعدی واقعی بدن (WebGL با three.js).
 * اجزا از buildSkeleton می‌آیند؛ دستگاه‌های دیگر بعداً با همین رابط افزوده می‌شوند.
 */
// @ts-ignore -- نوع‌ها با نصب @types/three فعال می‌شوند
import * as THREE from 'three';
// @ts-ignore
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// @ts-ignore
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildSkeleton, type MatKind } from './skeleton-3d';
import { buildMuscles } from './muscles-3d';
import { skinMesh } from './body-skin';
import { buildSkinArrays, type SkinArrays } from './body-skin-sdf';
import { buildNervous } from './nervous-3d';
import { LANDMARK_BY_ID } from './skeleton-landmarks';

export interface BodyViewState {
  visible: ReadonlySet<string>;
  selected: string | null;
  labels: boolean;
  skin: boolean;
  /** ۰ تا ۱ */
  cut: number;
  dark: boolean;
  names: Record<string, string>;
  /** رنگ حلقهٔ برچسب هر جزء */
  accents: Record<string, string>;
  /** سبک اختیاری: رنگ و شفافیت پوست و رنگ هر جزء */
  skinColor?: string;
  skinOpacity?: number;
  colors?: Record<string, string>;
  noGround?: boolean;
  /** کوچک‌کردن عرض بدن (۱ = اصلی) */
  widthScale?: number;
}
export interface BodyViewHandlers { onPick: (id: string | null) => void; onFrame?: () => void }

type NamedKind = Exclude<MatKind, `#${string}`>;
const COLORS: Record<NamedKind, string> = { bone: '#E9DCBC', cart: '#B7D6CF', dark: '#14171d', tooth: '#FBF8EF', seam: '#CFC6AE', nerve: '#F2D04F', muscle: '#B5473F', tendon: '#EFE6D2' };
const colorOf = (kind: MatKind): string => (kind.startsWith('#') ? kind : COLORS[kind as NamedKind]);
const CAM_FOV = 36;
const HALF_H = 2.0;
const HALF_W = 0.95;

interface PartInfo {
  id: string;
  group: THREE.Group;
  mats: Array<THREE.MeshStandardMaterial>;
  anchor: THREE.Vector3;
  size: number;
  label: THREE.Sprite | null;
  labelKey: string;
  /** برای نقطهٔ جزئی: شناسهٔ جزء مادر */
  parent?: string;
}

const PI_180 = Math.PI / 180;

export class BodyView3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private canvas: HTMLCanvasElement;
  private handlers: BodyViewHandlers;
  private parts = new Map<string, PartInfo>();
  private lms = new Map<string, PartInfo>();
  private skin: THREE.Group;
  private skinMat: THREE.MeshPhysicalMaterial;
  private skinTimer: ReturnType<typeof setTimeout> | null = null;
  private skinWorker: Worker | null = null;
  private disposed = false;
  private ground!: THREE.Mesh;

  /** پوست یک‌تکه در Web Worker ساخته می‌شود؛ اگر نشد، کمی بعد در همین رشته */
  private buildSkin() {
    const apply = (arrays: SkinArrays) => {
      if (this.disposed) return;
      this.skin.add(skinMesh(arrays, this.skinMat));
      this.dirty = true;
    };
    const fallback = () => {
      this.skinTimer = setTimeout(() => { this.skinTimer = null; if (!this.disposed) apply(buildSkinArrays()); }, 80);
    };
    try {
      const w = new Worker(new URL('./body-skin.worker.ts', import.meta.url));
      this.skinWorker = w;
      w.onmessage = (e: MessageEvent<SkinArrays>) => { w.terminate(); this.skinWorker = null; apply(e.data); };
      w.onerror = () => { w.terminate(); this.skinWorker = null; fallback(); };
      w.postMessage(null);
    } catch {
      fallback();
    }
  }
  private plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 10);
  private envTex: THREE.Texture;
  private pmrem: THREE.PMREMGenerator;
  private bump: THREE.CanvasTexture;
  private pickables: THREE.Object3D[] = [];
  private raycaster = new THREE.Raycaster();
  private state: BodyViewState | null = null;
  private dirty = true;
  private size = { w: 480, h: 560 };
  private running = false;
  private anim: { target: THREE.Vector3; dist: number; az: number | null } | null = null;
  private down: { x: number; y: number; t: number; id: number } | null = null;
  private labelTex = new Map<string, THREE.CanvasTexture>();
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private userMoved = false;
  private onDown = (e: PointerEvent) => { this.down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; };
  private onUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = null;
    if (!d || d.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 || performance.now() - d.t > 600) return;
    this.handlers.onPick(this.pick(e.clientX, e.clientY));
  };

  constructor(canvas: HTMLCanvasElement, handlers: BodyViewHandlers) {
    this.canvas = canvas;
    this.handlers = handlers;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.setClearColor(0x000000, 0);

    this.camera = new THREE.PerspectiveCamera(CAM_FOV, 0.85, 0.05, 60);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.minDistance = 0.45;
    this.controls.maxDistance = 9;
    this.controls.screenSpacePanning = true;
    this.controls.autoRotateSpeed = 1.6;
    this.controls.addEventListener('change', () => { this.dirty = true; });
    this.controls.addEventListener('start', () => { this.userMoved = true; this.anim = null; });

    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTex = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTex;
    this.scene.environmentIntensity = 0.55;

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x8a94a6, 0.55);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff6ea, 2.2);
    this.sun.position.set(-0.8, 9, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -1.6; sc.right = 1.6; sc.top = 2.4; sc.bottom = -2.4; sc.near = 0.5; sc.far = 14;
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.012;
    this.sun.shadow.radius = 3;
    this.scene.add(this.sun);
    const rim = new THREE.DirectionalLight(0xbcd2ff, 0.9);
    rim.position.set(3, 2, -4);
    this.scene.add(rim);

    const ground = this.ground = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.22 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -1.805; ground.receiveShadow = true;
    this.scene.add(ground);

    this.bump = this.makeBump();
    this.fiber = this.makeFiber();
    const group = new THREE.Group();
    const factory = (id: string, kind: MatKind) => this.material(id, kind);
    const built = { ...buildSkeleton(factory), ...buildNervous(factory), ...buildMuscles(factory) };
    for (const [id, g] of Object.entries(built)) {
      group.add(g);
      const mats: THREE.MeshStandardMaterial[] = [];
      g.traverse((o: THREE.Object3D) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        if (!mats.includes(m.material as THREE.MeshStandardMaterial)) mats.push(m.material as THREE.MeshStandardMaterial);
        this.pickables.push(m);
      });
      const info: PartInfo = { id, group: g, mats, anchor: new THREE.Vector3(), size: 0.3, label: null, labelKey: '' };
      this.measure(info);
      this.parts.set(id, info);
    }
    group.updateMatrixWorld(true);
    const lmBox = new Map<string, THREE.Box3>();
    const lmMats = new Map<string, THREE.MeshStandardMaterial[]>();
    group.traverse((o: THREE.Object3D) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      const owner = mat.userData.owner as string;
      if (!LANDMARK_BY_ID[owner]) return;
      const list = lmMats.get(owner) ?? [];
      if (!list.includes(mat)) list.push(mat);
      lmMats.set(owner, list);
      let p: THREE.Object3D | null = o.parent; let left = false;
      while (p) { if (p.userData.side === 'L') left = true; p = p.parent; }
      if (left) return;
      const b = lmBox.get(owner) ?? new THREE.Box3();
      b.union(new THREE.Box3().setFromObject(m));
      lmBox.set(owner, b);
    });
    for (const [id, box] of lmBox) {
      const parent = LANDMARK_BY_ID[id].parent;
      const pinfo = this.parts.get(parent);
      if (!pinfo) continue;
      const anchor = new THREE.Vector3(); box.getCenter(anchor);
      const sz = new THREE.Vector3(); box.getSize(sz);
      this.lms.set(id, { id, group: pinfo.group, mats: lmMats.get(id) ?? [], anchor, size: Math.max(sz.x, sz.y, sz.z), label: null, labelKey: '', parent });
    }
    this.scene.add(group);

    this.skinMat = new THREE.MeshPhysicalMaterial({ color: '#9FB3C8', transparent: true, opacity: 0.16, roughness: 0.3, metalness: 0, depthWrite: true, clearcoat: 0.6 });
    // پوست یک‌تکه کمی بعد از اولین نمایش ساخته می‌شود تا باز شدن مدل معطل نماند
    this.skin = new THREE.Group();
    this.skin.visible = true;
    this.scene.add(this.skin);
    this.buildSkin();

    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointerup', this.onUp);
    this.home(true);
  }

  /* ───────── مواد ───────── */

  private mats = new Map<string, THREE.MeshStandardMaterial>();
  private material(id: string, kind: MatKind): THREE.Material {
    const key = `${id}|${kind}`;
    let m = this.mats.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color: colorOf(kind),
        roughness: kind === 'muscle' ? 0.55 : kind === 'tendon' ? 0.4 : kind === 'nerve' ? 0.42 : kind === 'seam' ? 0.8 : kind === 'tooth' ? 0.35 : kind === 'dark' ? 0.9 : kind === 'cart' ? 0.5 : 0.62,
        metalness: 0,
        bumpMap: kind === 'bone' ? this.bump : kind === 'muscle' ? this.fiber : null,
        bumpScale: kind === 'bone' ? 0.8 : kind === 'muscle' ? 0.6 : 0,
        side: THREE.DoubleSide,
      });
      m.userData.owner = id;
      this.mats.set(key, m);
    }
    return m;
  }

  private fiber: THREE.CanvasTexture | null = null;
  private makeFiber(): THREE.CanvasTexture {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    g.fillStyle = '#808080'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 70; i += 1) {
      const v = 70 + Math.random() * 120;
      g.fillStyle = `rgba(${v},${v},${v},0.8)`;
      g.fillRect(Math.random() * 128, 0, 0.8 + Math.random() * 1.6, 128);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  private makeBump(): THREE.CanvasTexture {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i += 1) {
      const v = 90 + Math.random() * 80;
      g.fillStyle = `rgba(${v},${v},${v},0.5)`;
      g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 0.8 + Math.random() * 3.2, 0, Math.PI * 2); g.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3, 3);
    return tex;
  }

  /** مرکز سمت راست و اندازهٔ کل هر جزء */
  private measure(info: PartInfo) {
    info.group.updateMatrixWorld(true);
    const full = new THREE.Box3().setFromObject(info.group);
    const right = new THREE.Box3();
    info.group.children.forEach((child: THREE.Object3D) => { if (child.userData.side !== 'L') right.union(new THREE.Box3().setFromObject(child)); });
    if (right.isEmpty()) right.copy(full);
    right.getCenter(info.anchor);
    const s = new THREE.Vector3(); full.getSize(s);
    info.size = Math.max(s.x, s.y, s.z);
  }

  /* ───────── رابط ───────── */

  setState(next: BodyViewState) {
    const prev = this.state;
    this.state = next;
    for (const info of this.parts.values()) {
      const shown = next.visible.has(info.id);
      info.group.visible = shown;
      const sel = next.selected;
      const selLm = sel ? LANDMARK_BY_ID[sel] : undefined;
      const selPart = selLm ? selLm.parent : sel;
      const partFocus = selPart === info.id;
      for (const m of info.mats) {
        const dark = m.color.getHex() === parseInt(COLORS.dark.slice(1), 16);
        const owner = m.userData.owner as string;
        // نقطهٔ جزئی انتخاب‌شده: خودش پررنگ، بقیهٔ همان جزء کم‌رنگ، سایر اجزا خیلی کم‌رنگ
        const focus = sel === null ? false : selLm ? owner === sel : partFocus;
        const dim = sel !== null && !focus;
        const opacity = !dim ? 1 : selLm && partFocus ? 0.5 : 0.13;
        const wantTransparent = dim;
        if (m.transparent !== wantTransparent) { m.transparent = wantTransparent; m.needsUpdate = true; }
        m.opacity = opacity;
        m.depthWrite = !dim;
        m.emissive.set(focus && !dark ? '#F59E0B' : '#000000');
        m.emissiveIntensity = focus ? 0.38 : 0;
      }
    }
    this.skin.visible = next.skin;
    this.ground.visible = !next.noGround;
    this.scene.scale.x = next.widthScale ?? 1;
    this.scene.updateMatrixWorld(true);
    this.skinMat.opacity = next.skinOpacity ?? (next.dark ? 0.2 : 0.15);
    if (next.skinColor) this.skinMat.color.set(next.skinColor);
    if (next.colors) {
      for (const info of this.parts.values()) {
        const c = next.colors[info.id];
        if (c) for (const m of info.mats) if (m.color.getHex() !== parseInt(COLORS.dark.slice(1), 16)) m.color.set(c);
      }
    }
    this.plane.constant = 0.32 - next.cut * 0.62;
    this.renderer.clippingPlanes = next.cut > 0 ? [this.plane] : [];
    if (!prev || prev.dark !== next.dark) {
      this.scene.environmentIntensity = next.dark ? 0.4 : 0.55;
      this.hemi.intensity = next.dark ? 0.4 : 0.55;
    }
    this.updateLabels();
    this.dirty = true;
  }

  private label(text: string, accent: string): THREE.CanvasTexture {
    const key = `${accent}|${text}`;
    const cached = this.labelTex.get(key);
    if (cached) return cached;
    const font = '700 46px ui-sans-serif, system-ui, sans-serif';
    const probe = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    probe.font = font;
    const w = Math.ceil(probe.measureText(text).width) + 56;
    const c = document.createElement('canvas'); c.width = Math.max(96, w); c.height = 88;
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    g.font = font;
    g.fillStyle = 'rgba(255,255,255,0.96)'; g.strokeStyle = accent; g.lineWidth = 6;
    g.beginPath(); g.roundRect(4, 6, c.width - 8, c.height - 12, 34); g.fill(); g.stroke();
    g.fillStyle = '#0F172A'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, c.width / 2, c.height / 2 + 3);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.labelTex.set(key, tex);
    return tex;
  }

  private updateLabels() {
    const st = this.state;
    if (!st) return;
    for (const info of this.allInfos()) {
      const lm = info.parent ? LANDMARK_BY_ID[info.id] : undefined;
      const owner = info.parent ?? info.id;
      const wanted = lm
        ? st.visible.has(owner) && (st.selected === info.id || st.selected === owner)
        : st.visible.has(info.id) && (st.selected === info.id || (st.labels && st.selected === null));
      if (!wanted) { if (info.label) info.label.visible = false; continue; }
      const accent = st.accents[owner] ?? '#64748B';
      const text = lm ? lm.name : (st.names[info.id] ?? info.id);
      const key = `${accent}|${text}`;
      if (!info.label) {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false }));
        sprite.renderOrder = 30;
        this.scene.add(sprite);
        info.label = sprite;
      }
      if (info.labelKey !== key) {
        const tex = this.label(text, accent);
        const mat = info.label.material as THREE.SpriteMaterial;
        mat.map = tex; mat.needsUpdate = true;
        info.labelKey = key;
      }
      info.label.userData.want = true;
      info.label.visible = true;
    }
  }

  private allInfos(): PartInfo[] { return [...this.parts.values(), ...this.lms.values()]; }

  /** جای برچسب‌ها و پرهیز از هم‌پوشانی (در هر نمایش) */
  private placeLabels() {
    const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
    const items: Array<{ info: PartInfo; z: number; p: THREE.Vector3 }> = [];
    const selId = this.state?.selected ?? null;
    const p = new THREE.Vector3();
    for (const info of this.allInfos()) {
      if (!info.label || !info.label.visible) continue;
      p.copy(info.anchor).project(this.camera);
      items.push({ info, z: p.z, p: p.clone() });
    }
    items.sort((a, b) => (a.info.id === selId ? -1 : b.info.id === selId ? 1 : a.z - b.z));
    const dist = this.camera.position.distanceTo(this.controls.target);
    const viewH = 2 * dist * Math.tan((CAM_FOV * Math.PI) / 360);
    const h = Math.max(0.026, dist * 0.021);
    for (const it of items) {
      const sprite = it.info.label as THREE.Sprite;
      const tex = (sprite.material as THREE.SpriteMaterial).map as THREE.CanvasTexture;
      const img = tex.image as HTMLCanvasElement;
      const aspect = img.width / img.height;
      sprite.scale.set(aspect * h, h, 1);
      sprite.position.copy(it.info.anchor);
      const sx = (it.p.x * 0.5 + 0.5) * this.size.w; const sy = (-it.p.y * 0.5 + 0.5) * this.size.h;
      const bh = (h / viewH) * this.size.h; const bw = aspect * bh;
      const box = { x: sx - bw / 2, y: sy - bh / 2, w: bw, h: bh };
      const focus = this.state?.selected === it.info.id;
      if (!focus && placed.some((q) => box.x < q.x + q.w && box.x + box.w > q.x && box.y < q.y + q.h && box.y + box.h > q.y)) { sprite.visible = false; continue; }
      placed.push(box);
      sprite.visible = true;
    }
  }

  resize(w: number, h: number) {
    this.size = { w, h };
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (!this.userMoved) this.home(true);
    this.dirty = true;
  }

  private fitDistance(): number {
    const tv = Math.tan((CAM_FOV * Math.PI) / 360);
    const th = tv * this.camera.aspect;
    return Math.max(HALF_H / tv, HALF_W / th) * 1.04;
  }

  home(instant = false) {
    const dist = this.fitDistance();
    const target = new THREE.Vector3(0, 0, 0);
    const az = 0.32;
    if (instant) {
      this.userMoved = false;
      this.controls.target.copy(target);
      this.camera.position.set(Math.sin(az) * dist, 0.12 * dist, Math.cos(az) * dist);
      this.controls.update();
      this.anim = null;
    } else this.anim = { target, dist, az };
    this.dirty = true;
  }

  /** نگاه از جلو (۰)، پهلو (π/۲) یا پشت (π) */
  setYaw(yaw: number) {
    const off = this.camera.position.clone().sub(this.controls.target);
    this.anim = { target: this.controls.target.clone(), dist: off.length(), az: yaw };
    this.dirty = true;
  }

  focus(id: string) {
    const info = this.parts.get(id) ?? this.lms.get(id);
    if (!info) return;
    const dist = info.parent ? Math.max(0.55, info.size * 3 + 0.35) : Math.min(4.5, Math.max(1.0, info.size * 1.5 + 0.5));
    this.anim = { target: info.anchor.clone(), dist, az: null };
    this.dirty = true;
  }

  zoomBy(f: number) {
    const dir = this.camera.position.clone().sub(this.controls.target);
    dir.setLength(Math.min(this.controls.maxDistance, Math.max(this.controls.minDistance, dir.length() / f)));
    this.camera.position.copy(this.controls.target).add(dir);
    this.userMoved = true; this.anim = null; this.dirty = true;
  }

  /** جابه‌جایی دوربین در صفحهٔ نمایش (کسری از ارتفاع دید): dy>0 مدل را بالا می‌برد */
  panBy(dx: number, dy: number) {
    this.camera.updateMatrixWorld();
    const dist = this.camera.position.distanceTo(this.controls.target);
    const h = 2 * dist * Math.tan((this.camera.fov * PI_180) / 2);
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    const delta = right.multiplyScalar(dx * h).add(up.multiplyScalar(dy * h));
    const t = this.controls.target.clone().add(delta);
    t.y = Math.min(2.1, Math.max(-2.1, t.y)); t.x = Math.min(1.2, Math.max(-1.2, t.x));
    delta.copy(t).sub(this.controls.target);
    this.controls.target.copy(t);
    this.camera.position.add(delta);
    this.userMoved = true; this.anim = null; this.dirty = true;
  }

  setAutoRotate(on: boolean) { this.controls.autoRotate = on; this.dirty = true; }

  start() {
    if (this.running) return;
    this.running = true;
    this.renderer.setAnimationLoop(() => this.tick());
  }
  stop() { this.running = false; this.renderer.setAnimationLoop(null); }

  private tick() {
    const a = this.anim;
    if (a) {
      const off = this.camera.position.clone().sub(this.controls.target);
      const sph = new THREE.Spherical().setFromVector3(off);
      sph.radius += (a.dist - sph.radius) * 0.16;
      if (a.az !== null) {
        let d = a.az - sph.theta;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        sph.theta += d * 0.16;
        sph.phi += (Math.PI / 2 - 0.08 - sph.phi) * 0.16;
      }
      this.controls.target.lerp(a.target, 0.16);
      this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSpherical(sph));
      const done = Math.abs(a.dist - sph.radius) < 0.004 && this.controls.target.distanceTo(a.target) < 0.004 && (a.az === null || Math.abs(Math.atan2(Math.sin(a.az - sph.theta), Math.cos(a.az - sph.theta))) < 0.01);
      if (done) this.anim = null;
      this.dirty = true;
    }
    const moved = this.controls.update();
    if (this.controls.autoRotate || moved) this.dirty = true;
    if (!this.dirty) return;
    this.dirty = false;
    this.placeLabels();
    this.renderer.render(this.scene, this.camera);
    this.handlers.onFrame?.();
  }

  /** جعبهٔ جهانی یک جزء */
  partBox(id: string): { min: [number, number, number]; max: [number, number, number] } | null {
    const info = this.parts.get(id);
    if (!info) return null;
    info.group.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(info.group);
    return { min: [b.min.x, b.min.y, b.min.z], max: [b.max.x, b.max.y, b.max.z] };
  }

  /** مختصات پیکسلیِ یک نقطه‌ی سه‌بعدی روی بوم */
  project(x: number, y: number, z: number): { x: number; y: number } {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    return { x: ((v.x + 1) / 2) * r.width, y: ((1 - v.y) / 2) * r.height };
  }

  /** مرکز سمت راستِ جزء */
  partAnchor(id: string): [number, number, number] | null {
    const a = this.parts.get(id)?.anchor;
    return a ? [a.x, a.y, a.z] : null;
  }

  /** نام جزئی که زیر نقطهٔ صفحه است */
  pick(clientX: number, clientY: number): string | null {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -(((clientY - rect.top) / rect.height) * 2 - 1));
    this.raycaster.setFromCamera(ndc, this.camera);
    const targets = this.pickables.filter((o) => {
      let p: THREE.Object3D | null = o;
      while (p) { if (!p.visible) return false; p = p.parent; }
      return true;
    });
    const hits = this.raycaster.intersectObjects(targets, false);
    for (const h of hits) {
      if (this.renderer.clippingPlanes.length && this.plane.distanceToPoint(h.point) < 0) continue;
      const mat = (h.object as THREE.Mesh).material as THREE.MeshStandardMaterial;
      const owner = mat.userData.owner as string | undefined;
      const id = h.object.userData.id as string | undefined;
      const dark = mat.color.getHex() === parseInt(COLORS.dark.slice(1), 16);
      if (owner && LANDMARK_BY_ID[owner]) return owner;
      if (id && !dark) return id;
    }
    return null;
  }

  snapshot(): Promise<Blob | null> {
    this.dirty = true; this.tick();
    const out = document.createElement('canvas');
    out.width = this.canvas.width; out.height = this.canvas.height;
    const g = out.getContext('2d') as CanvasRenderingContext2D;
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, out.width, out.height);
    g.drawImage(this.canvas, 0, 0);
    g.font = '700 20px ui-sans-serif, system-ui, sans-serif'; g.fillStyle = 'rgba(100,116,139,0.85)'; g.textAlign = 'right'; g.textBaseline = 'bottom';
    g.fillText('بادبان', out.width - 16, out.height - 14);
    return new Promise((resolve) => out.toBlob((b) => resolve(b), 'image/png'));
  }

  dispose() {
    this.disposed = true;
    if (this.skinTimer) clearTimeout(this.skinTimer);
    this.skinWorker?.terminate();
    this.stop();
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.controls.dispose();
    this.scene.traverse((o: THREE.Object3D) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    this.mats.forEach((m) => m.dispose());
    this.labelTex.forEach((t) => t.dispose());
    this.skinMat.dispose();
    this.bump.dispose();
    this.fiber?.dispose();
    this.envTex.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
  }
}
