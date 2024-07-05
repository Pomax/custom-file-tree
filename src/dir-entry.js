import { FileEntry } from "./file-entry.js";
import {
  create,
  registry,
  LocalCustomElement,
  dispatchEvent,
  find,
  findAll,
} from "./utils.js";

/**
 * ...
 */
export class DirEntry extends LocalCustomElement {
  init(name, fullPath = name) {
    this.setNameAndPath(name, fullPath);
    this.addButtons(name, fullPath);
  }

  connectedCallback() {
    this.removeListener = addDropZone(this);
    if (this.getAttribute(`path`) === `.`) {
      this.draggable = false;
    }
  }

  disconnectedCallback() {
    this.removeListener();
  }

  setNameAndPath(name, fullPath) {
    this.setAttribute(`name`, name);
    this.setAttribute(`path`, fullPath);
    let heading = find(`dir-heading`, this);
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
    if (this.getAttribute(`path`) !== `.`) {
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
    const dirPath = fullPath.substring(0, fullPath.lastIndexOf(`/`) + 1);
    let dir = find(`& > dir-entry[name="${dirName}"]`, this);
    if (!dir) {
      dir = new DirEntry();
      dir.init(dirName, dirPath);
      this.appendChild(dir);
    }
    return dir.addEntry(fileName.replace(dirName, ``), fullPath);
  }

  addFile(fileName, fullPath) {
    let file = find(`& > file-entry[name="${fileName}"]`, this);
    if (!file) {
      file = new FileEntry();
      file.init(fileName, fullPath);
      this.appendChild(file);
      this.sort(false);
    }
    return file;
  }

  addFileFromUpload(fileName, content) {
    const localPath = this.getAttribute(`path`);
    const fullPath = (localPath !== `.` ? localPath : ``) + fileName;
    dispatchEvent(
      this,
      `filetree:file:upload`,
      { fileName: fullPath, content },
      () => {
        this.addEntry(fileName, fullPath);
        this.sort();
      },
    );
  }

  addDirectory(dirName, fullPath) {
    let dir = find(`& > dir-entry[name="${dirName}"]`, this);
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
        a = a.getAttribute(`path`);
        b = b.getAttribute(`path`);
        return a < b ? -1 : 1;
      } else if (a.tagName === `DIR-ENTRY`) {
        return -1;
      } else if (b.tagName === `DIR-ENTRY`) {
        return 1;
      }

      // then finally, files.
      a = a.getAttribute(`path`);
      b = b.getAttribute(`path`);
      return a < b ? -1 : 1;
    });

    children.forEach((c) => this.appendChild(c));

    if (recursive) {
      findAll(`dir-entry`, this).forEach((d) => d.sort(recursive));
    }
  }

  relocateContent(oldPath, newPath) {
    for (let c of this.children) c.relocateContent?.(oldPath, newPath);
  }

  removeEntry(path) {
    for (let c of this.children) c.removeEntry?.(path);
  }

  selectEntry(filePath) {
    for (let c of this.children) c.selectEntry?.(filePath);
  }

  checkEmpty() {
    if (!this.root.getAttribute(`remove-empty`)) return;
    if (!find(`file-entry`, this)) {
      dispatchEvent(
        this,
        `filetree:dir:delete`,
        { path: this.getAttribute(`path`) },
        () => {
          this.parentNode.removeChild(this);
        },
      );
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
      findAll(`& > dir-entry`, this).map((d) => d.toValue()),
      findAll(`& > file-entry`, this).map((f) => f.toValue()),
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
    reader.readAsText(file);
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
      findAll(`.drop`).forEach((d) => d.classList.remove(`drop`));
      dirEntry.classList.add(`drop`);
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
        findAll(`.drop`).forEach((d) => d.classList.remove(`drop`));
        dirEntry.classList.add(`drop`);
      }
    },
    { signal: abort.signal },
  );

  // drag leave: stop highlighting this specific directory
  dirEntry.addEventListener(
    `dragleave`,
    (evt) => {
      evt.preventDefault();
      findAll(`.drop`).forEach((d) => d.classList.remove(`drop`));
    },
    { signal: abort.signal },
  );

  // drop: what is being dropped here?
  dirEntry.addEventListener(
    `drop`,
    async (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      findAll(`.drop`).forEach((d) => d.classList.remove(`drop`));

      // Is this a file/dir relocation?
      const entryId = evt.dataTransfer.getData(`id`);
      if (entryId) {
        return processRelocation(dirEntry, entryId);
      }

      // If not, it's a file/dir upload from device.
      await processUpload(dirEntry, evt.dataTransfer.items);
    },
    { signal: abort.signal },
  );

  return () => abort.abort();
}

function addEntryToDir(dirEntry, dir) {
  let fileName = prompt(
    "Please specify a filename.\nUse / as directory delimiter (e.g. cake/yum.js)",
  )?.trim();
  if (fileName) {
    let prompted = fileName;
    if (dir !== `.`) {
      fileName = dir + fileName;
    }

    // Can't create something that already exists:
    const exists = find(`[path="${fileName}"]`, dirEntry.root);
    if (exists) return;

    if (fileName.includes(`.`)) {
      dispatchEvent(dirEntry, `filetree:file:create`, { fileName }, () => {
        return dirEntry.addEntry(prompted, fileName);
      });
    } else {
      if (confirm(`Did you mean to create a new directory ${fileName}?`)) {
        dispatchEvent(
          dirEntry,
          `filetree:dir:create`,
          { dirName: fileName },
          () => {
            dirEntry.addDirectory(prompted + `/`, fileName + `/`);
          },
        );
      }
    }
  }
}

function uploadFilesFromDevice(dirEntry) {
  const upload = create(`input`);
  upload.type = `file`;
  upload.multiple = true;
  const which = confirm(
    `To upload one or more files, press "OK". To upload an entire folder, press "Cancel".`,
  );
  if (!which) upload.webkitdirectory = true;
  upload.addEventListener(`change`, () => {
    const { files } = upload;
    if (!files) return;
    console.log(files);
    processUpload(dirEntry, files);
  });
  upload.click();
}

async function processUpload(dirEntry, items) {
  console.log(items);

  // TODO: this will skip empty dirs, but is that a problem?
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
      item.createReader().readEntries(async (entries) => {
        for (let entry of entries) await iterate(entry, path + item.name + "/");
      });
    }
  }

  // try {
  await Promise.all(
    [...items].map(
      async (item) =>
        await iterate(item instanceof File ? item : item.webkitGetAsEntry()),
    ),
  );
  // } catch (e) {
  //   alert(
  //     `Received incorrect data.\n\nIf you dragged files or folders from your device,\nplease retry dragging from a proper file browser.\n(Many applications actually drag strings, not files)`
  //   );
  // }
}

function renameDir(dirEntry) {
  const newName = prompt(
    `Choose a new directory name`,
    dirEntry.heading.textContent,
  )?.trim();
  if (newName) {
    const oldName = dirEntry.heading.textContent;
    const oldPath = dirEntry.getAttribute(`path`);
    const newPath = oldPath.replace(oldName, newName);

    const dir = find(`dir-entry[path="${newPath}"]`, dirEntry.root);
    if (
      dir &&
      confirm(`That directory already exists. Move all the content?`)
    ) {
      dispatchEvent(
        dirEntry,
        `filetree:dir:rename`,
        { oldPath, newPath },
        () => {
          const oldPath = dirEntry.getAttribute(`path`);
          // TODO: make this a function call
          // TODO: check if this is safe? (e.g. are there already entries with the same paths in the tree?)
          dirEntry.heading.textContent = newName;
          dirEntry.setAttribute(`name`, newName);
          dirEntry.setAttribute(`path`, newPath);
          dirEntry.relocateContent(oldPath, newPath);
          return { oldPath, newPath };
        },
      );
    }
  }
}

function deleteDir(dirEntry) {
  const msg = `Are you *sure* you want to delete this directory and everything in it?`;
  if (confirm(msg)) {
    dispatchEvent(
      dirEntry,
      `filetree:dir:delete`,
      { path: dirEntry.getAttribute(`path`) },
      () => {
        dirEntry.remove();
      },
    );
  }
}

function processRelocation(dirEntry, entryId) {
  const entry = find(`[data-id="${entryId}"]`);
  delete entry.dataset.id;
  entry.classList.remove(`dragging`);

  if (entry === dirEntry) return;

  const oldPath = entry.getAttribute(`path`);
  const dirPath = dirEntry.getAttribute(`path`);

  if (entry instanceof FileEntry) {
    const newPath =
      (dirPath !== `.` ? dirPath : ``) +
      oldPath.substring(oldPath.lastIndexOf(`/`) + 1);

    if (oldPath !== newPath) {
      const exists = find(`[path="${newPath}"]`, dirEntry.root);
      if (exists) return alert(`File ${newPath} already exists.`);
      dispatchEvent(
        dirEntry,
        `filetree:file:move`,
        { oldPath, newPath },
        () => {
          entry.setAttribute(`path`, newPath);
          dirEntry.appendChild(entry);
          dirEntry.sort();
        },
      );
    }
  }

  if (entry instanceof DirEntry) {
    const newPath =
      (dirPath !== `.` ? dirPath : ``) + entry.heading.textContent + `/`;
    if (oldPath !== newPath) {
      const exists = find(`[path="${newPath}"]`, dirEntry.root);
      if (exists) return alert(`Dir ${newPath} already exists.`);
      dispatchEvent(dirEntry, `filetree:dir:move`, { oldPath, newPath }, () => {
        findAll(`[path]`, entry).forEach((e) => {
          e.setAttribute(
            `path`,
            e.getAttribute(`path`).replace(oldPath, newPath),
          );
        });
        entry.setAttribute(
          `path`,
          entry.getAttribute(`path`).replace(oldPath, newPath),
        );
        dirEntry.appendChild(entry);
        dirEntry.sort();
        return { oldPath, newPath };
      });
    }
  }
}
