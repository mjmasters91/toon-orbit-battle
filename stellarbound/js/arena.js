import * as THREE from "three";

export const FLOOR_Y = 0.62;

function canvasTexture(size, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext("2d"), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function stoneTexture() {
  return canvasTexture(1024, (g, size) => {
    g.fillStyle = "#1c2230";
    g.fillRect(0, 0, size, size);
    const image = g.getImageData(0, 0, size, size);
    for (let i = 0; i < image.data.length; i += 4) {
      const n = (Math.random() * 26) | 0;
      image.data[i] = Math.min(255, image.data[i] + n);
      image.data[i + 1] = Math.min(255, image.data[i + 1] + n + 2);
      image.data[i + 2] = Math.min(255, image.data[i + 2] + n + 8);
    }
    g.putImageData(image, 0, 0);
    for (let i = 0; i < 36; i += 1) {
      g.fillStyle = `rgba(255,255,255,${0.015 + Math.random() * 0.03})`;
      g.beginPath();
      g.ellipse(
        Math.random() * size,
        Math.random() * size,
        30 + Math.random() * 110,
        20 + Math.random() * 70,
        Math.random() * Math.PI,
        0,
        Math.PI * 2,
      );
      g.fill();
    }
    g.strokeStyle = "rgba(0,0,0,0.28)";
    g.lineWidth = 2;
    for (let i = 0; i < 14; i += 1) {
      g.beginPath();
      let x = Math.random() * size;
      let y = Math.random() * size;
      g.moveTo(x, y);
      for (let s = 0; s < 5; s += 1) {
        x += (Math.random() - 0.5) * 140;
        y += (Math.random() - 0.5) * 140;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    g.strokeStyle = "rgba(228, 194, 122, 0.45)";
    g.lineWidth = 8;
    g.beginPath();
    g.arc(size / 2, size / 2, size * 0.28, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = "rgba(170, 196, 255, 0.22)";
    g.lineWidth = 3;
    g.beginPath();
    g.arc(size / 2, size / 2, size * 0.36, 0, Math.PI * 2);
    g.stroke();
  });
}

function skyTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const g = canvas.getContext("2d");
  const sky = g.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, "#070914");
  sky.addColorStop(0.45, "#141a33");
  sky.addColorStop(0.72, "#24304e");
  sky.addColorStop(1, "#1a140f");
  g.fillStyle = sky;
  g.fillRect(0, 0, 1024, 512);
  g.fillStyle = "rgba(186, 170, 255, 0.08)";
  g.beginPath();
  g.ellipse(520, 250, 340, 70, -0.3, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < 280; i += 1) {
    const x = Math.random() * 1024;
    const y = Math.random() * 360;
    const r = Math.random() * 1.4;
    g.fillStyle = Math.random() > 0.85 ? "rgba(255, 220, 160, 0.9)" : "rgba(255,255,255,0.85)";
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function starGeometry(outer, inner, points) {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

function glowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.4, "rgba(255,220,160,0.35)");
  grad.addColorStop(1, "rgba(255,220,160,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createArena(scene) {
  scene.background = new THREE.Color(0x0b1020);
  scene.fog = new THREE.Fog(0x0c1224, 28, 72);

  const hemi = new THREE.HemisphereLight(0xc5d2ff, 0x3a2c22, 1.15);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff1d4, 3.1);
  key.position.set(-8, 18, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 40;
  key.shadow.camera.left = -16;
  key.shadow.camera.right = 16;
  key.shadow.camera.top = 16;
  key.shadow.camera.bottom = -16;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.04;
  scene.add(key);
  scene.add(key.target);

  const fill = new THREE.DirectionalLight(0x8eabff, 0.9);
  fill.position.set(10, 8, 4);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffb56a, 0.75);
  rim.position.set(2, 5, -12);
  scene.add(rim);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(80, 28, 18),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);

  const starCount = 700;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i += 1) {
    const radius = 42 + Math.random() * 24;
    const theta = Math.random() * Math.PI * 2;
    const lift = Math.random();
    positions[i * 3] = Math.cos(theta) * radius;
    positions[i * 3 + 1] = 6 + lift * 28;
    positions[i * 3 + 2] = Math.sin(theta) * radius;
    const gold = Math.random() > 0.82;
    colors[i * 3] = gold ? 1 : 0.85;
    colors[i * 3 + 1] = gold ? 0.86 : 0.9;
    colors[i * 3 + 2] = gold ? 0.65 : 1;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  starGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ size: 0.18, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, fog: false }),
  );
  scene.add(stars);

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 18, 14),
    new THREE.MeshBasicMaterial({ color: 0xfff4d4, fog: false }),
  );
  moon.position.set(-26, 20, -16);
  scene.add(moon);
  const moonGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(),
      color: 0xffe2b0,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    }),
  );
  moonGlow.scale.set(16, 16, 1);
  moonGlow.position.copy(moon.position);
  scene.add(moonGlow);

  const stone = new THREE.MeshStandardMaterial({
    map: stoneTexture(),
    color: 0x9aa3b5,
    roughness: 0.92,
    metalness: 0.04,
  });
  const deck = new THREE.Mesh(new THREE.CircleGeometry(12.3, 72), stone);
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = FLOOR_Y;
  deck.receiveShadow = true;
  scene.add(deck);

  const lipMat = new THREE.MeshStandardMaterial({ color: 0x2a303c, roughness: 0.95, flatShading: true });
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(12.3, 13.1, 1.05, 48, 1, true), lipMat);
  lip.position.y = FLOOR_Y - 0.52;
  scene.add(lip);
  const under = new THREE.Mesh(
    new THREE.CircleGeometry(13.1, 40),
    new THREE.MeshStandardMaterial({ color: 0x151820, roughness: 1 }),
  );
  under.rotation.x = Math.PI / 2;
  under.position.y = FLOOR_Y - 1.05;
  scene.add(under);

  const starPivot = new THREE.Group();
  starPivot.position.y = FLOOR_Y + 0.035;
  const seal = new THREE.Mesh(
    starGeometry(2.15, 0.9, 8),
    new THREE.MeshBasicMaterial({
      color: 0xe7c98a,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  seal.rotation.x = -Math.PI / 2;
  starPivot.add(seal);
  scene.add(starPivot);

  const inlay = new THREE.Mesh(
    new THREE.TorusGeometry(4.7, 0.028, 6, 80),
    new THREE.MeshBasicMaterial({ color: 0xe4c27a }),
  );
  inlay.rotation.x = Math.PI / 2;
  inlay.position.y = FLOOR_Y + 0.04;
  scene.add(inlay);
  const inlayOuter = new THREE.Mesh(
    new THREE.TorusGeometry(6.6, 0.02, 6, 80),
    new THREE.MeshBasicMaterial({ color: 0x9eb6e8, transparent: true, opacity: 0.7 }),
  );
  inlayOuter.rotation.x = Math.PI / 2;
  inlayOuter.position.y = FLOOR_Y + 0.04;
  scene.add(inlayOuter);

  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x8d877c, roughness: 0.86, flatShading: true });
  const pillarDark = new THREE.MeshStandardMaterial({ color: 0x5c564c, roughness: 0.9, flatShading: true });
  for (let i = 0; i < 11; i += 1) {
    const angle = (i / 11) * Math.PI * 2 + 0.2;
    const z = Math.cos(angle) * 11.15;
    if (z > 5.5) continue;
    const height = 2.4 + (i % 4) * 0.55;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, height, 6), pillarMat);
    pillar.position.set(Math.sin(angle) * 11.15, FLOOR_Y + height / 2 - 0.05, z);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.18, 0.62), pillarDark);
    cap.position.y = height / 2 + 0.02;
    cap.rotation.y = i;
    pillar.add(cap);
    scene.add(pillar);
    if (i % 2 === 0) {
      const rubble = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.28), pillarDark);
      rubble.position.set(pillar.position.x + 0.45, FLOOR_Y + 0.1, pillar.position.z + 0.2);
      rubble.rotation.y = angle;
      rubble.castShadow = true;
      scene.add(rubble);
    }
  }

  const ridgeMat = new THREE.MeshStandardMaterial({ color: 0x151a28, roughness: 1, flatShading: true });
  for (let i = 0; i < 14; i += 1) {
    const angle = (i / 14) * Math.PI * 2;
    const height = 4 + (i % 5) * 1.8;
    const radius = 30 + (i % 3) * 2;
    const peak = new THREE.Mesh(new THREE.ConeGeometry(3.2 + (i % 3), height, 5), ridgeMat);
    peak.position.set(Math.sin(angle) * radius, height * 0.28 - 1.2, Math.cos(angle) * radius);
    scene.add(peak);
  }

  const bowl = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.7, flatShading: true });
  const flameMat = new THREE.MeshStandardMaterial({
    color: 0xffd39a,
    emissive: 0xff6a2c,
    emissiveIntensity: 1,
    roughness: 0.4,
    flatShading: true,
  });
  const braziers = [];
  for (const [x, z, color, intensity] of [
    [-8.8, 4.6, 0xff7a3c, 70],
    [8.8, 4.4, 0xff7a3c, 70],
    [-8.4, -5.4, 0x7f8cff, 48],
    [8.6, -5.2, 0x7f8cff, 48],
  ]) {
    const group = new THREE.Group();
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.8, 6), bowl);
    stand.position.y = 0.4;
    stand.castShadow = true;
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.22, 7), bowl);
    cup.position.y = 0.9;
    cup.castShadow = true;
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 5), flameMat.clone());
    flame.position.y = 1.22;
    flame.material.emissive.setHex(color);
    flame.material.color.setHex(color);
    group.add(stand, cup, flame);
    group.position.set(x, FLOOR_Y, z);
    scene.add(group);
    const light = new THREE.PointLight(color, intensity, 12, 2);
    light.position.set(x, FLOOR_Y + 1.4, z);
    scene.add(light);
    braziers.push(flame);
  }

  const moteCount = 70;
  const motePositions = new Float32Array(moteCount * 3);
  const moteSeeds = [];
  for (let i = 0; i < moteCount; i += 1) {
    motePositions[i * 3] = (Math.random() - 0.5) * 18;
    motePositions[i * 3 + 1] = Math.random() * 3;
    motePositions[i * 3 + 2] = (Math.random() - 0.5) * 18;
    moteSeeds.push(Math.random() * 4);
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute("position", new THREE.BufferAttribute(motePositions, 3));
  const motes = new THREE.Points(
    moteGeo,
    new THREE.PointsMaterial({ color: 0xffe1b5, size: 0.07, transparent: true, opacity: 0.75, depthWrite: false }),
  );
  motes.position.y = FLOOR_Y;
  scene.add(motes);

  return {
    floorY: FLOOR_Y,
    update(time) {
      starPivot.rotation.y = time * 0.08;
      stars.rotation.y = time * 0.012;
      braziers.forEach((flame, index) => {
        const flick = 0.85 + Math.sin(time * 11 + index) * 0.12 + Math.sin(time * 17 + index) * 0.06;
        flame.scale.set(1, flick, 1);
      });
      const attr = moteGeo.attributes.position;
      for (let i = 0; i < moteCount; i += 1) {
        attr.setY(i, (moteSeeds[i] + time * 0.18) % 3.4);
      }
      attr.needsUpdate = true;
    },
  };
}
