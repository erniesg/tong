'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type SeoulLocation = { id: string; name: string; korean: string; position: [number, number]; color: string };
export type SeoulWorldProps = {
  locations: SeoulLocation[];
  target: { x: number; z: number } | null;
  input: { x: number; z: number };
  paused: boolean;
  conversation: boolean;
  focusId: string | null;
  companion: 'haeun' | 'jin';
  onNear: (id: string | null) => void;
  onPosition: (p: { x: number; z: number }) => void;
  onReady: () => void;
  onError: (message: string) => void;
};

type Building = { x: number; z: number; w: number; d: number };
const bounds = { minX: -18, maxX: 18, minZ: -22, maxZ: 18 };
const buildings: Building[] = [
  { x: -13, z: 8, w: 6, d: 5 }, { x: -12.5, z: -4, w: 5, d: 6 }, { x: -12, z: -15, w: 6, d: 5 },
  { x: 12, z: 9, w: 6, d: 5 }, { x: 12, z: -3, w: 6, d: 6 }, { x: 11, z: -15, w: 7, d: 5 },
  { x: 0, z: -19, w: 5, d: 3 },
];

function canvasTexture(text: string, background: string, foreground = '#fff5dd') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 192;
  const x = c.getContext('2d')!; x.fillStyle = background; x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = 'rgba(255,244,217,.5)'; x.lineWidth = 10; x.strokeRect(10, 10, 492, 172);
  x.fillStyle = foreground; x.font = 'bold 76px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 97);
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

function box(scene: THREE.Scene, x: number, y: number, z: number, w: number, h: number, d: number, color: string, rough = .8) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: rough }));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
}
function cylinder(scene: THREE.Scene, x: number, y: number, z: number, r: number, h: number, color: string) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), new THREE.MeshStandardMaterial({ color, roughness: .9 }));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
}
function tree(scene: THREE.Scene, x: number, z: number, scale = 1) {
  cylinder(scene, x, .65 * scale, z, .16 * scale, 1.3 * scale, '#79533d');
  const foliage = new THREE.Mesh(new THREE.SphereGeometry(.8 * scale, 12, 10), new THREE.MeshStandardMaterial({ color: '#568255', roughness: 1 })); foliage.position.set(x, 1.65 * scale, z); foliage.castShadow = true; scene.add(foliage);
}
function sign(scene: THREE.Scene, x: number, y: number, z: number, text: string, color: string, rotation = 0) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.3, .78), new THREE.MeshBasicMaterial({ map: canvasTexture(text, color), transparent: true }));
  mesh.position.set(x, y, z); mesh.rotation.y = rotation; scene.add(mesh);
}
function character(scene: THREE.Scene, name: string, color: string) {
  const root = new THREE.Group(); root.name = name;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.34, .62, 6, 12), new THREE.MeshStandardMaterial({ color, roughness: .75 })); body.position.y = .78; body.castShadow = true; root.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.33, 14, 12), new THREE.MeshStandardMaterial({ color: '#f4c4a3', roughness: .8 })); head.position.y = 1.47; head.castShadow = true; root.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(.345, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: name === 'jin' ? '#26334a' : '#573b36' })); hair.position.y = 1.55; root.add(hair);
  scene.add(root); return root;
}

function decorate(scene: THREE.Scene, poi: SeoulLocation[]) {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(48, 52), new THREE.MeshStandardMaterial({ color: '#b8a989', roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  // Broad, deliberately legible pedestrian paths.
  [[0, -2, 5, 45], [-1, 5, 37, 4], [0, -12, 37, 3]].forEach(([x, z, w, d]) => {
    const path = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: '#dfd0b5', roughness: 1 })); path.rotation.x = -Math.PI / 2; path.position.set(x, .012, z); path.receiveShadow = true; scene.add(path);
  });
  const paint = new THREE.MeshStandardMaterial({ color: '#fff8e7', roughness: 1 });
  for (let x = -4; x <= 4; x += 1.2) { const stripe = new THREE.Mesh(new THREE.PlaneGeometry(.65, 2.6), paint); stripe.rotation.x = -Math.PI / 2; stripe.position.set(x, .03, 5); scene.add(stripe); }
  const palette = ['#d98970', '#eeae80', '#d77364', '#eac391', '#bd7262', '#e09b79', '#d9b982'];
  buildings.forEach((b, i) => {
    const h = 2.8 + (i % 3) * .45; box(scene, b.x, h / 2, b.z, b.w, h, b.d, palette[i]);
    box(scene, b.x, .34, b.z - b.d / 2 - .04, b.w + .22, .48, .25, '#754b43');
    for (let wx = b.x - b.w / 3; wx < b.x + b.w / 2; wx += 1.1) box(scene, wx, 1.75, b.z - b.d / 2 - .16, .55, .64, .05, '#f7d995');
  });
  sign(scene, -12.5, 2.8, -7.08, '편의점', '#337c71'); sign(scene, 12, 2.8, -6.1, '카페 달빛', '#a25346'); sign(scene, -13, 2.7, 5.42, '포장마차', '#c45c48'); sign(scene, 11.8, 2.8, 6.42, '지하철', '#3c7c91'); sign(scene, 11, 2.9, -12.42, '연습실', '#74548c');
  for (let i = 0; i < 23; i++) tree(scene, ((i * 11) % 33) - 16, ((i * 7) % 35) - 19, .7 + (i % 3) * .15);
  // cafe terrace and food-stall details
  for (const [x, z] of [[7,-4],[8.6,-4.7],[6.2,-5.3]] as [number,number][]) { cylinder(scene,x,.38,z,.38,.08,'#8e5846'); cylinder(scene,x,.18,z,.06,.4,'#513c38'); }
  for (let i=0;i<3;i++) { box(scene,-8.3+i*1.25,1,-.8,1,1.7,.9,['#d74f41','#eda447','#4f9a85'][i]); box(scene,-8.3+i*1.25,1.93,-.8,1.16,.12,1.08,'#f6d286'); }
  [[-7.4,1.5],[-5.9,1.3],[4.4,7.2],[5.8,7.2]].forEach(([x,z])=>{ box(scene,x,.35,z,.9,.12,.34,'#724a3e'); box(scene,x-.32,.2,z,.07,.4,.07,'#583b35'); box(scene,x+.32,.2,z,.07,.4,.07,'#583b35'); });
  const bulbMat = new THREE.MeshStandardMaterial({ color:'#ffd88e', emissive:'#f5a33c', emissiveIntensity:1.2 });
  for(let x=-15;x<=15;x+=1.4) { const bulb=new THREE.Mesh(new THREE.SphereGeometry(.09,8,8),bulbMat); bulb.position.set(x,4.7,-.3+Math.sin(x)*.3); scene.add(bulb); }
  poi.forEach(l => { const ring = new THREE.Mesh(new THREE.TorusGeometry(.74,.06,8,24),new THREE.MeshBasicMaterial({ color:l.color })); ring.rotation.x=Math.PI/2; ring.position.set(l.position[0],.06,l.position[1]); ring.name=`poi-${l.id}`; scene.add(ring); });
}

export default function SeoulWorld(props: SeoulWorldProps) {
  const host = useRef<HTMLDivElement>(null); const current = useRef(props); current.current = props;
  useEffect(() => {
    const node = host.current; if (!node) return;
    let renderer: THREE.WebGLRenderer | undefined; let frame = 0; let disposed = false; let lastPosition = 0; let near: string | null = null;
    try {
      const scene = new THREE.Scene(); scene.background = new THREE.Color('#f0a56e'); scene.fog = new THREE.Fog('#e9ad7a', 22, 59);
      const camera = new THREE.PerspectiveCamera(48, 1, .1, 100); const player = new THREE.Vector3(0, 0, 8); const velocity = new THREE.Vector3();
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' }); renderer.domElement.dataset.testid = 'seoul-world'; renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace; node.appendChild(renderer.domElement);
      scene.add(new THREE.HemisphereLight('#ffe2bd','#6b6659',2.1)); const sun = new THREE.DirectionalLight('#ffd29a', 3); sun.position.set(-12,18,8); sun.castShadow=true; sun.shadow.mapSize.set(1024,1024); sun.shadow.camera.left=-24; sun.shadow.camera.right=24; sun.shadow.camera.top=24; sun.shadow.camera.bottom=-24; scene.add(sun);
      const hillMat = new THREE.MeshStandardMaterial({color:'#8b876f',roughness:1}); for(let i=0;i<10;i++){ const h=new THREE.Mesh(new THREE.ConeGeometry(4+(i%3),7+(i%4)*2,7),hillMat); h.position.set(-30+i*6,3,-29+(i%2)*3); scene.add(h); }
      decorate(scene, current.current.locations); const hero=character(scene,'player','#e8a158'); const haeun=character(scene,'haeun','#d76f83'); haeun.position.set(7,0,-2.8); const jin=character(scene,'jin','#5b7ca2'); jin.position.set(-8,0,2.2);
      const petals = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({color:'#ffd1c7',size:.13,transparent:true,opacity:.8})); const petalData = Array.from({length:90},(_,i)=>[((i*3.7)%35)-17,1+(i%7)*.55,((i*6.1)%38)-20]).flat(); petals.geometry.setAttribute('position',new THREE.Float32BufferAttribute(petalData,3)); scene.add(petals);
      const ray = new THREE.Raycaster(); const pointer = new THREE.Vector2(); let pointerDown: {x:number;y:number}|null=null; let orbit = 0; let cameraYaw=0; let tapTarget: THREE.Vector2 | null = null; const keys = new Set<string>();
      const resize = () => { const r=node.getBoundingClientRect(); if(!r.width||!r.height)return; camera.aspect=r.width/r.height; camera.fov=r.height>r.width?57:48; camera.updateProjectionMatrix(); renderer!.setSize(r.width,r.height,false); };
      const observer = new ResizeObserver(resize); observer.observe(node); resize();
      const keydown=(e:KeyboardEvent)=>{ if((e.target as HTMLElement)?.matches('input,textarea,select,button,[contenteditable=true]'))return; if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'].includes(e.key)){keys.add(e.key.toLowerCase()); e.preventDefault();}}; const keyup=(e:KeyboardEvent)=>keys.delete(e.key.toLowerCase()); window.addEventListener('keydown',keydown); window.addEventListener('keyup',keyup);
      const down=(e:PointerEvent)=>{ pointerDown={x:e.clientX,y:e.clientY}; renderer!.domElement.setPointerCapture(e.pointerId);}; const move=(e:PointerEvent)=>{ if(pointerDown && Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)>5){ cameraYaw+=(e.movementX||0)*.006; orbit=Math.max(-.25,Math.min(.55,orbit-(e.movementY||0)*.004)); }};
      const up=(e:PointerEvent)=>{ const start=pointerDown; pointerDown=null; if(current.current.paused || !start||Math.hypot(e.clientX-start.x,e.clientY-start.y)>8)return; const rect=renderer!.domElement.getBoundingClientRect(); pointer.set(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1); ray.setFromCamera(pointer,camera); const ground=scene.children.find(c=>c.type==='Mesh'); const hits=ground ? ray.intersectObject(ground,false) : []; if(hits[0]) { const p=hits[0].point; tapTarget=new THREE.Vector2(THREE.MathUtils.clamp(p.x,bounds.minX,bounds.maxX),THREE.MathUtils.clamp(p.z,bounds.minZ,bounds.maxZ)); }};
      renderer.domElement.addEventListener('pointerdown',down); renderer.domElement.addEventListener('pointermove',move); renderer.domElement.addEventListener('pointerup',up);
      const blocked=(x:number,z:number)=>buildings.some(b=>Math.abs(x-b.x)<b.w/2+.45&&Math.abs(z-b.z)<b.d/2+.45);
      let then=performance.now(); const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
      const tick=(now:number)=>{ if(disposed)return; const dt=Math.min(.05,(now-then)/1000); then=now; const p=current.current; const focus=p.locations.find(l=>l.id===p.focusId); const talking=p.conversation&&focus;
        if(talking){ hero.visible=false; const npc=p.companion==='haeun'?haeun:jin; npc.position.set(focus.position[0]+.85,0,focus.position[1]-.4); const eye=new THREE.Vector3(focus.position[0]-1.6,1.65,focus.position[1]+1.8); camera.position.lerp(eye,.09); camera.lookAt(npc.position.x,1.05,npc.position.z); }
        else { hero.visible=true; let ix=p.input.x, iz=p.input.z; if(keys.size && !p.paused){ ix=(keys.has('a')||keys.has('arrowleft')?-1:0)+(keys.has('d')||keys.has('arrowright')?1:0); iz=(keys.has('w')||keys.has('arrowup')?-1:0)+(keys.has('s')||keys.has('arrowdown')?1:0); }
          if(p.paused) { velocity.set(0,0,0); } else if(Math.abs(ix)+Math.abs(iz)>.05){ tapTarget=null; velocity.set(ix,0,iz).normalize().multiplyScalar(5.1); } else { const destination=p.target ?? tapTarget; if(destination){ const dx=destination.x-player.x,dz=destination.z-player.z; if(Math.hypot(dx,dz)>.32) velocity.set(dx,0,dz).normalize().multiplyScalar(3.5); else { velocity.multiplyScalar(.7); if(tapTarget) tapTarget=null; } } else velocity.multiplyScalar(.78); }
          const nx=THREE.MathUtils.clamp(player.x+velocity.x*dt,bounds.minX,bounds.maxX), nz=THREE.MathUtils.clamp(player.z+velocity.z*dt,bounds.minZ,bounds.maxZ); if(!blocked(nx,player.z))player.x=nx; if(!blocked(player.x,nz))player.z=nz; hero.position.copy(player); if(velocity.lengthSq()>.05)hero.rotation.y=Math.atan2(velocity.x,velocity.z);
          const wanted=new THREE.Vector3(player.x+Math.sin(cameraYaw)*8,8.5+orbit*5,player.z+Math.cos(cameraYaw)*8); camera.position.lerp(wanted,reduced?1:.075); camera.lookAt(player.x,0,player.z-1);
          let next:string|null=null, dist=Infinity; p.locations.forEach(l=>{const d=Math.hypot(l.position[0]-player.x,l.position[1]-player.z); if(d<dist){dist=d;next=l.id;}}); if(dist>3)next=null; if(next!==near){near=next;p.onNear(near);} if(now-lastPosition>120){lastPosition=now;p.onPosition({x:player.x,z:player.z});}
        }
        const attr=petals.geometry.getAttribute('position') as THREE.BufferAttribute; for(let i=0;i<attr.count;i++){attr.setX(i,attr.getX(i)+Math.sin(now*.001+i)*.002);attr.setY(i,attr.getY(i)-.006);if(attr.getY(i)<.1)attr.setY(i,4.8);} attr.needsUpdate=true;
        renderer!.render(scene,camera); frame=requestAnimationFrame(tick);
      }; frame=requestAnimationFrame(tick); current.current.onReady();
      const contextLost=(event:Event)=>{event.preventDefault();current.current.onError('The 3D scene paused because WebGL context was lost.');}; renderer.domElement.addEventListener('webglcontextlost',contextLost);
      return ()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);renderer?.domElement.removeEventListener('pointerdown',down);renderer?.domElement.removeEventListener('pointermove',move);renderer?.domElement.removeEventListener('pointerup',up);renderer?.domElement.removeEventListener('webglcontextlost',contextLost);scene.traverse(o=>{const m=o as THREE.Mesh;if(m.geometry)m.geometry.dispose();const material=m.material;if(Array.isArray(material))material.forEach(v=>v.dispose());else material?.dispose();});renderer?.dispose();renderer?.domElement.remove();};
    } catch (error) { current.current.onError(error instanceof Error ? error.message : 'Unable to start the 3D Seoul scene.'); }
  }, []);
  return <div ref={host} aria-label="Interactive three dimensional Seoul neighborhood. Use arrow keys or WASD to walk." role="application" style={{ width: '100%', height: '100%', minHeight: 360, touchAction: 'none', overflow: 'hidden' }} />;
}
