import "./index.js";
import { createPatch, applyPatch } from "./jsdiff.js";

const content = {};
const fileTree = document.querySelector(`file-tree`);
const editor = document.getElementById(`editor`);

let currentEntry;

function updateEditor() {
  editor.value = content[currentEntry.path];
}

fileTree.addEventListener(`file:click`, async ({ detail }) => {
  const entry = detail.entry ?? detail.grant();
  content[entry.path] ??= (await entry.load()).data;
  currentEntry = entry;
  updateEditor();

  entry.addEventListener(`content:update`, async (evt) => {
    const { type, update } = evt.detail;
    if (type === `jsdiff`) {
      const { path } = entry;
      if (!content[path]) return;
      const oldContent = content[path];
      const newContent = applyPatch(oldContent, update);
      content[path] = newContent;
      if (entry === currentEntry) updateEditor();
    }
  });
});

editor.addEventListener(`input`, ({ target: panel }) => {
  const { path } = currentEntry;
  const a = content[path];
  const b = panel.value;
  const patch = createPatch(path, a, b);
  currentEntry.updateContent(`jsdiff`, patch);
  content[path] = b;
});
