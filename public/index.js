// Add <file-tree> to our page and grab the element
import "../dist/file-tree.esm.min.js";
const fileTree = document.querySelector(`file-tree`);

// Set some files
const demoList = [
  `README.md`,
  `package.json`,
  `dist/file-tree.esm.js`,
  `dist/file-tree.esm.min.js`,
  `public/index.html`,
  `public/index.js`,
  `src/file-tree.js`,
  `src/file-entry.js`,
  `src/dir-entry.js`,
  `src/utils.js`,
  `src/file-tree.css`,
];

fileTree.setFiles(demoList);

// Listen for, and grant every, file tree event
const eventList = [
  `file:click`,
  `file:create`,
  `file:rename`,
  `file:upload`,
  `file:move`,
  `file:delete`,
  `dir:create`,
  `dir:rename`,
  `dir:move`,
  `dir:delete`,
];

eventList.forEach((name) =>
  fileTree.addEventListener(`filetree:${name}`, (evt) => evt.detail.grant())
);
