import { startSky } from "./sky.js";
import { boot } from "./ui.js";

const sky = document.getElementById("sky");
if (sky) startSky(sky);
boot(document.getElementById("app"));
