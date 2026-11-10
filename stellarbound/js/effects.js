import * as THREE from "three";

const sparkGeo = new THREE.IcosahedronGeometry(0.07, 0);

export function createBursts(scene) {
  const items = [];
  return {
    burst(position, color, count = 12, lift = 1) {
      for (let i = 0; i < count; i += 1) {
        const mesh = new THREE.Mesh(
          sparkGeo,
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }),
        );
        mesh.position.copy(position);
        mesh.position.y += 0.8;
        const velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 2.4,
          (0.4 + Math.random()) * 2.2 * lift,
          (Math.random() - 0.5) * 2.4,
        );
        scene.add(mesh);
        items.push({ mesh, velocity, life: 0.45 + Math.random() * 0.28 });
      }
    },
    update(dt) {
      for (let i = items.length - 1; i >= 0; i -= 1) {
        const item = items[i];
        item.life -= dt;
        item.velocity.y -= 3.2 * dt;
        item.mesh.position.addScaledVector(item.velocity, dt);
        item.mesh.material.opacity = Math.max(0, item.life * 2);
        item.mesh.scale.setScalar(Math.max(0.15, item.life * 1.6));
        if (item.life <= 0) {
          scene.remove(item.mesh);
          item.mesh.material.dispose();
          items.splice(i, 1);
        }
      }
    },
  };
}

export function createPulse(scene) {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(0.35, 0.52, 40),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.visible = false;
  scene.add(mesh);
  let life = 0;
  let max = 0.7;
  let radius = 2;
  return {
    fire(x, z, color, size = 2.2) {
      mesh.visible = true;
      mesh.position.set(x, mesh.position.y, z);
      mesh.material.color.setHex(color);
      mesh.material.opacity = 0.85;
      life = 0.7;
      max = 0.7;
      radius = size;
    },
    setFloor(y) {
      mesh.position.y = y + 0.05;
    },
    update(dt) {
      if (!mesh.visible) return;
      life -= dt;
      const k = 1 - Math.max(0, life) / max;
      const scale = 0.35 + k * radius;
      mesh.scale.setScalar(scale);
      mesh.material.opacity = (1 - k) * 0.8;
      if (life <= 0) mesh.visible = false;
    },
  };
}
