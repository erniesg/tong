import * as THREE from 'three';

// Small shared-geometry rides, attached to the ground-level player root, not
// the animated body. Wheel spin and rider pose follow actual traversal speed.
export function createRides(player) {
  const root = new THREE.Group();
  root.name = 'player-rides';
  player.root.add(root);
  const metal = new THREE.MeshStandardMaterial({ color: '#4c6265', metalness: 0.55, roughness: 0.4 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#26313b', roughness: 0.9 });
  const deck = new THREE.MeshStandardMaterial({ color: '#eeb97c', roughness: 0.7 });
  const teal = new THREE.MeshStandardMaterial({ color: '#5bc2b4', metalness: 0.2, roughness: 0.5 });
  const spokeGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 6);
  const models = {}, wheels = [];
  function mesh(parent, geometry, material, x, y, z) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  }
  function rod(parent, a, b, material = metal, thickness = 0.025) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const m = mesh(parent, new THREE.CylinderGeometry(thickness, thickness, start.distanceTo(end), 8), material, ...start.clone().lerp(end, 0.5).toArray());
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
  }
  function wheel(parent, x, y, z, radius, small = false) {
    const axle = new THREE.Group();
    axle.position.set(x, y, z);
    parent.add(axle);
    const tire = mesh(axle, new THREE.TorusGeometry(radius - (small ? 0.025 : 0.035), small ? 0.025 : 0.035, 6, 16), rubber, 0, 0, 0);
    tire.rotation.y = Math.PI / 2;
    for (let i = 0; i < 3; i++) {
      const s = mesh(axle, spokeGeo, metal, 0, 0, 0);
      s.scale.y = radius * 1.7;
      s.rotation.x = i * Math.PI / 3;
    }
    wheels.push({ axle, radius, parent });
  }
  for (const name of ['skateboard', 'scooter', 'bicycle']) {
    const g = models[name] = new THREE.Group();
    g.name = name;
    g.visible = false;
    root.add(g);
    if (name === 'skateboard') {
      mesh(g, new THREE.BoxGeometry(0.34, 0.07, 0.85), deck, 0, 0.15, 0);
      for (const z of [-0.28, 0.28]) {
        rod(g, [-0.22, 0.08, z], [0.22, 0.08, z]);
        for (const x of [-0.2, 0.2]) wheel(g, x, 0.075, z, 0.075, true);
      }
    } else if (name === 'scooter') {
      mesh(g, new THREE.BoxGeometry(0.25, 0.06, 0.75), teal, 0, 0.15, -0.1);
      for (const z of [-0.48, 0.48]) wheel(g, 0, 0.13, z, 0.13, true);
      rod(g, [0, 0.15, 0.25], [0, 1.04, 0.42], teal, 0.035);
      rod(g, [-0.3, 1.04, 0.42], [0.3, 1.04, 0.42]);
      rod(g, [0, 0.13, 0.48], [0, 0.7, 0.36]);
    } else {
      wheel(g, 0, 0.29, -0.6, 0.29);
      wheel(g, 0, 0.29, 0.6, 0.29);
      for (const [a, b] of [
        [[0, 0.29, -0.6], [0, 0.36, -0.05]], [[0, 0.36, -0.05], [0, 0.76, -0.25]],
        [[0, 0.76, -0.25], [0, 0.29, -0.6]], [[0, 0.76, -0.25], [0, 0.78, 0.35]],
        [[0, 0.36, -0.05], [0, 0.78, 0.35]], [[0, 0.29, 0.6], [0, 1.05, 0.3]],
      ]) rod(g, a, b, teal);
      mesh(g, new THREE.BoxGeometry(0.28, 0.08, 0.25), rubber, 0, 0.81, -0.25);
      rod(g, [-0.29, 1.05, 0.35], [0.29, 1.05, 0.35]);
      rod(g, [-0.19, 0.36, -0.05], [0.19, 0.36, -0.05]);
    }
  }
  return {
    root, models,
    update(state, speed, t, slope = 0) {
      const mode = state.mode;
      root.rotation.x = Math.max(-0.55, Math.min(0.55, slope));
      for (const [name, g] of Object.entries(models)) g.visible = name === mode;
      if (mode === 'walk') return;
      for (const w of wheels) if (w.parent.visible) w.axle.rotation.x = state.distance / w.radius;
      player.body.position.y = mode === 'bicycle' ? 0.34 : 0.18;
      player.body.rotation.x = mode === 'bicycle' ? 0.12 : 0;
      player.legs.forEach((leg, i) => {
        leg.rotation.x = mode === 'bicycle' ? -0.65 + Math.sin(t * Math.min(speed, 5) * 3 + i * Math.PI) * 0.3 : mode === 'skateboard' ? 0.16 : (i ? 0.3 : 0);
        leg.rotation.z = mode === 'skateboard' ? (i ? 0.12 : -0.12) : 0;
      });
      player.arms.forEach((arm, i) => {
        arm.rotation.x = mode === 'skateboard' ? -0.2 : -1;
        arm.rotation.z = (i ? 1 : -1) * (mode === 'skateboard' ? 0.38 : 0.12);
      });
    },
    resetPose() {
      player.body.rotation.x = 0;
      for (const leg of player.legs) leg.rotation.z = 0;
    },
  };
}
