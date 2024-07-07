import { FileEntry } from "./file-entry.js";
import { create, registry, LocalCustomElement } from "./utils.js";

/**
 * ...
 */
export class DirEntry extends LocalCustomElement {
  init(name, fullPath = name) {
    this.setNameAndPath(name, fullPath);
    this.addButtons(name, fullPath);
  }

  connectedCallback() {
    this.clickListener = (evt) => {
      evt.stopPropagation();
      evt.preventDefault();
      if (this.path === `.`) return;
      const tag = evt.target.tagName;
      if (tag !== `DIR-ENTRY` && tag !== `DIR-HEADING`) return;
      const closed = this.classList.contains(`closed`);
      this.emit(
        `dir:click`,
        { path: this.path, currentState: closed ? `closed` : `open` },
        () => this.classList.toggle(`closed`),
      );
    };
    this.addEventListener(`click`, this.clickListener);

    this.removeListener = addDropZone(this);
    if (this.path === `.`) {
      this.draggable = false;
    }
  }

  disconnectedCallback() {
    this.removeListener();
    this.removeEventListener(`click`, this.clickListener);
  }

  setNameAndPath(name, fullPath) {
    this.name = name;
    this.path = fullPath;
    let heading = this.find(`dir-heading`);
    if (!heading || heading.parentNode !== this) {
      heading = this.heading = create(`dir-heading`);
      this.appendChild(heading);
    }
    heading.textContent = name.replace(`/`, ``);
  }

  addButtons(name, fullPath) {
    this.addNewEntryButton(name, fullPath);
    this.addUploadButton(name, fullPath);
    this.addRenameButton(name, fullPath);
    this.addDeleteButton(name, fullPath);
  }

  addNewEntryButton(name, fullPath) {
    const add = create(`button`);
    add.title = `add new file`;
    add.textContent = `+`;
    // FIXME: add this in connectedCallback, and remove in disconnectedCallback
    add.addEventListener(`click`, () => addEntryToDir(this, fullPath));
    this.appendChild(add);
  }

  addUploadButton(name, fullPath) {
    const upload = create(`button`);
    upload.title = `upload files from your device`;
    upload.textContent = `💻`;
    // FIXME: add this in connectedCallback, and remove in disconnectedCallback
    upload.addEventListener(`click`, () => uploadFilesFromDevice(this));
    this.appendChild(upload);
  }

  addRenameButton(name, fullPath) {
    if (this.path !== `.`) {
      const rename = create(`button`);
      rename.title = `rename dir`;
      rename.textContent = `✏️`;
      this.appendChild(rename);
      // FIXME: add this in connectedCallback, and remove in disconnectedCallback
      rename.addEventListener(`click`, () => renameDir(this));
    }
  }

  addDeleteButton(name, fullPath) {
    const remove = create(`button`);
    remove.title = `delete dir`;
    remove.textContent = `🗑️`;
    this.appendChild(remove);
    // FIXME: add this in connectedCallback, and remove in disconnectedCallback
    remove.addEventListener(`click`, () => deleteDir(this));
  }

  setFiles(files = []) {
    for (let fileName of files) this.addEntry(fileName, fileName);
    this.sort();
  }

  addEntry(fileName, fullPath = fileName) {
    if (!fileName.includes(`/`)) {
      if (fileName.includes(`.`)) {
        return this.addFile(fileName, fullPath);
      } else {
        // this is a dir, make sure to add the trailing `/`
        return this.addDirectory(fileName + `/`, fullPath + `/`);
      }
    }

    const dirName = fileName.substring(0, fileName.indexOf(`/`) + 1);
    const dirPath = (this.path === `.` ? `` : this.path) + dirName;
    let dir = this.find(`& > dir-entry[name="${dirName}"]`);
    if (!dir) {
      dir = new DirEntry();
      dir.init(dirName, dirPath);
      this.appendChild(dir);
    }
    this.sort();
    return dir.addEntry(fileName.replace(dirName, ``), fullPath);
  }

  addFile(fileName, fullPath) {
    let file = this.find(`& > file-entry[name="${fileName}"]`);
    if (!file) {
      file = new FileEntry();
      file.init(fileName, fullPath);
      this.appendChild(file);
      this.sort(false);
    }
    return file;
  }

  addFileFromUpload(fileName, content) {
    const localPath = this.path;
    const fullPath = (localPath !== `.` ? localPath : ``) + fileName;
    this.emit(`file:upload`, { path: fullPath, content }, () => {
      this.addEntry(fileName, fullPath);
      this.sort();
    });
  }

  addDirectory(dirName, fullPath) {
    let dir = this.find(`& > dir-entry[name="${dirName}"]`);
    if (!dir) {
      dir = new DirEntry();
      dir.init(dirName, fullPath);
      this.appendChild(dir);
      this.sort(false);
    }
    return dir;
  }

  sort(recursive = true) {
    const children = [...this.children];
    children.sort((a, b) => {
      // dir heading goes first
      if (a.tagName === `DIR-HEADING`) return -1;
      if (b.tagName === `DIR-HEADING`) return 1;

      // then the buttons
      if (a.tagName === `BUTTON`) return -1;
      if (b.tagName === `BUTTON`) return 1;

      // then dirs, sorted by name, if there are any
      if (a.tagName === `DIR-ENTRY` && b.tagName === `DIR-ENTRY`) {
        a = a.path;
        b = b.path;
        return a < b ? -1 : 1;
      } else if (a.tagName === `DIR-ENTRY`) {
        return -1;
      } else if (b.tagName === `DIR-ENTRY`) {
        return 1;
      }

      // then finally, files.
      a = a.path;
      b = b.path;
      return a < b ? -1 : 1;
    });

    children.forEach((c) => this.appendChild(c));

    if (recursive) {
      this.findAll(`& > dir-entry`).forEach((d) => d.sort(recursive));
    }
  }

  relocateContent(oldPath, newPath) {
    for (let c of this.children) c.relocateContent?.(oldPath, newPath);
  }

  removeEntry(path) {
    if (path === this.path) {
      return this.remove();
    }
    for (let c of this.children) c.removeEntry?.(path);
  }

  selectEntry(filePath) {
    for (let c of this.children) c.selectEntry?.(filePath);
  }

  checkEmpty() {
    if (!this.removeEmpty) return;
    if (!this.find(`file-entry`)) {
      this.emit(`dir:delete`, { path: this.path }, () => this.remove());
    }
  }

  toJSON() {
    return JSON.stringify(this.toValue());
  }

  toString() {
    return this.toValue().join(`,`);
  }

  toValue() {
    return [
      this.findAll(`& > dir-entry`).map((d) => d.toValue()),
      this.findAll(`& > file-entry`).map((f) => f.toValue()),
    ].flat(Infinity);
  }
}

class DirHeading extends LocalCustomElement {
  // this is "just an HTML element" for housing some text
}

registry.define(`dir-entry`, DirEntry);
registry.define(`dir-heading`, DirHeading);

/**
 * ...
 */
export /*async*/ function getFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = ({ target }) => resolve(target.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * ...
 */
function inThisDir(dir, entry) {
  if (entry === dir) return true; // if you squint
  return entry.parentDir === dir;
}

/**
 * Add file and dir drop-zone functionality to the file tree
 */
function addDropZone(dirEntry) {
  const abort = new AbortController();

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
    { signal: abort.signal },
  );

  // drag enter: mark element as being dragged
  dirEntry.addEventListener(
    `dragenter`,
    (evt) => {
      evt.preventDefault();
      unmark();
      dirEntry.classList.add(`drop-target`);
    },
    { signal: abort.signal },
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
    { signal: abort.signal },
  );

  // drag leave: stop highlighting this specific directory
  dirEntry.addEventListener(
    `dragleave`,
    (evt) => {
      evt.preventDefault();
      unmark();
    },
    { signal: abort.signal },
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
    { signal: abort.signal },
  );

  return () => abort.abort();
}

function addEntryToDir(dirEntry, dir) {
  let fileName = prompt("Please specify a filename.")?.trim();
  if (fileName) {
    if (fileName.includes(`/`)) {
      return alert(
        `Just add new files directly to the directory where they should live.`,
      );
    }

    let prompted = fileName;
    if (dir !== `.`) {
      fileName = dir + fileName;
    }

    // Can't create something that already exists:
    const exists = dirEntry.findInTree(`[path="${fileName}"]`);
    if (exists) return;

    if (fileName.includes(`.`)) {
      dirEntry.emit(`file:create`, { path: fileName }, () => {
        return dirEntry.addEntry(prompted, fileName);
      });
    } else {
      if (confirm(`Did you mean to create a new directory ${fileName}?`)) {
        dirEntry.emit(`dir:create`, { path: fileName }, () => {
          dirEntry.addDirectory(prompted + `/`, fileName + `/`);
        });
      }
    }
  }
}

function uploadFilesFromDevice(dirEntry) {
  const upload = create(`input`);
  upload.type = `file`;
  upload.multiple = true;
  const uploadFiles = confirm(
    `To upload one or more files, press "OK". To upload an entire folder, press "Cancel".`,
  );
  if (!uploadFiles) upload.webkitdirectory = true;
  upload.addEventListener(`change`, () => {
    const { files } = upload;
    if (!files) return;
    processUpload(dirEntry, files);
  });
  upload.click();
}

async function processUpload(dirEntry, items) {
  async function iterate(item, path = ``) {
    if (item instanceof File) {
      const content = await getFileContent(item);
      const fileName = path + (item.webkitRelativePath || item.name);
      dirEntry.addFileFromUpload(fileName, content);
    } else if (item.isFile) {
      item.file(async (file) => {
        const content = await getFileContent(file);
        const fileName = path + file.name;
        dirEntry.addFileFromUpload(fileName, content);
      });
    } else if (item.isDirectory) {
      // NOTE: This will skip empty dirs, which is unfortunately by design. The
      //       whole "uploading an entire folder" isn't part of the standard, so
      //       all browser makers (lol, all two of them) support this sad version.
      const updatedPath = path + item.name + "/";
      item.createReader().readEntries(async (entries) => {
        for (let entry of entries) await iterate(entry, updatedPath);
      });
    }
  }

  for await (let item of items) {
    try {
      await iterate(item instanceof File ? item : item.webkitGetAsEntry());
    } catch (e) {
      return alert(`Unfortunately, a ${item.kind} is not a file or folder.`);
    }
  }
}

function renameDir(dirEntry) {
  const newName = prompt(
    `Choose a new directory name`,
    dirEntry.heading.textContent,
  )?.trim();
  if (newName) {
    if (newName.includes(`/`)) {
      return alert(`If you want to relocate a dir, just move it.`);
    }
    const oldName = dirEntry.heading.textContent;
    const oldPath = dirEntry.path;
    const newPath = oldPath.replace(oldName, newName);

    const dir = dirEntry.findInTree(`dir-entry[path="${newPath}"]`);
    if (
      dir &&
      confirm(`That directory already exists. Move all the content?`)
    ) {
      dirEntry.emit(`dir:rename`, { oldPath, newPath }, () => {
        const oldPath = dirEntry.path;
        // TODO: make this a function call
        // TODO: check if this is safe? (e.g. are there already entries with the same paths in the tree?)
        dirEntry.heading.textContent = newName;
        dirEntry.name = newName;
        dirEntry.path = newPath;
        dirEntry.relocateContent(oldPath, newPath);
        return { oldPath, newPath };
      });
    }
  }
}

function deleteDir(dirEntry) {
  const msg = `Are you *sure* you want to delete this directory and everything in it?`;
  if (confirm(msg)) {
    dirEntry.emit(`dir:delete`, { path: dirEntry.path }, () => {
      dirEntry.remove();
    });
  }
}

function processRelocation(dirEntry, entryId) {
  const entry = dirEntry.findInTree(`[data-id="${entryId}"]`);
  delete entry.dataset.id;
  entry.classList.remove(`dragging`);

  if (entry === dirEntry) return;

  const oldPath = entry.path;
  const dirPath = dirEntry.path;

  if (entry instanceof FileEntry) {
    const newPath =
      (dirPath !== `.` ? dirPath : ``) +
      oldPath.substring(oldPath.lastIndexOf(`/`) + 1);

    if (oldPath !== newPath) {
      const grant = dirEntry.root.relocateEntry(oldPath, newPath);
      if (grant) {
        dirEntry.emit(`file:move`, { oldPath, newPath }, grant);
      }
    }
  }

  if (entry instanceof DirEntry) {
    const newPath =
      (dirPath !== `.` ? dirPath : ``) + entry.heading.textContent + `/`;
    if (oldPath !== newPath) {
      const grant = dirEntry.root.relocateEntry(oldPath, newPath);
      if (grant) {
        dirEntry.emit(`dir:move`, { oldPath, newPath }, grant);
      }
    }
  }
}
