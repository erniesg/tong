"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export type SeoulLocation = {
  id: string;
  name: string;
  korean: string;
  position: [number, number];
  color: string;
};
export type SeoulWorldProps = {
  locations: SeoulLocation[];
  target: { x: number; z: number } | null;
  input: { x: number; z: number };
  paused: boolean;
  conversation: boolean;
  focusId: string | null;
  companion: "haeun" | "jin";
  onNear: (id: string | null) => void;
  onPosition: (p: { x: number; z: number }) => void;
  onReady: () => void;
  onError: (message: string) => void;
};
type Point = { x: number; z: number };
type Building = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: string;
  sign: string;
};
const bounds = { minX: -18, maxX: 18, minZ: -22, maxZ: 18 };
const buildings: Building[] = [
  { x: -13, z: 8, w: 6, d: 5, h: 3.4, color: "#df9475", sign: "포장마차" },
  { x: -12.5, z: -4, w: 5, d: 6, h: 3, color: "#8db5a3", sign: "소품 가게" },
  { x: -12, z: -15, w: 6, d: 5, h: 3.6, color: "#d47d66", sign: "편의점" },
  { x: 12, z: 9, w: 6, d: 5, h: 3.5, color: "#e6b675", sign: "지하철" },
  { x: 12, z: -3, w: 6, d: 6, h: 3.2, color: "#d98773", sign: "카페 달빛" },
  { x: 11, z: -15, w: 7, d: 5, h: 3.7, color: "#ad849d", sign: "연습실" },
  { x: 0, z: -19, w: 5, d: 3, h: 3, color: "#d3a979", sign: "꽃집" },
];
export function isWalkable(x: number, z: number) {
  return (
    x >= bounds.minX &&
    x <= bounds.maxX &&
    z >= bounds.minZ &&
    z <= bounds.maxZ &&
    !buildings.some(
      (b) =>
        Math.abs(x - b.x) < b.w / 2 + 0.45 &&
        Math.abs(z - b.z) < b.d / 2 + 0.45,
    )
  );
}

function mesh(
  scene: THREE.Scene,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  at: [number, number, number],
  cast = true,
) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...at);
  m.castShadow = cast;
  m.receiveShadow = true;
  scene.add(m);
  return m;
}
function cube(
  scene: THREE.Scene,
  at: [number, number, number],
  size: [number, number, number],
  color: string,
  rough = 0.85,
) {
  return mesh(
    scene,
    new THREE.BoxGeometry(...size),
    new THREE.MeshStandardMaterial({ color, roughness: rough }),
    at,
  );
}
function label(
  scene: THREE.Scene,
  text: string,
  color: string,
  at: [number, number, number],
) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 160;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 512, 160);
  ctx.strokeStyle = "#ffe9bf";
  ctx.lineWidth = 9;
  ctx.strokeRect(9, 9, 494, 142);
  ctx.fillStyle = "#fff6e2";
  ctx.font = "700 72px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 82);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = mesh(
    scene,
    new THREE.PlaneGeometry(2.3, 0.72),
    new THREE.MeshBasicMaterial({ map: t, transparent: true }),
    at,
    false,
  );
  m.rotation.y = 0;
  return m;
}
function tree(
  scene: THREE.Scene,
  x: number,
  z: number,
  scale = 1,
  blossom = false,
) {
  cube(
    scene,
    [x, 0.6 * scale, z],
    [0.22 * scale, 1.2 * scale, 0.22 * scale],
    "#70493b",
  );
  const colors = blossom
    ? ["#f2b4b8", "#ffd0c6", "#ed9faf"]
    : ["#52734e", "#6e935d", "#3f6749"];
  for (let i = 0; i < 3; i++)
    mesh(
      scene,
      new THREE.SphereGeometry(0.56 * scale, 10, 8),
      new THREE.MeshStandardMaterial({ color: colors[i], roughness: 1 }),
      [
        x + (i - 1) * 0.28 * scale,
        1.38 * scale + (i % 2) * 0.2,
        z + (i % 2) * 0.17 * scale,
      ],
    );
}
function storefront(scene: THREE.Scene, b: Building) {
  const front = b.z + b.d / 2 + 0.06;
  cube(scene, [b.x, b.h / 2, b.z], [b.w, b.h, b.d], b.color);
  mesh(
    scene,
    new THREE.ConeGeometry(b.w * 0.78, 0.65, 4),
    new THREE.MeshStandardMaterial({ color: "#754e4d", roughness: 1 }),
    [b.x, b.h + 0.3, b.z],
  );
  const awning = mesh(
    scene,
    new THREE.BoxGeometry(b.w + 0.18, 0.35, 0.55),
    new THREE.MeshStandardMaterial({ color: "#f2d1a3" }),
    [b.x, 2.1, front],
  );
  for (let x = b.x - b.w * 0.33; x <= b.x + b.w * 0.33; x += 1.1)
    cube(scene, [x, 1.25, front + 0.03], [0.62, 0.8, 0.05], "#f8d99a");
  cube(scene, [b.x, 1.05, front + 0.07], [0.72, 1.15, 0.09], "#69483f");
  label(scene, b.sign, "#a94f4d", [b.x, 2.65, front + 0.1]);
  for (const x of [b.x - b.w * 0.38, b.x + b.w * 0.38]) {
    cube(scene, [x, 0.32, front + 0.45], [0.52, 0.32, 0.38], "#996a55");
    mesh(
      scene,
      new THREE.SphereGeometry(0.25, 8, 7),
      new THREE.MeshStandardMaterial({ color: "#db7c68" }),
      [x, 0.64, front + 0.45],
    );
  }
  awning.castShadow = true;
}
function person(scene: THREE.Scene, name: string, shirt: string) {
  const g = new THREE.Group();
  g.name = name;
  const skin = new THREE.MeshStandardMaterial({ color: "#f4c4a3" });
  const cloth = new THREE.MeshStandardMaterial({
    color: shirt,
    roughness: 0.8,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: name === "jin" ? "#26334a" : "#513934",
  });
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.32, 0.55, 5, 10),
    cloth,
  );
  body.position.y = 0.8;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), skin);
  head.position.y = 1.48;
  g.add(head);
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    dark,
  );
  hair.position.y = 1.58;
  g.add(hair);
  for (const x of [-0.27, 0.27]) {
    const arm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.07, 0.34, 4, 8),
      skin,
    );
    arm.position.set(x, 0.89, 0);
    arm.rotation.z = x * 0.65;
    g.add(arm);
    const leg = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.1, 0.35, 4, 8),
      dark,
    );
    leg.position.set(x * 0.58, 0.22, 0);
    g.add(leg);
  }
  for (const x of [-0.1, 0.1]) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 6, 6),
      new THREE.MeshBasicMaterial({ color: "#372b2c" }),
    );
    eye.position.set(x, 1.51, 0.305);
    g.add(eye);
  }
  scene.add(g);
  return g;
}
function makeTown(scene: THREE.Scene, locations: SeoulLocation[]) {
  const ground = mesh(
    scene,
    new THREE.PlaneGeometry(48, 52),
    new THREE.MeshStandardMaterial({ color: "#b9aa88", roughness: 1 }),
    [0, 0, 0],
    false,
  );
  ground.rotation.x = -Math.PI / 2;
  for (const [x, z, w, d] of [
    [0, -2, 5, 45],
    [-1, 5, 37, 4],
    [0, -12, 37, 3],
  ] as [number, number, number, number][]) {
    const p = mesh(
      scene,
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({ color: "#e5d3b7", roughness: 1 }),
      [x, 0.015, z],
      false,
    );
    p.rotation.x = -Math.PI / 2;
  }
  for (let x = -4; x <= 4; x += 1.2) {
    const p = mesh(
      scene,
      new THREE.PlaneGeometry(0.65, 2.5),
      new THREE.MeshBasicMaterial({ color: "#fff6df" }),
      [x, 0.03, 5],
      false,
    );
    p.rotation.x = -Math.PI / 2;
  }
  buildings.forEach((b) => storefront(scene, b));
  for (let i = 0; i < 27; i++)
    tree(
      scene,
      ((i * 11) % 33) - 16,
      ((i * 7) % 37) - 20,
      0.72 + (i % 3) * 0.13,
      i % 5 === 0,
    );
  for (const [x, z] of [
    [7, -4],
    [8.5, -4.8],
    [6.1, -5.2],
  ] as [number, number][]) {
    cube(scene, [x, 0.38, z], [0.7, 0.1, 0.7], "#72483e");
    cube(scene, [x, 0.18, z], [0.08, 0.4, 0.08], "#533934");
    for (const dx of [-0.5, 0.5])
      cube(scene, [x + dx, 0.22, z], [0.28, 0.38, 0.28], "#da9b69");
    mesh(
      scene,
      new THREE.CylinderGeometry(0.1, 0.11, 0.16, 10),
      new THREE.MeshStandardMaterial({ color: "#f4f0dd" }),
      [x, 0.57, z],
    );
  }
  for (let i = 0; i < 3; i++) {
    cube(
      scene,
      [-8.3 + i * 1.25, 1, -0.8],
      [1, 1.7, 0.9],
      ["#d74f41", "#eda447", "#4f9a85"][i],
    );
    cube(scene, [-8.3 + i * 1.25, 1.93, -0.8], [1.18, 0.12, 1.08], "#f6d286");
  }
  const wire = new THREE.CatmullRomCurve3(
    Array.from(
      { length: 9 },
      (_, i) => new THREE.Vector3(-16 + i * 4, 4.5 + Math.sin(i) * 0.25, -0.35),
    ),
  );
  scene.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(wire.getPoints(50)),
      new THREE.LineBasicMaterial({ color: "#4d3d3c" }),
    ),
  );
  for (let x = -16; x <= 16; x += 4)
    cube(scene, [x, 2.2, -0.35], [0.09, 4.5, 0.09], "#5b4841");
  const bulb = new THREE.MeshStandardMaterial({
    color: "#ffd88e",
    emissive: "#f5a33c",
    emissiveIntensity: 1.2,
  });
  for (let x = -15; x <= 15; x += 1.35)
    mesh(
      scene,
      new THREE.SphereGeometry(0.09, 8, 8),
      bulb,
      [x, 4.45 + Math.sin((x + 16) / 4) * 0.25, -0.35],
      false,
    );
  locations.forEach((l) => {
    const ring = mesh(
      scene,
      new THREE.TorusGeometry(0.74, 0.06, 8, 24),
      new THREE.MeshBasicMaterial({ color: l.color }),
      [l.position[0], 0.06, l.position[1]],
      false,
    );
    ring.rotation.x = Math.PI / 2;
  });
  return ground;
}

export default function SeoulWorld(props: SeoulWorldProps) {
  const host = useRef<HTMLDivElement>(null);
  const current = useRef(props);
  current.current = props;
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let renderer: THREE.WebGLRenderer | undefined,
      frame = 0,
      stopped = false;
    const keys = new Set<string>();
    const teardown: Array<() => void> = [];
    let cleanup = () => {};
    try {
      const scene = new THREE.Scene();
      cleanup = () => {
        stopped = true;
        cancelAnimationFrame(frame);
        teardown.splice(0).forEach((dispose) => dispose());
        const resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>();
        scene.traverse((object) => {
          const item = object as THREE.Mesh;
          if (item.geometry) resources.add(item.geometry);
          const materials = Array.isArray(item.material) ? item.material : [item.material];
          materials.filter(Boolean).forEach((material) => {
            resources.add(material);
            Object.values(material).forEach((value) => {
              if (value instanceof THREE.Texture) resources.add(value);
            });
          });
        });
        resources.forEach((resource) => resource.dispose());
        renderer?.dispose();
        renderer?.domElement.remove();
      };
      scene.background = new THREE.Color("#ead0af");
      scene.fog = new THREE.Fog("#ead0af", 35, 78);
      const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
      const player = new THREE.Vector3(0, 0, 8),
        velocity = new THREE.Vector3();
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.domElement.dataset.testid = "seoul-world";
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      node.appendChild(renderer.domElement);
      scene.add(new THREE.HemisphereLight("#fff0d7", "#747f70", 2));
      const sun = new THREE.DirectionalLight("#ffe0b0", 2.5);
      sun.position.set(-12, 18, 8);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.left = -28;
      sun.shadow.camera.right = 28;
      sun.shadow.camera.top = 28;
      sun.shadow.camera.bottom = -28;
      sun.shadow.normalBias = 0.04;
      scene.add(sun);
      for (let i = 0; i < 10; i++)
        mesh(
          scene,
          new THREE.ConeGeometry(4 + (i % 3), 7 + (i % 4) * 2, 7),
          new THREE.MeshStandardMaterial({ color: "#85826e", roughness: 1 }),
          [-30 + i * 6, 3, -29 + (i % 2) * 3],
        );
      const ground = makeTown(scene, current.current.locations);
      const hero = person(scene, "player", "#e8a158"),
        haeun = person(scene, "haeun", "#d76f83"),
        jin = person(scene, "jin", "#5b7ca2");
      haeun.position.set(7, 0, -2.8);
      jin.position.set(-8, 0, 2.2);
      const petalGeometry = new THREE.BufferGeometry();
      petalGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          Array.from({ length: 90 }, (_, i) => [
            ((i * 3.7) % 35) - 17,
            1 + (i % 7) * 0.55,
            ((i * 6.1) % 38) - 20,
          ]).flat(),
          3,
        ),
      );
      const petals = new THREE.Points(
        petalGeometry,
        new THREE.PointsMaterial({
          color: "#ffd1c7",
          size: 0.13,
          transparent: true,
          opacity: 0.8,
        }),
      );
      scene.add(petals);
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const ray = new THREE.Raycaster(),
        pointer = new THREE.Vector2();
      let down: Point | null = null,
        orbit = 0,
        yaw = 0,
        tapTarget: Point | null = null,
        activeDestination: Point | null = null,
        requestedTarget: SeoulWorldProps["target"] | undefined,
        near: string | null = null,
        lastPosition = 0,
        wasPaused = false;
      const clearKeys = () => keys.clear();
      const resize = () => {
        const r = node.getBoundingClientRect();
        camera.aspect = r.width / Math.max(r.height, 1);
        camera.fov = r.height > r.width ? 57 : 48;
        camera.updateProjectionMatrix();
        renderer!.setSize(r.width, r.height, false);
      };
      const observer = new ResizeObserver(resize);
      teardown.push(() => observer.disconnect());
      observer.observe(node);
      resize();
      const keydown = (e: KeyboardEvent) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (
          (e.target as HTMLElement)?.closest(
            "input,textarea,select,[contenteditable=true]",
          )
        )
          return;
        if (/^(arrow|w$|a$|s$|d$)/i.test(e.key)) {
          if (!current.current.paused) {
            keys.add(e.key.toLowerCase());
            tapTarget = null;
            activeDestination = null;
          }
          e.preventDefault();
        }
      };
      const keyup = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
      const pointerDown = (e: PointerEvent) => {
        if (current.current.paused) return;
        down = { x: e.clientX, z: e.clientY };
        renderer!.domElement.setPointerCapture(e.pointerId);
      };
      const pointerMove = (e: PointerEvent) => {
        if (!down || current.current.paused) return;
        if (Math.hypot(e.clientX - down.x, e.clientY - down.z) > 5) {
          yaw += (e.movementX || 0) * 0.006;
          orbit = THREE.MathUtils.clamp(
            orbit - (e.movementY || 0) * 0.004,
            -0.25,
            0.55,
          );
        }
      };
      const pointerUp = (e: PointerEvent) => {
        const start = down;
        down = null;
        if (
          current.current.paused ||
          !start ||
          Math.hypot(e.clientX - start.x, e.clientY - start.z) > 8
        )
          return;
        const r = renderer!.domElement.getBoundingClientRect();
        pointer.set(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          (-(e.clientY - r.top) / r.height) * 2 + 1,
        );
        ray.setFromCamera(pointer, camera);
        const hit = ray.intersectObject(ground, false)[0];
        if (hit) {
          tapTarget = {
            x: THREE.MathUtils.clamp(hit.point.x, bounds.minX, bounds.maxX),
            z: THREE.MathUtils.clamp(hit.point.z, bounds.minZ, bounds.maxZ),
          };
          activeDestination = tapTarget;
        }
      };
      window.addEventListener("keydown", keydown);
      window.addEventListener("keyup", keyup);
      window.addEventListener("blur", clearKeys);
      document.addEventListener("visibilitychange", clearKeys);
      renderer.domElement.addEventListener("pointerdown", pointerDown);
      renderer.domElement.addEventListener("pointermove", pointerMove);
      renderer.domElement.addEventListener("pointerup", pointerUp);
      const pointerCancel = () => { down = null; };
      renderer.domElement.addEventListener("pointercancel", pointerCancel);
      teardown.push(() => {
        window.removeEventListener("keydown", keydown);
        window.removeEventListener("keyup", keyup);
        window.removeEventListener("blur", clearKeys);
        document.removeEventListener("visibilitychange", clearKeys);
        renderer?.domElement.removeEventListener("pointerdown", pointerDown);
        renderer?.domElement.removeEventListener("pointermove", pointerMove);
        renderer?.domElement.removeEventListener("pointerup", pointerUp);
        renderer?.domElement.removeEventListener("pointercancel", pointerCancel);
      });
      let then = performance.now();
      const loop = (now: number) => {
        if (stopped) return;
        const dt = Math.min(0.05, (now - then) / 1000);
        then = now;
        const p = current.current;
        if (p.paused && !wasPaused) {
          clearKeys();
          tapTarget = null;
          activeDestination = null;
          velocity.set(0, 0, 0);
        }
        wasPaused = p.paused;
        const focus = p.locations.find((l) => l.id === p.focusId);
        if (p.conversation && focus) {
          hero.visible = false;
          const npc = p.companion === "haeun" ? haeun : jin;
          npc.position.set(
            focus.position[0] + 0.85,
            0,
            focus.position[1] - 0.4,
          );
          camera.position.lerp(
            new THREE.Vector3(
              focus.position[0] - 1.6,
              1.65,
              focus.position[1] + 1.8,
            ),
            0.09,
          );
          camera.lookAt(npc.position.x, 1.05, npc.position.z);
          const cameraSettled = camera.position.distanceTo(new THREE.Vector3(
            focus.position[0] - 1.6, 1.65, focus.position[1] + 1.8,
          )) < 0.08;
          renderer!.domElement.dataset.view = cameraSettled ? "conversation" : "transition";
        } else {
          renderer!.domElement.dataset.view = "explore";
          hero.visible = true;
          const ix =
              (keys.has("a") || keys.has("arrowleft") ? -1 : 0) +
              (keys.has("d") || keys.has("arrowright") ? 1 : 0) +
              p.input.x,
            iz =
              (keys.has("w") || keys.has("arrowup") ? -1 : 0) +
              (keys.has("s") || keys.has("arrowdown") ? 1 : 0) +
              p.input.z;
          if (!p.paused && Math.hypot(ix, iz) > 0.05) {
            tapTarget = null;
            activeDestination = null;
            velocity.set(ix, 0, iz).normalize().multiplyScalar(5.1);
          } else {
            const external = p.target;
            if (external !== requestedTarget) {
              requestedTarget = external;
              tapTarget = null;
              activeDestination = external ? { ...external } : null;
            }
            const destination = p.paused ? null : activeDestination;
            if (
              destination &&
              Math.hypot(destination.x - player.x, destination.z - player.z) >
                0.32
            )
              velocity
                .set(destination.x - player.x, 0, destination.z - player.z)
                .normalize()
                .multiplyScalar(3.5);
            else {
              activeDestination = null;
              tapTarget = null;
              velocity.multiplyScalar(0.72);
            }
          }
          const nx = THREE.MathUtils.clamp(
              player.x + velocity.x * dt,
              bounds.minX,
              bounds.maxX,
            ),
            nz = THREE.MathUtils.clamp(
              player.z + velocity.z * dt,
              bounds.minZ,
              bounds.maxZ,
            );
          if (isWalkable(nx, player.z)) player.x = nx;
          if (isWalkable(player.x, nz)) player.z = nz;
          hero.position.copy(player);
          hero.position.y =
            velocity.lengthSq() > 0.2 && !reduced
              ? Math.abs(Math.sin(now * 0.012)) * 0.06
              : 0;
          if (velocity.lengthSq() > 0.05)
            hero.rotation.y = Math.atan2(velocity.x, velocity.z);
          const cameraDistance = camera.aspect < 1 ? 24 : 21;
          const cameraAngle = yaw + 0.36;
          camera.position.lerp(
            new THREE.Vector3(
              player.x + Math.sin(cameraAngle) * cameraDistance,
              20 + orbit * 5,
              player.z + Math.cos(cameraAngle) * cameraDistance,
            ),
            reduced ? 1 : 0.075,
          );
          camera.lookAt(player.x, 0, player.z - 5);
          let candidate: string | null = null,
            distance = Infinity;
          p.locations.forEach((l) => {
            const d = Math.hypot(
              l.position[0] - player.x,
              l.position[1] - player.z,
            );
            if (d < distance) {
              distance = d;
              candidate = l.id;
            }
          });
          if (distance > 3) candidate = null;
          if (candidate !== near) {
            near = candidate;
            p.onNear(near);
          }
          if (now - lastPosition > 120) {
            lastPosition = now;
            p.onPosition({ x: player.x, z: player.z });
          }
        }
        if (!reduced) {
          const a = petalGeometry.getAttribute(
            "position",
          ) as THREE.BufferAttribute;
          for (let i = 0; i < a.count; i++) {
            a.setX(i, a.getX(i) + Math.sin(now * 0.001 + i) * 0.002);
            a.setY(i, a.getY(i) - 0.006);
            if (a.getY(i) < 0.1) a.setY(i, 4.8);
          }
          a.needsUpdate = true;
        }
        renderer!.render(scene, camera);
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
      current.current.onReady();
      const lost = (e: Event) => {
        e.preventDefault();
        stopped = true;
        current.current.onError(
          "The 3D scene paused because WebGL context was lost.",
        );
      };
      renderer.domElement.addEventListener("webglcontextlost", lost);
      teardown.push(() => renderer?.domElement.removeEventListener("webglcontextlost", lost));
    } catch (error) {
      cleanup();
      current.current.onError(
        error instanceof Error
          ? error.message
          : "Unable to start the 3D Seoul scene.",
      );
    }
    return cleanup;
  }, []);
  return (
    <div
      ref={host}
      role="application"
      aria-label="Interactive three dimensional Seoul neighborhood. Use arrow keys or WASD to walk."
      style={{
        width: "100%",
        height: "100%",
        minHeight: 0,
        touchAction: "none",
        overflow: "hidden",
      }}
    />
  );
}
