import * as THREE from "../vendor/three/three.module.js";
import { dressAltar } from "./arena.js";
import { buildUnit, poseFigure } from "./figures.js";
import { ELEMENT, basicMat } from "./materials.js";
import { mountView } from "./stage.js";
import { unitById } from "./units.js";

export function playSummon(container, results, hooks) {
  const best = (results || []).reduce((max, row) => Math.max(max, row.rarity || 3), 3);
  const featured = [...(results || [])].sort((a, b) => b.rarity - a.rarity || String(a.name).localeCompare(String(b.name)))[0];
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (reduced || !featured) {
    queueMicrotask(() => {
      hooks.onBurst?.(best);
      hooks.onDone?.();
    });
    return () => {};
  }
  let stopped = false;
  let burst = false;
  const started = performance.now();
  const view = mountView(container, ({ scene, camera }) => {
    dressAltar(scene);
    camera.position.set(0.2, 1.7, 4.4);
    camera.lookAt(0, 0.9, 0);
    const unit = unitById(featured.unitId);
    const color = ELEMENT[unit?.element] || "#f0d78c";
    const sparks = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 6, 4), basicMat(best >= 5 ? "#ffe08a" : color, 1), best >= 5 ? 48 : 28);
    sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    sparks.visible = false;
    scene.add(sparks);
    const dummy = new THREE.Object3D();
    let figure = null;
    const portal = scene.getObjectByName("portal");
    return {
      tick(now) {
        if (stopped) return;
        const t = now - started;
        if (portal) {
          portal.rotation.z = t / 280;
          portal.position.y = 0.55 + Math.sin(t / 200) * 0.05;
        }
        const goalZ = best >= 5 ? 2.7 : 3.15;
        camera.position.z += (goalZ - camera.position.z) * 0.04;
        camera.lookAt(0, 0.95, 0);
        if (t > 1500 && !figure) {
          figure = buildUnit(featured.unitId);
          figure.position.y = -0.4;
          scene.add(figure);
          sparks.visible = true;
          if (!burst) {
            burst = true;
            hooks.onBurst?.(best);
          }
        }
        if (figure) {
          const rise = Math.min(1, (t - 1500) / 700);
          figure.position.y = -0.4 + rise * 0.64;
          figure.rotation.y += best >= 5 ? 0.02 : 0.012;
          poseFigure(figure, rise < 1 ? "skill" : "idle", t / 1000);
          figure.userData.phase = rise;
        }
        if (sparks.visible) {
          const age = (t - 1500) / 1000;
          for (let i = 0; i < sparks.count; i++) {
            const ang = age * 2 + i;
            const radius = 0.4 + (i % 7) * 0.08 + Math.sin(age * 3 + i) * 0.1;
            dummy.position.set(Math.cos(ang) * radius, 0.9 + Math.sin(age * 2 + i) * 0.35, Math.sin(ang) * radius * 0.45);
            dummy.scale.setScalar(Math.max(0.2, 1 - (age % 1) * 0.5));
            dummy.updateMatrix();
            sparks.setMatrixAt(i, dummy.matrix);
          }
          sparks.instanceMatrix.needsUpdate = true;
        }
        if (t >= 4300) {
          stopped = true;
          hooks.onDone?.();
        }
      },
    };
  });
  return () => {
    stopped = true;
    view.stop?.();
  };
}
