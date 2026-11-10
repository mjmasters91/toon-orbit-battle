import { createGame } from "./game.js";

const errorBox = document.getElementById("boot-error");

try {
  const game = createGame();
  window.__STELLARBOUND = game;
  game.start();
} catch (error) {
  console.error(error);
  errorBox.hidden = false;
  errorBox.textContent = `The arena could not start. WebGL is required. ${error.message || ""}`;
}
