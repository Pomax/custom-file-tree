// Add <file-tree> to our page and grab the element
import "../dist/file-tree.esm.min.js";
const fileTree = document.querySelector(`file-tree`);

// Set some files. Intentionally terribly sorted.
const demoList = [
  `src/utils.js`,
  `README.md`,
  `dist/README.md`,
  `dist/file-tree.esm.js`,
  `test/README.md`,
  `public/index.html`,
  `src/file-entry.js`,
  `public/README.md`,
  `src/dir-entry.js`,
  `package.json`,
  `public/index.js`,
  `src/README.md`,
  `dist/file-tree.esm.min.js`,
  `test/cake.because.why.not`,
  `src/file-tree.js`,
  `src/file-tree.css`,
];

fileTree.setFiles(demoList);

// Listen for, and grant every, file tree event
const eventList = [
  // The main event your users care about
  `file:click`,
  // File events you care about
  `file:create`,
  `file:rename`,
  `file:upload`,
  `file:move`,
  `file:delete`,
  // Directory events you care about
  `dir:click`,
  `dir:create`,
  `dir:rename`,
  `dir:move`,
  `dir:delete`,
];

eventList.forEach((type) =>
  fileTree.addEventListener(type, (evt) => {
    const { type, detail } = evt;
    delete detail.content; // if we're uploading files, don't log their content: we don't care.
    console.log(type, detail);
    detail.grant();
  })
);
