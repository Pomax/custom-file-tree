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
  `backup/src/utils.js`,
  `backup/README.md`,
  `backup/dist/README.md`,
  `backup/dist/file-tree.esm.js`,
  `backup/test/README.md`,
  `backup/public/index.html`,
  `backup/src/file-entry.js`,
  `backup/public/README.md`,
  `backup/src/dir-entry.js`,
  `backup/package.json`,
  `backup/public/index.js`,
  `backup/src/README.md`,
  `backup/dist/file-tree.esm.min.js`,
  `backup/test/cake.because.why.not`,
  `backup/src/file-tree.js`,
  `backup/src/file-tree.css`,
  `backup/_/src/utils.js`,
  `backup/_/README.md`,
  `backup/_/dist/README.md`,
  `backup/_/dist/file-tree.esm.js`,
  `backup/_/test/README.md`,
  `backup/_/public/index.html`,
  `backup/_/src/file-entry.js`,
  `backup/_/public/README.md`,
  `backup/_/src/dir-entry.js`,
  `backup/_/package.json`,
  `backup/_/public/index.js`,
  `backup/_/src/README.md`,
  `backup/_/dist/file-tree.esm.min.js`,
  `backup/_/test/cake.because.why.not`,
  `backup/_/src/file-tree.js`,
  `backup/_/src/file-tree.css`,
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
    const { content, grant, ...rest } = detail;
    console.log(type, { ...rest });
    grant();
  })
);
