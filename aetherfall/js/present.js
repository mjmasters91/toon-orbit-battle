import * as THREE from "../vendor/three/three.module.js";
import { dressAltar, dressSanctuary, pedestal } from "./arena.js";
import { buildUnit, poseFigure } from "./figures.js";
import { mountView, releaseView, snapshotUnit } from "./stage.js";

const thumbs = new Map();

export function thumbURL(id) {
  if (!id) return "";
  if (thumbs.has(id)) return thumbs.get(id);
  const url = snapshotUnit(() => buildUnit(id));
  thumbs.set(id, url);
  return url;
}

function bindYaw(container, apply) {
  let dragging = false;
  let last = 0;
  const down = (event) => {
    dragging = true;
    last = event.clientX;
  };
  const move = (event) => {
    if (!dragging) return;
    apply(event.clientX - last);
    last = event.clientX;
  };
  const up = () => { dragging = false; };
  container.addEventListener("pointerdown", down);
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  return () => {
    container.removeEventListener("pointerdown", down);
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };
}

function showFigure(container, id, { spin = true, pedestalOn = true, cam = [0.4, 1.25, 3.25], look = [0, 0.72, 0] } = {}) {
  if (!container || !id) return;
  let yaw = 0.4;
  let dragging = false;
  const unbind = bindYaw(container, (dx) => {
    dragging = true;
    yaw += dx * 0.01;
  });
  mountView(container, ({ scene, camera }) => {
    dressSanctuary(scene);
    if (pedestalOn) scene.add(pedestal(0.55));
    const figure = buildUnit(id);
    figure.position.y = 0;
    const pivot = new THREE.Group();
    pivot.add(figure);
    scene.add(pivot);
    camera.position.set(cam[0], cam[1], cam[2]);
    camera.lookAt(look[0], look[1], look[2]);
    return {
      tick(now) {
        if (spin && !dragging) yaw += 0.005;
        pivot.rotation.y = yaw;
        poseFigure(figure, "idle", now / 1000);
      },
      onDispose: unbind,
    };
  });
}

export function presentView(route, state) {
  const leaderId = state?.save?.party?.[state.save.leader] || state?.save?.party?.find(Boolean) || "pip";
  const title = document.querySelector("[data-stage='title']");
  if (title) showFigure(title, "veyra", { cam: [0.45, 1.3, 3.5] });
  const leader = document.querySelector("[data-stage='leader']");
  if (leader) showFigure(leader, leader.dataset.unit || leaderId);
  const detail = document.querySelector("[data-stage='detail']");
  if (detail) showFigure(detail, detail.dataset.unit);
  const hero = document.querySelector("[data-stage='hero']");
  if (hero) showFigure(hero, hero.dataset.unit, { cam: [0.35, 1.2, 3.05] });
  const altar = document.querySelector("[data-stage='altar']");
  if (altar) {
    mountView(altar, ({ scene, camera }) => {
      dressAltar(scene);
      camera.position.set(0.4, 1.5, 3.6);
      camera.lookAt(0, 0.8, 0);
      const portal = scene.getObjectByName("portal");
      const outer = scene.getObjectByName("portal-outer");
      return {
        tick(now) {
          const t = now / 1000;
          if (portal) portal.rotation.z = t * 0.6;
          if (outer) outer.rotation.z = -t * 0.35;
        },
      };
    });
  }
  const party = document.querySelector("[data-stage='party']");
  if (party) {
    const ids = (party.dataset.units || "").split(",").filter(Boolean).slice(0, 4);
    let yaw = 0.2;
    const unbind = bindYaw(party, (dx) => { yaw += dx * 0.008; });
    mountView(party, ({ scene, camera }) => {
      dressSanctuary(scene);
      const group = new THREE.Group();
      ids.forEach((id, index) => {
        const figure = buildUnit(id);
        figure.position.set((index - (ids.length - 1) / 2) * 0.85, 0, 0);
        group.add(pedestal(0.38).translateX(figure.position.x), figure);
      });
      scene.add(group);
      camera.position.set(0, 1.35, 4.4);
      camera.lookAt(0, 0.85, 0);
      return {
        tick(now) {
          group.rotation.y = yaw;
          group.children.forEach((child) => {
            if (child.userData?.parts) poseFigure(child, "idle", now / 1000 + child.position.x);
          });
        },
        onDispose: unbind,
      };
    });
  }
  if (route?.name === "title" || route?.name === "home" || route?.name === "detail" || route?.name === "party" || route?.name === "summon") {
    return;
  }
}

export { releaseView };
