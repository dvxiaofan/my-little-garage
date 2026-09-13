import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CarController, type CarState, type OpenPart } from './controller.ts';
import { createVehicle } from './vehicle.ts';
import { designMeasurements, type CarDesign } from './customization.ts';

export type ViewName = 'home' | 'front' | 'side' | 'rear' | 'free';

interface GarageOptions {
  onState: (state: CarState) => void;
  onView: (view: ViewName) => void;
  onReady: () => void;
  onError: () => void;
}

const viewPositions: Record<Exclude<ViewName, 'free'>, [number, number, number]> = {
  home: [-5.7, 4.0, -6.6],
  front: [0, 3.2, -8.4],
  side: [-9.4, 3.4, 0.15],
  rear: [6.05, 4.13, 7.56],
};

export class Garage {
  readonly controller = new CarController(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(35, 1, 0.1, 80);
  private readonly vehicle = createVehicle();
  private readonly controls: OrbitControls;
  private readonly observer: ResizeObserver;
  private readonly environment: THREE.WebGLRenderTarget;
  private readonly host: HTMLElement;
  private readonly options: GarageOptions;
  private frame = 0;
  private disposed = false;
  private lastTime = 0;
  private stateKey = '';
  private poseKey = '';
  private ready = false;
  private fit = 1;
  private designFit = 1;
  private view: ViewName = 'home';
  private cameraMove: { start: THREE.Vector3; end: THREE.Vector3; elapsed: number } | null = null;
  private dirty = true;
  private hasRendered = false;

  constructor(host: HTMLElement, options: GarageOptions) {
    this.host = host;
    this.options = options;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.VSMShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.domElement.setAttribute('aria-label', '可以拖动旋转的三维玩具越野车');
    this.renderer.domElement.setAttribute('role', 'img');
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    host.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color('#f1f0e9');
    this.scene.fog = new THREE.Fog('#f1f0e9', 18, 42);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, 0.04);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.55;
    room.dispose();
    pmrem.dispose();

    this.scene.add(new THREE.HemisphereLight('#fff5dc', '#7c8771', 1.4));
    const key = new THREE.DirectionalLight('#fff9eb', 2.6);
    key.position.set(-4, 8, -5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 20;
    key.shadow.normalBias = 0.025;
    key.shadow.bias = -0.00012;
    key.shadow.radius = 3;
    key.shadow.blurSamples = 8;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight('#e6f0ee', 0.9);
    fill.position.set(6, 4, 4);
    this.scene.add(fill);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 160),
      new THREE.MeshStandardMaterial({ color: '#eeede5', roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.18;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(3.13, 3.16, 0.16, 112),
      new THREE.MeshStandardMaterial({ color: '#e5dfcd', roughness: 0.92 }),
    );
    platform.position.y = -0.09;
    platform.castShadow = true;
    platform.receiveShadow = true;
    this.scene.add(platform);
    const rim = new THREE.Mesh(
      new THREE.RingGeometry(2.99, 3.015, 112),
      new THREE.MeshBasicMaterial({ color: '#c4bfae', transparent: true, opacity: 0.32, side: THREE.DoubleSide }),
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = -0.008;
    this.scene.add(rim, this.vehicle.root);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 1.02, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.55;
    this.controls.zoomSpeed = 0.8;
    this.controls.minPolarAngle = Math.PI / 6;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.075;
    this.controls.addEventListener('start', this.onOrbitStart);
    this.controls.addEventListener('change', this.onOrbitChange);
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(host);
    this.resize();
    this.camera.position.copy(this.positionFor('home'));
    this.controls.update();
    this.options.onView('home');
    this.publishState();
    this.frame = requestAnimationFrame(this.animate);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  toggle(part: OpenPart): boolean {
    const active = this.controller.toggle(part);
    this.dirty = true;
    this.publishState();
    return active;
  }

  toggleLights(): boolean {
    const active = this.controller.toggleLights();
    this.dirty = true;
    this.publishState();
    return active;
  }

  pressSuspension(): boolean {
    const started = this.controller.pressSuspension();
    this.dirty = true;
    this.publishState();
    return started;
  }

  setView(view: Exclude<ViewName, 'free'>): void {
    // Flush residual orbit damping before beginning a preset camera move.
    const damping = this.controls.enableDamping;
    this.controls.enableDamping = false;
    this.controls.update();
    this.controls.enableDamping = damping;
    this.cameraMove = { start: this.camera.position.clone(), end: this.positionFor(view), elapsed: 0 };
    this.view = view;
    this.options.onView(view);
    this.dirty = true;
  }

  reset(): void {
    this.controller.reset();
    this.vehicle.applyPose(this.controller.pose);
    this.setView('home');
    this.dirty = true;
    this.publishState();
  }

  applyDesign(design: CarDesign): void {
    this.vehicle.applyDesign(design);
    const { extraHeight } = designMeasurements(design);
    const previousTarget = this.controls.target.clone();
    const previousFit = this.designFit;
    this.designFit = 1 + Math.max(0, extraHeight) * 0.17;
    this.controls.target.y = 1.02 + Math.max(0, extraHeight) * 0.35;
    // Keep the chosen angle and zoom, while leaving room for taller creations.
    this.camera.position.sub(previousTarget).multiplyScalar(this.designFit / previousFit).add(this.controls.target);
    if (this.cameraMove && this.view !== 'free' && this.designFit !== previousFit) {
      this.cameraMove = { start: this.camera.position.clone(), end: this.positionFor(this.view), elapsed: 0 };
    }
    this.updateZoomLimits();
    this.controls.update();
    this.renderer.shadowMap.needsUpdate = true;
    this.dirty = true;
  }

  inspect() {
    return {
      state: this.controller.state,
      pose: { ...this.controller.pose },
      vehicle: this.vehicle.inspect(),
      camera: this.camera.position.toArray(),
      cameraMoving: this.cameraMove !== null,
      view: this.view,
      ready: this.ready,
      rendered: this.hasRendered,
      renderer: {
        calls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles,
        geometries: this.renderer.info.memory.geometries,
      },
    };
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.controls.dispose();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        geometries.add(object.geometry);
        const list = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of list) {
          materials.add(material);
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        }
      }
      if (object instanceof THREE.DirectionalLight) object.shadow.dispose();
    });
    geometries.forEach((item) => item.dispose());
    materials.forEach((item) => item.dispose());
    textures.forEach((item) => item.dispose());
    this.environment.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private positionFor(view: Exclude<ViewName, 'free'>): THREE.Vector3 {
    const point = new THREE.Vector3(...viewPositions[view]);
    return point.sub(new THREE.Vector3(0, 1.02, 0)).multiplyScalar(this.fit * this.designFit).add(this.controls.target);
  }

  private updateZoomLimits(): void {
    this.controls.minDistance = 6.0 * this.fit * this.designFit;
    this.controls.maxDistance = 13 * this.fit * this.designFit;
  }

  private resize = (): void => {
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    if (!width || !height) return;
    const previousFit = this.fit;
    this.fit = Math.max(1, Math.min(1.65, 1.24 / (width / height)));
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.updateZoomLimits();
    if (this.ready && previousFit !== this.fit) {
      this.cameraMove = null;
      this.camera.position.sub(this.controls.target).multiplyScalar(this.fit / previousFit).add(this.controls.target);
    }
    this.dirty = true;
  };

  private publishState(): void {
    const state = this.controller.state;
    const key = JSON.stringify(state);
    if (key !== this.stateKey) {
      this.stateKey = key;
      this.options.onState(state);
    }
  }

  private animate = (time: number): void => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.animate);
    if (document.hidden) { this.lastTime = time; return; }
    const dt = this.lastTime ? Math.min((time - this.lastTime) / 1000, 0.1) : 1 / 60;
    this.lastTime = time;
    this.controller.update(dt);
    const pose = this.controller.pose;
    const nextPoseKey = [pose.doors, pose.hood, pose.trunk, Number(pose.lights), pose.compression, pose.distance].join(',');
    if (nextPoseKey !== this.poseKey) {
      this.poseKey = nextPoseKey;
      this.vehicle.applyPose(pose);
      this.renderer.shadowMap.needsUpdate = true;
      this.dirty = true;
    }
    if (this.cameraMove) {
      this.cameraMove.elapsed += dt;
      const progress = Math.min(this.cameraMove.elapsed / 0.72, 1);
      const ease = progress * progress * (3 - 2 * progress);
      this.camera.position.lerpVectors(this.cameraMove.start, this.cameraMove.end, ease);
      if (progress >= 1) this.cameraMove = null;
      this.dirty = true;
    }
    this.controls.update();
    this.publishState();
    if (!this.dirty) return;
    try {
      this.renderer.render(this.scene, this.camera);
      this.hasRendered = true;
      this.dirty = false;
      if (!this.ready) {
        this.ready = true;
        this.renderer.domElement.dataset.ready = 'true';
        this.options.onReady();
      }
    } catch {
      this.options.onError();
      this.dispose();
    }
  };

  private onOrbitStart = (): void => {
    this.cameraMove = null;
    this.view = 'free';
    this.options.onView('free');
    this.dirty = true;
  };
  private onOrbitChange = (): void => { this.dirty = true; };
  private onVisibility = (): void => { this.lastTime = 0; this.dirty = true; };
  private onContextLost = (event: Event): void => { event.preventDefault(); this.options.onError(); };
}
