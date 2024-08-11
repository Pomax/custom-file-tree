// src/utils/utils.js
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

// src/classes/file-tree-element.js
var HTMLElement = globalThis.HTMLElement ?? class {
};
var FileTreeElement = class extends HTMLElement {
  state = {};
  eventControllers = [];
  constructor() {
    super();
    this.icon = this.find(`& > .icon`);
    if (!this.icon) {
      const icon = this.icon = create(`span`);
      icon.classList.add(`icon`);
      this.appendChild(icon);
    }
    this.heading = this.find(`& > entry-heading`);
    if (!this.heading) {
      const heading = this.heading = create(`entry-heading`);
      this.appendChild(heading);
    }
    this.buttons = this.find(`& > span.buttons`);
    if (!this.buttons) {
      const buttons = this.buttons = create(`span`);
      buttons.classList.add(`buttons`);
      this.appendChild(buttons);
    }
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
  get removeEmptyDir() {
    return this.root.getAttribute(`remove-empty-dir`);
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
  emit(eventType, detail = {}, grant = () => {
  }) {
    detail.grant = grant;
    this.root.dispatchEvent(new CustomEvent(eventType, { detail }));
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
  select() {
    this.root.unselect();
    this.classList.add(`selected`);
  }
  setState(stateUpdate) {
    Object.assign(this.state, stateUpdate);
  }
};
var EntryHeading = class extends HTMLElement {
};
registry.define(`entry-heading`, EntryHeading);

// src/utils/strings.js
var LOCALE_STRINGS = {
  "en-GB": {
    CREATE_FILE: `Create new file`,
    CREATE_FILE_PROMPT: `Please specify a filename.`,
    CREATE_FILE_NO_DIRS: `Just add new files directly to the directory where they should live.`,
    RENAME_FILE: `Rename file`,
    RENAME_FILE_PROMPT: `New file name?`,
    RENAME_FILE_MOVE_INSTEAD: `If you want to relocate a file, just move it.`,
    DELETE_FILE: `Delete file`,
    DELETE_FILE_PROMPT: (path) => `Are you sure you want to delete ${path}?`,
    CREATE_DIRECTORY: `Add new directory`,
    CREATE_DIRECTORY_PROMPT: `Please specify a directory name.`,
    CREATE_DIRECTORY_NO_NESTING: `You'll have to create nested directories one at a time.`,
    RENAME_DIRECTORY: `Rename directory`,
    RENAME_DIRECTORY_PROMPT: `Choose a new directory name`,
    RENAME_DIRECTORY_MOVE_INSTEAD: `If you want to relocate a directory, just move it.`,
    DELETE_DIRECTORY: `Delete directory`,
    DELETE_DIRECTORY_PROMPT: (path) => `Are you *sure* you want to delete ${path} and everything in it?`,
    UPLOAD_FILES: `Upload files from your device`,
    PATH_EXISTS: (path) => `${path} already exists.`,
    PATH_DOES_NOT_EXIST: (path) => `${path} does not exist.`,
    PATH_INSIDE_ITSELF: (path) => `Cannot nest ${path} inside its own subdirectory.`,
    INVALID_UPLOAD_TYPE: (type) => `Unfortunately, a ${type} is not a file or folder.`
  }
};
var defaultLocale = `en-GB`;
var userLocale = globalThis.navigator?.language;
var localeStrings = LOCALE_STRINGS[userLocale] || LOCALE_STRINGS[defaultLocale];

// src/utils/upload-file.js
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
    if (item instanceof File && !item.isDirectory) {
      const content = await getFileContent(item);
      const filePath = path + (item.webkitRelativePath || item.name);
      const entryPath = (dirPath === `.` ? `` : dirPath) + filePath;
      root.createEntry(entryPath, content);
    } else if (item.isFile) {
      item.file(async (file) => {
        const content = await getFileContent(file);
        const filePath = path + file.name;
        const entryPath = (dirPath === `.` ? `` : dirPath) + filePath;
        root.createEntry(entryPath, content);
      });
    } else if (item.isDirectory) {
      const updatedPath = path + item.name + "/";
      item.createReader().readEntries(async (entries) => {
        for (let entry of entries) await iterate(entry, updatedPath);
      });
    }
  }
  for (let item of items) {
    try {
      let entry;
      if (!entry && item instanceof File) {
        entry = item;
      }
      if (!entry && item.webkitGetAsEntry) {
        entry = item.webkitGetAsEntry() ?? entry;
      }
      if (!entry && item.getAsFile) {
        entry = item.getAsFile();
      }
      await iterate(entry);
    } catch (e) {
      return alert(localeStrings.INVALID_UPLOAD_TYPE(item.kind));
    }
  }
}

// src/utils/make-drop-zone.js
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

// src/classes/dir-entry.js
var DirEntry = class extends FileTreeElement {
  isDir = true;
  constructor(rootDir = false) {
    super();
    this.addButtons(rootDir);
  }
  get path() {
    return super.path;
  }
  set path(v) {
    super.path = v;
    if (v === `.`) {
      this.find(`& > .rename-dir`)?.remove();
      this.find(`& > .delete-dir`)?.remove();
    }
  }
  connectedCallback() {
    this.addListener(`click`, (evt) => this.selectListener(evt));
    this.addExternalListener(
      this.icon,
      `click`,
      (evt) => this.foldListener(evt)
    );
    const controller = makeDropZone(this);
    if (controller) this.addAbortController(controller);
  }
  selectListener(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    if (this.path === `.`) return;
    const tag = evt.target.tagName;
    if (tag !== `DIR-ENTRY` && tag !== `ENTRY-HEADING`) return;
    this.root.selectEntry(this);
    if (this.classList.contains(`closed`)) {
      this.foldListener(evt);
    }
  }
  foldListener(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    if (this.path === `.`) return;
    const closed = this.classList.contains(`closed`);
    this.root.toggleDirectory(this, {
      currentState: closed ? `closed` : `open`
    });
  }
  addButtons(rootDir) {
    this.createFileButton();
    this.createDirButton();
    this.addUploadButton();
    if (!rootDir) {
      this.addRenameButton();
      this.addDeleteButton();
    }
  }
  /**
   * rename this dir.
   */
  addRenameButton() {
    if (this.path === `.`) return;
    if (this.find(`& > .rename-dir`)) return;
    const btn = create(`button`);
    btn.classList.add(`rename-dir`);
    btn.title = localeStrings.RENAME_DIRECTORY;
    btn.textContent = `\u270F\uFE0F`;
    this.buttons.appendChild(btn);
    btn.addEventListener(`click`, () => this.#rename());
  }
  #rename() {
    const newName = prompt(localeStrings.RENAME_DIRECTORY_PROMPT, this.name)?.trim();
    if (newName) {
      if (newName.includes(`/`)) {
        return alert(localeStrings.RENAME_DIRECTORY_MOVE_INSTEAD);
      }
      this.root.renameEntry(this, newName);
    }
  }
  /**
   * Remove this dir and everything in it
   */
  addDeleteButton() {
    if (this.path === `.`) return;
    if (this.find(`& > .delete-dir`)) return;
    const btn = create(`button`);
    btn.classList.add(`delete-dir`);
    btn.title = localeStrings.DELETE_DIRECTORY;
    btn.textContent = `\u{1F5D1}\uFE0F`;
    this.buttons.appendChild(btn);
    btn.addEventListener(`click`, () => this.#deleteDir());
  }
  #deleteDir() {
    const msg = localeStrings.DELETE_DIRECTORY_PROMPT(this.path);
    if (confirm(msg)) {
      this.root.removeEntry(this);
    }
  }
  /**
   * New file in this directory
   */
  createFileButton() {
    if (this.find(`& > .create-file`)) return;
    const btn = create(`button`);
    btn.classList.add(`create-file`);
    btn.title = localeStrings.CREATE_FILE;
    btn.textContent = `\u{1F4C4}`;
    btn.addEventListener(`click`, () => this.#createFile());
    this.buttons.appendChild(btn);
  }
  #createFile() {
    let fileName = prompt(localeStrings.CREATE_FILE_PROMPT)?.trim();
    if (fileName) {
      if (fileName.includes(`/`)) {
        return alert(localeStrings.CREATE_FILE_NO_DIRS);
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
    if (this.find(`& > .create-dir`)) return;
    const btn = create(`button`);
    btn.classList.add(`create-dir`);
    btn.title = localeStrings.CREATE_DIRECTORY;
    btn.textContent = `\u{1F4C1}`;
    btn.addEventListener(`click`, () => this.#createDir());
    this.buttons.appendChild(btn);
  }
  #createDir() {
    let dirName = prompt(String.CREATE_DIRECTORY_PROMPT)?.trim();
    if (dirName) {
      if (dirName.includes(`/`)) {
        return alert(localeStrings.CREATE_DIRECTORY_NO_NESTING);
      }
      let path = (this.path !== `.` ? this.path : ``) + dirName + `/`;
      this.root.createEntry(path);
    }
  }
  /**
   * Upload files or an entire directory from your device
   */
  addUploadButton() {
    if (this.find(`& > .upload`)) return;
    const btn = create(`button`);
    btn.classList.add(`upload`);
    btn.title = localeStrings.UPLOAD_FILES;
    btn.textContent = `\u{1F4BB}`;
    btn.addEventListener(`click`, () => uploadFilesFromDevice(this));
    this.buttons.appendChild(btn);
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
  /**
   * If the file tree has the `remove-empty` attribute, deleting the
   * last bit of content from a dir should trigger its own deletion.
   * @returns
   */
  checkEmpty() {
    if (!this.removeEmptyDir) return;
    if (this.find(`dir-entry, file-entry`)) return;
    const deleteBecauseWeAreEmpty = true;
    this.root.removeEntry(this, deleteBecauseWeAreEmpty);
  }
  // File tree sorting, with dirs at the top
  sort(recursive = true, separateDirs = true) {
    const children = [...this.children];
    children.sort((a, b) => {
      if (a.tagName === `SPAN` && a.classList.contains(`icon`)) return -1;
      if (b.tagName === `SPAN` && b.classList.contains(`icon`)) return 1;
      if (a.tagName === `ENTRY-HEADING`) return -1;
      if (b.tagName === `ENTRY-HEADING`) return 1;
      if (a.tagName === `SPAN` && b.tagName === `SPAN`) return 0;
      else if (a.tagName === `SPAN`) return -1;
      else if (b.tagName === `SPAN`) return 1;
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
  toggle() {
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

// src/classes/file-entry.js
var FileEntry = class extends FileTreeElement {
  isFile = true;
  constructor(fileName, fullPath) {
    super(fileName, fullPath);
    this.addRenameButton();
    this.addDeleteButton();
    this.addEventHandling();
  }
  addRenameButton() {
    if (this.find(`& > .rename-file`)) return;
    const btn = create(`button`);
    btn.classList.add(`rename-file`);
    btn.title = localeStrings.RENAME_FILE;
    btn.textContent = `\u270F\uFE0F`;
    this.buttons.appendChild(btn);
    btn.addEventListener(`click`, (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      const newFileName = prompt(
        localeStrings.RENAME_FILE_PROMPT,
        this.heading.textContent
      )?.trim();
      if (newFileName) {
        if (newFileName.includes(`/`)) {
          return alert(localeStrings.RENAME_FILE_MOVE_INSTEAD);
        }
        this.root.renameEntry(this, newFileName);
      }
    });
  }
  addDeleteButton() {
    if (this.find(`& > .delete-file`)) return;
    const btn = create(`button`);
    btn.classList.add(`delete-file`);
    btn.title = localeStrings.DELETE_FILE;
    btn.textContent = `\u{1F5D1}\uFE0F`;
    this.buttons.appendChild(btn);
    btn.addEventListener(`click`, (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      if (confirm(localeStrings.DELETE_FILE_PROMPT(this.path))) {
        this.root.removeEntry(this);
      }
    });
  }
  addEventHandling() {
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
  static observedAttributes = ["src"];
  ready = false;
  isTree = true;
  entries = {};
  constructor() {
    super();
    this.heading.textContent = `File tree`;
  }
  get root() {
    return this;
  }
  get parentDir() {
    return this.rootDir;
  }
  clear() {
    this.ready = false;
    this.emit(`tree:clear`);
    Object.keys(this.entries).forEach((key) => delete this.entries[key]);
    if (this.rootDir) this.removeChild(this.rootDir);
    const rootDir = this.rootDir = new DirEntry(true);
    rootDir.path = `.`;
    this.appendChild(rootDir);
  }
  connectedCallback() {
    this.addExternalListener(
      document,
      `dragend`,
      () => this.findAll(`.dragging`).forEach((e) => e.classList.remove(`dragging`))
    );
  }
  attributeChangedCallback(name, _, value) {
    if (name === `src` && value) {
      this.#loadSource(value);
    }
  }
  async #loadSource(url) {
    const response = await fetch(url);
    const data = await response.json();
    if (data) this.setContent(data);
  }
  /**
   * Setting files is a destructive operation, clearing whatever is already
   * in this tree in favour of new tree content.
   */
  setContent(paths = []) {
    this.clear();
    paths.forEach((path) => {
      const type = isFile(path) ? `file` : `dir`;
      this.#addPath(path, void 0, `tree:add:${type}`, true);
    });
    this.ready = true;
    return this.emit(`tree:ready`);
  }
  // create or upload
  createEntry(path, content = void 0) {
    let eventType = (isFile(path) ? `file` : `dir`) + `:create`;
    this.#addPath(path, content, eventType);
  }
  // private function for initiating <file-entry> or <dir-entry> creation
  #addPath(path, content = void 0, eventType, immediate = false) {
    const { entries } = this;
    if (!isFile(path) && !path.endsWith(`/`)) path += `/`;
    if (entries[path]) {
      return this.emit(`${eventType}:error`, {
        error: localeStrings.PATH_EXISTS(path)
      });
    }
    const grant = () => {
      const EntryType = isFile(path) ? FileEntry : DirEntry;
      const entry = new EntryType();
      entry.path = path;
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
        subDir = new DirEntry();
        subDir.path = subDirPath;
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
    if (oldPath === newPath) return;
    if (newPath.startsWith(oldPath)) {
      return this.emit(`${eventType}:error`, {
        oldPath,
        newPath,
        error: localeStrings.PATH_INSIDE_ITSELF(oldPath)
      });
    }
    if (entries[newPath]) {
      return this.emit(`${eventType}:error`, {
        oldPath,
        newPath,
        error: localeStrings.PATH_EXISTS(newPath)
      });
    }
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
  removeEntry(entry, emptyDir = false) {
    const { entries } = this;
    const { path, isFile: isFile2, parentDir } = entry;
    const eventType = (isFile2 ? `file` : `dir`) + `:delete`;
    const detail = { path };
    if (emptyDir) detail.emptyDir = true;
    this.emit(eventType, detail, () => {
      if (isFile2 || emptyDir) {
        entry.remove();
        delete entries[path];
      } else {
        Object.entries(entries).forEach(([key, entry2]) => {
          if (key.startsWith(path)) {
            entry2.remove();
            delete entries[key];
          }
        });
      }
      parentDir.checkEmpty();
    });
  }
  // Select an entry by its path
  select(path) {
    const entry = this.entries[path];
    if (!entry) throw new Error(localeStrings.PATH_DOES_NOT_EXIST(path));
    entry.select();
  }
  // Counterpart to select()
  unselect() {
    this.find(`.selected`)?.classList.remove(`selected`);
  }
  // Entry selection depends on the element, so we hand that
  // off to the entry itself once granted. (if granted)
  selectEntry(entry, detail = {}) {
    const eventType = (entry.isFile ? `file` : `dir`) + `:click`;
    detail.path = entry.path;
    this.emit(eventType, detail, () => entry.select());
  }
  toggleDirectory(entry, detail = {}) {
    const eventType = `dir:toggle`;
    detail.path = entry.path;
    this.emit(eventType, detail, () => entry.toggle());
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
