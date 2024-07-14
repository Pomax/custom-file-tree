// src/utils.js
var create = (tag) => document.createElement(tag);
function isFile(path) {
  const parts = path.split(`/`).filter((v) => !!v);
  if (parts.at(-1).includes(`.`)) return true;
  const metaData = getPathMetaData(path);
  return !!metaData.file;
}
function getPathMetaData(path) {
  let metaData = {};
  const args = path.substring(path.indexOf(`?`))?.split(`&`) || [];
  args.forEach((v) => {
    if (v.includes(`=`)) {
      const [key, value] = v.split(`=`);
      metaData[key] = value;
    } else {
      metaData[v] = true;
    }
  });
  return metaData;
}
var registry = window.customElements;
function getFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = ({ target }) => resolve(target.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// src/file-tree-element.js
var HTMLElement = globalThis.HTMLElement ?? class {
};
var FileTreeElement = class extends HTMLElement {
  state = {};
  eventControllers = [];
  constructor(path = ``) {
    super();
    const heading = this.heading = create(`entry-heading`);
    this.appendChild(heading);
    this.path = path;
  }
  addExternalListener(target, eventName, handler, options = {}) {
    const abortController = new AbortController();
    options.signal = abortController.signal;
    target.addEventListener(eventName, handler, options);
    this.addAbortController(abortController);
  }
  addListener(eventName, handler, options = {}) {
    this.addExternalListener(this, eventName, handler, options);
  }
  addAbortController(controller) {
    this.eventControllers.push(controller);
  }
  disconnectedCallback() {
    const { eventControllers } = this;
    while (eventControllers.length) {
      eventControllers.shift().abort();
    }
  }
  get removeEmpty() {
    return this.root.getAttribute(`remove-empty`);
  }
  get name() {
    return this.getAttribute(`name`);
  }
  set name(name) {
    this.setAttribute(`name`, name);
  }
  get path() {
    return this.getAttribute(`path`);
  }
  set path(path) {
    if (!path) return;
    const pos = path.endsWith(`/`) ? -2 : -1;
    this.name = path.split(`/`).at(pos).replace(/#.*/, ``);
    if (!this.name && path) {
      throw Error(`why? path is ${path}`);
    }
    const heading = this.find(`& > entry-heading`);
    heading.textContent = this.name;
    this.setAttribute(`path`, path);
  }
  updatePath(oldPath, newPath) {
    const regex = new RegExp(`^${oldPath}`);
    this.path = this.path.replace(regex, newPath);
  }
  get dirPath() {
    let { path, name } = this;
    if (this.isFile) return path.replace(name, ``);
    if (this.isDir) return path.substring(0, path.lastIndexOf(name));
    throw Error(`entry is file nor dir.`);
  }
  get root() {
    return this.closest(`file-tree`);
  }
  get parentDir() {
    let element = this;
    if (element.tagName === `DIR-ENTRY`) {
      element = element.parentNode;
    }
    return element.closest(`dir-entry`);
  }
  emit(eventName, detail = {}, grant = () => {
  }) {
    detail.grant = () => {
      grant();
    };
    this.root.dispatchEvent(new CustomEvent(eventName, { detail }));
  }
  find(qs) {
    return this.querySelector(qs);
  }
  findInTree(qs) {
    return this.root.querySelector(qs);
  }
  findAll(qs) {
    return Array.from(this.querySelectorAll(qs));
  }
  findAllInTree(qs) {
    return Array.from(this.root.querySelectorAll(qs));
  }
  setState(stateUpdate) {
    Object.assign(this.state, stateUpdate);
  }
};
var EntryHeading = class extends HTMLElement {
};
registry.define(`entry-heading`, EntryHeading);

// src/upload-file.js
function uploadFilesFromDevice({ root, path }) {
  const upload = create(`input`);
  upload.type = `file`;
  upload.multiple = true;
  const uploadFiles = confirm(
    `To upload one or more files, press "OK". To upload an entire folder, press "Cancel".`
  );
  if (!uploadFiles) upload.webkitdirectory = true;
  upload.addEventListener(`change`, () => {
    const { files } = upload;
    if (!files) return;
    processUpload(root, files, path);
  });
  upload.click();
}
async function processUpload(root, items, dirPath = ``) {
  async function iterate(item, path = ``) {
    if (item instanceof File) {
      const content = await getFileContent(item);
      const filePath = path + (item.webkitRelativePath || item.name);
      root.createEntry(dirPath + filePath, content);
    } else if (item.isFile) {
      item.file(async (file) => {
        const content = await getFileContent(file);
        const filePath = path + file.name;
        root.createEntry(dirPath + filePath, content);
      });
    } else if (item.isDirectory) {
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

// src/make-drop-zone.js
function makeDropZone(dirEntry) {
  const abortController = new AbortController();
  dirEntry.draggable = true;
  const unmark = () => {
    dirEntry.findAllInTree(`.drop-target`).forEach((d) => d.classList.remove(`drop-target`));
  };
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
  dirEntry.addEventListener(
    `dragenter`,
    (evt) => {
      evt.preventDefault();
      unmark();
      dirEntry.classList.add(`drop-target`);
    },
    { signal: abortController.signal }
  );
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
  dirEntry.addEventListener(
    `dragleave`,
    (evt) => {
      evt.preventDefault();
      unmark();
    },
    { signal: abortController.signal }
  );
  dirEntry.addEventListener(
    `drop`,
    async (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      unmark();
      const entryId = evt.dataTransfer.getData(`id`);
      if (entryId) return processDragMove(dirEntry, entryId);
      await processUpload(dirEntry.root, evt.dataTransfer.items, dirEntry.path);
    },
    { signal: abortController.signal }
  );
  if (dirEntry.path === `.`) {
    return dirEntry.draggable = false;
  }
  return abortController;
}
function inThisDir(dir, entry) {
  if (entry === dir) return true;
  return entry.closest(`dir-entry`) === dir;
}
function processDragMove(dirEntry, entryId) {
  const entry = dirEntry.findInTree(`[data-id="${entryId}"]`);
  delete entry.dataset.id;
  entry.classList.remove(`dragging`);
  if (entry === dirEntry) return;
  const oldPath = entry.path;
  let dirPath = dirEntry.path;
  let newPath = (dirPath !== `.` ? dirPath : ``) + entry.name;
  if (entry.isDir) newPath += `/`;
  dirEntry.root.moveEntry(entry, oldPath, newPath);
}

// src/dir-entry.js
var DirEntry = class extends FileTreeElement {
  isDir = true;
  constructor(name, fullPath = name) {
    super(name, fullPath);
    this.addButtons();
  }
  connectedCallback() {
    this.clickListener = (evt) => {
      evt.stopPropagation();
      evt.preventDefault();
      if (this.path === `.`) return;
      const tag = evt.target.tagName;
      if (tag !== `DIR-ENTRY` && tag !== `ENTRY-HEADING`) return;
      const closed = this.classList.contains(`closed`);
      this.root.selectEntry(this, { currentState: closed ? `closed` : `open` });
    };
    this.addListener(`click`, this.clickListener);
    const controller = makeDropZone(this);
    if (controller) this.addAbortController(controller);
  }
  addButtons() {
    this.addRenameButton();
    this.addDeleteButton();
    this.createFileButton();
    this.createDirButton();
    this.addUploadButton();
  }
  /**
   * rename this dir.
   */
  addRenameButton() {
    if (this.path === `.`) return;
    const btn = create(`button`);
    btn.title = `Rename directory`;
    btn.textContent = `\u270F\uFE0F`;
    this.appendChild(btn);
    btn.addEventListener(`click`, () => this.#rename());
  }
  #rename() {
    const newName = prompt(`Choose a new directory name`, this.name)?.trim();
    if (newName) {
      if (newName.includes(`/`)) {
        return alert(`If you want to relocate a dir, just move it.`);
      }
      this.root.renameEntry(this, newName);
    }
  }
  /**
   * Remove this dir and everything in it
   */
  addDeleteButton() {
    const btn = create(`button`);
    btn.title = `Delete directory`;
    btn.textContent = `\u{1F5D1}\uFE0F`;
    this.appendChild(btn);
    btn.addEventListener(`click`, () => this.#deleteDir());
  }
  #deleteDir() {
    const msg = `Are you *sure* you want to delete this directory and everything in it?`;
    if (confirm(msg)) {
      this.root.removeEntry(this);
    }
  }
  /**
   * New file in this directory
   */
  createFileButton() {
    const btn = create(`button`);
    btn.title = `Add new file`;
    btn.textContent = `\u{1F4C4}`;
    btn.addEventListener(`click`, () => this.#createFile());
    this.appendChild(btn);
  }
  #createFile() {
    let fileName = prompt("Please specify a filename.")?.trim();
    if (fileName) {
      if (fileName.includes(`/`)) {
        return alert(
          `Just add new files directly to the directory where they should live.`
        );
      }
      if (this.path !== `.`) {
        fileName = this.path + fileName;
      }
      this.root.createEntry(fileName);
    }
  }
  /**
   * New directory in this directory
   */
  createDirButton() {
    const btn = create(`button`);
    btn.title = `Add new directory`;
    btn.textContent = `\u{1F4C1}`;
    btn.addEventListener(`click`, () => this.#createDir());
    this.appendChild(btn);
  }
  #createDir() {
    let dirName = prompt("Please specify a directory name.")?.trim();
    if (dirName) {
      if (dirName.includes(`/`)) {
        return alert(
          `You'll have to create nested directories one at a time..`
        );
      }
      let path = (this.path !== `.` ? this.path : ``) + dirName + `/`;
      this.root.createEntry(path);
    }
  }
  /**
   * Upload files or an entire directory from your device
   */
  addUploadButton() {
    const btn = create(`button`);
    btn.title = `Upload files from your device`;
    btn.textContent = `\u{1F4BB}`;
    btn.addEventListener(`click`, () => uploadFilesFromDevice(this));
    this.appendChild(btn);
  }
  /**
   * Because the file-tree has a master list of directories, we should
   * never need to do any recursion: if there's an addEntry, that entry
   * goes here.
   */
  addEntry(entry) {
    this.appendChild(entry);
    this.sort();
  }
  // File tree sorting, with dirs at the top
  sort(recursive = true, separateDirs = true) {
    const children = [...this.children];
    children.sort((a, b) => {
      if (a.tagName === `ENTRY-HEADING`) return -1;
      if (b.tagName === `ENTRY-HEADING`) return 1;
      if (a.tagName === `BUTTON` && b.tagName === `BUTTON`) return 0;
      else if (a.tagName === `BUTTON`) return -1;
      else if (b.tagName === `BUTTON`) return 1;
      if (separateDirs) {
        if (a.tagName === `DIR-ENTRY` && b.tagName === `DIR-ENTRY`) {
          a = a.path;
          b = b.path;
          return a < b ? -1 : 1;
        } else if (a.tagName === `DIR-ENTRY`) {
          return -1;
        } else if (b.tagName === `DIR-ENTRY`) {
          return 1;
        }
      }
      a = a.path;
      b = b.path;
      return a < b ? -1 : 1;
    });
    children.forEach((c) => this.appendChild(c));
    if (recursive) {
      this.findAll(`& > dir-entry`).forEach((d) => d.sort(recursive));
    }
  }
  select() {
    this.classList.toggle(`closed`);
  }
  toJSON() {
    return JSON.stringify(this.toValue());
  }
  toString() {
    return this.toJSON();
  }
  toValue() {
    return this.root.toValue().filter((v) => v.startsWith(this.path));
  }
};
registry.define(`dir-entry`, DirEntry);

// src/file-entry.js
var FileEntry = class extends FileTreeElement {
  isFile = true;
  constructor(fileName, fullPath) {
    super(fileName, fullPath);
    const rename = create(`button`);
    rename.title = `rename file`;
    rename.textContent = `\u270F\uFE0F`;
    this.appendChild(rename);
    rename.addEventListener(`click`, (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      const newFileName = prompt(
        `New file name?`,
        this.heading.textContent
      )?.trim();
      if (newFileName) {
        if (newFileName.includes(`/`)) {
          return alert(`If you want to relocate a file, just move it.`);
        }
        this.root.renameEntry(this, newFileName);
      }
    });
    const remove = create(`button`);
    remove.title = `delete file`;
    remove.textContent = `\u{1F5D1}\uFE0F`;
    this.appendChild(remove);
    remove.addEventListener(`click`, (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      if (confirm(`are you sure you want to delete this file?`)) {
        this.root.removeEntry(this);
      }
    });
    this.addEventListener(`click`, (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      this.root.selectEntry(this);
    });
    this.draggable = true;
    this.addEventListener(`dragstart`, (evt) => {
      evt.stopPropagation();
      this.classList.add(`dragging`);
      this.dataset.id = `${Date.now()}-${Math.random()}`;
      evt.dataTransfer.setData("id", this.dataset.id);
    });
  }
  select() {
    this.root.find(`.selected`)?.classList.remove(`selected`);
    this.classList.add(`selected`);
  }
  toJSON() {
    return JSON.stringify(this.toValue());
  }
  toString() {
    return this.path;
  }
  toValue() {
    return [this.toString()];
  }
};
registry.define(`file-entry`, FileEntry);

// src/file-tree.js
var FileTree = class extends FileTreeElement {
  isTree = true;
  entries = {};
  constructor() {
    super();
  }
  get root() {
    return this;
  }
  get parentDir() {
    return this.rootDir;
  }
  clear() {
    if (this.rootDir) this.removeChild(this.rootDir);
    const rootDir = this.rootDir = new DirEntry(`.`);
    this.appendChild(rootDir);
  }
  connectedCallback() {
    this.addExternalListener(
      document,
      `dragend`,
      () => this.findAll(`.dragging`).forEach((e) => e.classList.remove(`dragging`))
    );
  }
  /**
   * Setting files is a destructive operation, clearing whatever is already
   * in this tree in favour of new tree content.
   */
  setFiles(files = []) {
    this.clear();
    files.forEach(
      (path) => this.#addPath(path, void 0, `tree:setfiles`, true)
    );
  }
  // create or upload
  createEntry(path, content = void 0) {
    let eventType = (isFile(path) ? `file` : `dir`) + `:create`;
    this.#addPath(path, content, eventType);
  }
  // private function for initiating <file-entry> or <dir-entry> creation
  #addPath(path, content = void 0, eventType, immediate = false) {
    const { entries } = this;
    if (entries[path]) {
      throw new Error(`${path} already exists.`);
    }
    const grant = () => {
      const EntryType = isFile(path) ? FileEntry : DirEntry;
      const entry = new EntryType(path);
      entries[path] = entry;
      this.#mkdir(entry).addEntry(entry);
    };
    if (immediate) return grant();
    this.emit(eventType, { path, content }, grant);
  }
  // Ensure that a dir exists (recursively).
  #mkdir({ dirPath }) {
    const { entries } = this;
    if (!dirPath) return this.rootDir;
    let dir = this.find(`[path="${dirPath}"`);
    if (dir) return dir;
    dir = this.rootDir;
    dirPath.split(`/`).forEach((fragment) => {
      if (!fragment) return;
      const subDirPath = (dir.path === `.` ? `` : dir.path) + fragment + `/`;
      let subDir = this.find(`[path="${subDirPath}"`);
      if (!subDir) {
        subDir = new DirEntry(subDirPath);
        dir.addEntry(subDir);
        entries[subDirPath] = subDir;
      }
      dir = subDir;
    });
    return dir;
  }
  // A rename is a relocation where only the last part of the path changed.
  renameEntry(entry, newName) {
    const oldPath = entry.path;
    const pos = oldPath.lastIndexOf(entry.name);
    let newPath = oldPath.substring(0, pos) + newName;
    if (entry.isDir) newPath += `/`;
    const eventType = (entry.isFile ? `file` : `dir`) + `:rename`;
    this.#relocateEntry(entry, oldPath, newPath, eventType);
  }
  // A move is a relocation where everything *but* the last part of the path may have changed.
  moveEntry(entry, oldPath, newPath) {
    const eventType = (entry.isFile ? `file` : `dir`) + `:move`;
    this.#relocateEntry(entry, oldPath, newPath, eventType);
  }
  // private function for initiating <file-entry> or <dir-entry> path changes
  #relocateEntry(entry, oldPath, newPath, eventType) {
    const { entries } = this;
    if (entries[newPath]) throw new Error(`${newPath} already exists.`);
    this.emit(eventType, { oldPath, newPath }, () => {
      Object.keys(entries).forEach((key) => {
        if (key.startsWith(oldPath)) {
          const entry2 = entries[key];
          entry2.updatePath(oldPath, newPath);
          entries[entry2.path] = entry2;
          delete entries[key];
        }
      });
      const { dirPath } = entries[newPath] = entry;
      let dir = dirPath ? entries[dirPath] : this.rootDir;
      dir.addEntry(entry);
    });
  }
  // Deletes are a DOM removal of the entry itself, and a pruning
  // of the path -> entry map for any entry that started with the
  // same path, so we don't end up with any orphans.
  removeEntry(entry) {
    const { entries } = this;
    const { path } = entry;
    const eventType = (entry.isFile ? `file` : `dir`) + `:delete`;
    this.emit(eventType, { path }, () => {
      const { path: path2 } = entry;
      Object.entries(entries).forEach(([key, entry2]) => {
        if (key.startsWith(path2)) {
          entry2.remove();
          delete entries[key];
        }
      });
    });
  }
  // Select an entry by  its path
  select(path) {
    const entry = this.entries[path];
    if (!entry) throw new Error(`${path} does not exist.`);
    entry.click();
  }
  // Entry selection depends on the element, so we hand that
  // off to the entry itself once granted. (if granted)
  selectEntry(entry, detail = {}) {
    const eventType = (entry.isFile ? `file` : `dir`) + `:click`;
    detail.path = entry.path;
    this.emit(eventType, { detail }, () => entry.select());
  }
  sort() {
    this.rootDir.sort();
  }
  toJSON() {
    return JSON.stringify(Object.keys(this.entries).sort());
  }
  toString() {
    return this.toJSON();
  }
  toValue() {
    return this;
  }
};
registry.define(`file-tree`, FileTree);
