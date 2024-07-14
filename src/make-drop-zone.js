/**
 * Add file and dir drop-zone functionality to the file tree
 */
export function makeDropZone(dirEntry) {
  const abortController = new AbortController();
  dirEntry.draggable = true;

  const unmark = () => {
    dirEntry
      .findAllInTree(`.drop-target`)
      .forEach((d) => d.classList.remove(`drop-target`));
  };

  // drag start: mark element as being dragged
  dirEntry.addEventListener(
    `dragstart`,
    (evt) => {
      evt.stopPropagation();
      dirEntry.classList.add(`dragging`);
      dirEntry.dataset.id = `${Date.now()}-${Math.random()}`;
      evt.dataTransfer.setData("id", dirEntry.dataset.id);
    },
    { signal: abortController.signal }
  );

  // drag enter: mark element as being dragged
  dirEntry.addEventListener(
    `dragenter`,
    (evt) => {
      evt.preventDefault();
      unmark();
      dirEntry.classList.add(`drop-target`);
    },
    { signal: abortController.signal }
  );

  // drag over: highlight this specific directory
  dirEntry.addEventListener(
    `dragover`,
    (evt) => {
      const el = evt.target;

      if (inThisDir(dirEntry, el)) {
        evt.preventDefault();
        unmark();
        dirEntry.classList.add(`drop-target`);
      }
    },
    { signal: abortController.signal }
  );

  // drag leave: stop highlighting this specific directory
  dirEntry.addEventListener(
    `dragleave`,
    (evt) => {
      evt.preventDefault();
      unmark();
    },
    { signal: abortController.signal }
  );

  // drop: what is being dropped here?
  dirEntry.addEventListener(
    `drop`,
    async (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      unmark();

      // Is this a file/dir relocation?
      const entryId = evt.dataTransfer.getData(`id`);
      if (entryId) return processRelocation(dirEntry, entryId);

      // If not, it's a file/dir upload from device.
      await processUpload(dirEntry, evt.dataTransfer.items);
    },
    { signal: abortController.signal }
  );

  // Special handling: the root itself is definitely not draggable!
  if (dirEntry.path === `.`) {
    return (dirEntry.draggable = false);
  }

  return abortController;
}

function inThisDir(dir, entry) {
  if (entry === dir) return true;
  return entry.closest(`dir-entry`) === dir;
}

function processRelocation(dirEntry, entryId) {
  const entry = dirEntry.findInTree(`[data-id="${entryId}"]`);
  delete entry.dataset.id;
  entry.classList.remove(`dragging`);

  if (entry === dirEntry) return;

  const oldPath = entry.path;
  let dirPath = dirEntry.path;
  let newPath = (dirPath !== `.` ? dirPath : ``) + entry.name;

  if (entry.isDir) newPath += `/`;
  console.log({ dirPath, name: entry.name, newPath });

  dirEntry.root.moveEntry(entry, oldPath, newPath);
}
