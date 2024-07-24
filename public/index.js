import { drag, tap } from "./touch-simulation.js";
globalThis.simulatedTouch = { drag, tap };

// Add <file-tree> to our page and grab the element
import "../dist/file-tree.esm.js";
const fileTree = document.querySelector(`file-tree`);

// Then listen for, and grant every, file tree event:
const eventList = [
  // The main event your users care about
  `file:click`,
  // File events you care about
  `file:create`,
  `file:rename`,
  `file:move`,
  `file:delete`,
  // Directory events your users care about
  `dir:click`,
  `dir:toggle`,
  // Directory events you care about
  `dir:create`,
  `dir:rename`,
  `dir:move`,
  `dir:delete`,
];

eventList.forEach((type) =>
  fileTree.addEventListener(type, ({ detail }) => detail.grant())
);
