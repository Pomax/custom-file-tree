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

  if (!entry.updateListener) {
    const updateListener = (entry.state.updateListener = async (evt) => {
      const { type, update } = evt.detail;
      if (type === `jsdiff`) {
        const { path } = entry;
        if (!content[path]) return;
        const oldContent = content[path];
        const newContent = applyPatch(oldContent, update);
        if (newContent == `false`) {
          console.log({
            oldContent,
            update,
          });
        }
        content[path] = newContent;
        if (entry === currentEntry) updateEditor();
      }
    });
    entry.addEventListener(`content:update`, updateListener);
  }
});

editor.addEventListener(`input`, ({ target: panel }) => {
  const { path } = currentEntry;
  const a = content[path];
  // the POSIX standard, which jsdiff is based on, says that
  // text files can't be empty, because they have to be
  // terminated by a newline. So... if someone empties the
  // textarea, we should make sure we're digging a newline.
  const b = panel.value || `\n`;
  const patch = createPatch(path, a, b);
  currentEntry.updateContent(`jsdiff`, patch);
  content[path] = b;
});
