// src/utils/utils.js
var create = (tag) => document.createElement(tag);
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
    return this.root.removeEmptyDir;
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
  set path(path2) {
    if (!path2) return;
    const pos = path2.endsWith(`/`) ? -2 : -1;
    this.name = path2.split(`/`).at(pos).replace(/#.*/, ``);
    if (!this.name && path2) {
      throw Error(`why? path is ${path2}`);
    }
    const heading = this.find(`& > entry-heading`);
    heading.textContent = this.name;
    this.setAttribute(`path`, path2);
  }
  updatePath(isFile, oldPath, newPath) {
    if (this.path === oldPath) {
      this.path = newPath;
      return true;
    }
    if (isFile) return false;
    const regex = new RegExp(`^${oldPath}`);
    this.path = this.path.replace(regex, newPath);
    return true;
  }
  get dirPath() {
    let { path: path2, name } = this;
    if (this.isFile) return path2.replace(name, ``);
    if (this.isDir) return path2.substring(0, path2.lastIndexOf(name));
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
  hasButton(className) {
    return this.find(`& > .buttons .${className}`);
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

// src/classes/websocket-interface.js
var WebSocketInterface = class {
  // A list used to await content responses
  // from the server, so that users can just
  // "await" entry.load() calls.
  waitList = {};
  // An "optimistically applied" list of
  // pending actions that have been sent
  // off to the server, and have hopefully
  // been accepted, but may need undoing.
  pending = [];
  /**
   * Set up a websocket connection to a secure
   * endpoint for a given file tree element.
   */
  constructor(fileTree, url, basePath = `.`, keepAliveInterval = 6e4) {
    Object.assign(this, { fileTree, url, basePath, keepAliveInterval });
    this.connect();
  }
  /**
   * Connect to a websocket server and let it know which
   * base path this file tree wants to be linked to, so
   * that it can be joined up with every other file tree
   * that's looking at/working with the same base path.
   *
   * @param {*} url
   * @param {*} basePath
   */
  async connect(url = this.url, basePath = this.basePath) {
    url = url.replace(`https://`, `wss://`);
    if (!url.startsWith(`wss://`)) {
      throw new Error(`Only secure URLs are supported.`);
    }
    const socket = this.socket = new WebSocket(url);
    socket.addEventListener(`message`, ({ data }) => {
      data = JSON.parse(data);
      let { type, detail } = data;
      if (!type.startsWith(`file-tree:`)) return;
      type = type.replace(`file-tree:`, ``);
      const handlerName = `on${type}`;
      const handler = this[handlerName].bind(this);
      if (!handler) {
        throw new Error(`Missing implementation for ${handlerName}.`);
      }
      if (this.checkSync(type, detail.seqnum)) handler(detail);
    });
    let keepAliveTimer;
    const keepAlive = () => {
      this.send(`file-tree:keepalive`, { basePath });
      keepAliveTimer = setTimeout(keepAlive, this.keepAliveInterval);
    };
    socket.addEventListener(`close`, () => {
      clearTimeout(keepAliveTimer);
    });
    if (await waitForOpenWebSocket(socket)) {
      this.send(`file-tree:load`, { basePath });
      keepAlive();
    } else {
      throw new Error(`Could not establish websocket connection.`);
    }
  }
  /**
   * Mark a specific path as awaiting a "read" result.
   */
  async markWaiting(path2, resolve) {
    this.waitList[path2] = resolve;
  }
  /**
   * Send a message to the server
   */
  async send(type, detail = {}) {
    const action = { type, detail };
    this.pending.push(action);
    this.socket.send(JSON.stringify(action));
  }
  /**
   * Verify that we're (a) in sync with respect to the
   * sequence numbering for this folder, and (b) in sync
   * with respect to which operation we thought we were
   * going to see (if we're expecting our own operation(s)
   * as next one(s) in the sequence).
   * @param {*} type
   * @param {*} seqnum
   * @returns
   */
  checkSync(type, seqnum) {
    if (type === `load`) return true;
    if (type === `read`) return true;
    if (seqnum === this.seqnum + 1) {
      const { pending } = this;
      if (pending.length) {
        if (pending[0].type === type) {
          pending.shift();
        } else {
          this.rollback(pending.reverse());
        }
      }
      return this.seqnum = seqnum;
    }
    this.send(`file-tree:sync`, { seqnum: this.seqnum });
  }
  /**
   * Do we need to roll back any optimistic changes?
   */
  rollback(latestToOldest) {
    this.pending = [];
    for (const { type, detail } of latestToOldest) {
      if (type === `create`) {
        this.fileTree.__delete(detail.path);
      }
      if (type === `delete`) {
        this.fileTree.__create(detail.path, detail.isFile);
        this.read(path);
      }
      if (type === `move`) {
        this.fileTree.__move(detail.isFile, detail.newPath, detail.oldPath);
      }
      if (type === `update`) {
        this.read(path);
      }
    }
  }
  // ==========================================================================
  /**
   * OT operation from file tree: inform the server of a file or dir creation.
   */
  async create(path2, isFile, content) {
    this.send(`file-tree:create`, { path: path2, isFile, content });
  }
  /**
   * OT operation from file tree: inform the server of a deletion.
   */
  async delete(path2) {
    this.send(`file-tree:delete`, { path: path2 });
  }
  /**
   * OT operation from file tree: inform the server of a path change.
   */
  async move(isFile, oldPath, newPath) {
    this.send(`file-tree:move`, { isFile, oldPath, newPath });
  }
  /**
   * This is a special one time (well, ideally) operation for
   * getting file content via websockets rather than via a
   * REST API.
   *
   * The response will either be a string for textual data,
   * or an array of ints for binary data, where each array
   * element represents a byte value.
   */
  async read(path2) {
    return new Promise((resolve) => {
      this.markWaiting(path2, resolve);
      this.send(`file-tree:read`, { path: path2 });
    });
  }
  /**
   * OT operation from file tree: inform the server of a content update.
   */
  async update(path2, type, update) {
    this.send(`file-tree:update`, { path: path2, type, update });
  }
  // ==========================================================================
  /**
   * Build a tree off of a set of paths. This happens in
   * response to a message of the form:
   *
   * {
   *    "type": "file-tree:load",
   *    "detail": {
   *       "paths": []
   *    }
   * }
   *
   * where the `paths` payload is an array of strings.
   */
  async onload({ id, dirs, files, seqnum }) {
    this.id = id;
    this.seqnum = seqnum;
    this.fileTree.setContent({ dirs, files }, true);
  }
  /**
   * Something has gone horribly wrong, and we need to
   * terminate this connection. If `reconnect` is true
   * we are allowed to reconnect so that we're back
   * in a good state.
   */
  async onterminate({ id, reconnect }) {
    if (this.id !== id) return;
    this.socket.close();
    if (reconnect) this.connect();
  }
  /**
   * Handle a create notification, which will tell us which
   * path got created, and when that creation happened.
   *
   * This happens in response to a message of the form:
   *
   * {
   *    "type": "file-tree:create",
   *    "detail": {
   *       "path": a path string
   *       "isFile": a bool
   *       "when": a server-side datetime int
   *       "by": a uuid string
   *    }
   * }
   */
  async oncreate({ path: path2, isFile, from }) {
    const { id, fileTree } = this;
    if (from === id) return;
    const entry = fileTree.__create(path2, isFile);
    fileTree.dispatchEvent(
      new CustomEvent(`ot:created`, { detail: { entry, path: path2, isFile } })
    );
  }
  /**
   * Handle a delete notification, which will tell us
   * which path got deleted, and when that delete happened.
   *
   * This happens in response to a message of the form:
   *
   * {
   *    "type": "file-tree:delete",
   *    "detail": {
   *       "path": a path string
   *       "isFile": a bool
   *       "when": a server-side datetime int
   *       "by": a uuid string
   *    }
   * }
   */
  async ondelete({ path: path2, from }) {
    const { id, fileTree } = this;
    if (from === id) return;
    const entries = fileTree.__delete(path2);
    fileTree.dispatchEvent(
      new CustomEvent(`ot:deleted`, { detail: { entries, path: path2 } })
    );
  }
  /**
   * Handle a move notification, which will tell us
   * which path to rename, and when that rename happened.
   *
   * This happens in response to a message of the form:
   *
   * {
   *    "type": "file-tree:move",
   *    "detail": {
   *       "oldPath": a path string
   *       "newPath": a path string
   *       "when": a server-side datetime int
   *       "by": a uuid string
   *    }
   * }
   */
  async onmove({ isFile, oldPath, newPath, from }) {
    const { id, fileTree } = this;
    if (from === id) return;
    const entry = fileTree.__move(isFile, oldPath, newPath);
    fileTree.dispatchEvent(
      new CustomEvent(`ot:moved`, {
        detail: { entry, isFile, oldPath, newPath }
      })
    );
  }
  /**
   * This is a special file content handler that
   * lets the `read` function resolve with the
   * content of the requested file.
   */
  async onread({ path: path2, data }) {
    const { waitList } = this;
    waitList[path2]?.({ data });
    delete waitList[path2];
  }
  /**
   * Handle a content update notification, which will tell
   * us which file to update, and when that update happened.
   *
   * This happens in response to a message of the form:
   *
   * {
   *    "type": "file-tree:update",
   *    "detail": {
   *       "path": a path string
   *       "update": an update payload
   *       "when": a server-side datetime int
   *       "by": a uuid string
   *    }
   * }
   */
  async onupdate({ path: path2, type, update, from }) {
    const { id, fileTree } = this;
    fileTree.__update(path2, type, update, from === id);
  }
};
async function waitForOpenWebSocket(socket, retries = 0, interval = 100) {
  if (retries === 10) return false;
  if (socket.readyState === WebSocket.OPEN) return true;
  const retry = () => waitForOpenWebSocket(socket, retries + 1, interval + 100);
  return new Promise((resolve) => setTimeout(() => resolve(retry), interval));
}

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
    DELETE_FILE_PROMPT: (path2) => `Are you sure you want to delete ${path2}?`,
    CREATE_DIRECTORY: `Add new directory`,
    CREATE_DIRECTORY_PROMPT: `Please specify a directory name.`,
    CREATE_DIRECTORY_NO_NESTING: `You'll have to create nested directories one at a time.`,
    RENAME_DIRECTORY: `Rename directory`,
    RENAME_DIRECTORY_PROMPT: `Choose a new directory name`,
    RENAME_DIRECTORY_MOVE_INSTEAD: `If you want to relocate a directory, just move it.`,
    DELETE_DIRECTORY: `Delete directory`,
    DELETE_DIRECTORY_PROMPT: (path2) => `Are you *sure* you want to delete ${path2} and everything in it?`,
    UPLOAD_FILES: `Upload files from your device`,
    PATH_EXISTS: (path2) => `${path2} already exists.`,
    PATH_DOES_NOT_EXIST: (path2) => `${path2} does not exist.`,
    PATH_INSIDE_ITSELF: (path2) => `Cannot nest ${path2} inside its own subdirectory.`,
    INVALID_UPLOAD_TYPE: (type) => `Unfortunately, a ${type} is not a file or folder.`
  }
};
var defaultLocale = `en-GB`;
var userLocale = globalThis.navigator?.language;
var localeStrings = LOCALE_STRINGS[userLocale] || LOCALE_STRINGS[defaultLocale];

// src/utils/upload-file.js
function uploadFilesFromDevice({ root, path: path2 }) {
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
    processUpload(root, files, path2);
  });
  upload.click();
}
async function processUpload(root, items, dirPath = ``) {
  let bulkUpload = items.length > 1;
  async function iterate(item, path2 = ``) {
    if (item instanceof File && !item.isDirectory) {
      const content = await getFileContent(item);
      const filePath = path2 + (item.webkitRelativePath || item.name);
      const entryPath = (dirPath === `.` ? `` : dirPath) + filePath;
      root.createEntry(entryPath, true, content, bulkUpload);
    } else if (item.isFile) {
      item.file(async (file) => {
        const content = await getFileContent(file);
        const filePath = path2 + file.name;
        const entryPath = (dirPath === `.` ? `` : dirPath) + filePath;
        root.createEntry(entryPath, true, content, bulkUpload);
      });
    } else if (item.isDirectory) {
      bulkUpload = true;
      const updatedPath = path2 + item.name + "/";
      root.createEntry(updatedPath, false, false, bulkUpload);
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
   * New file in this directory
   */
  createFileButton() {
    if (this.hasButton(`create-file`)) return;
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
      this.root.createEntry(fileName, true);
    }
  }
  /**
   * New directory in this directory
   */
  createDirButton() {
    if (this.hasButton(`create-dir`)) return;
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
      let path2 = (this.path !== `.` ? this.path : ``) + dirName + `/`;
      this.root.createEntry(path2, false);
    }
  }
  /**
   * Upload files or an entire directory from your device
   */
  addUploadButton() {
    if (this.hasButton(`upload`)) return;
    const btn = create(`button`);
    btn.classList.add(`upload`);
    btn.title = localeStrings.UPLOAD_FILES;
    btn.textContent = `\u{1F4BB}`;
    btn.addEventListener(`click`, () => uploadFilesFromDevice(this));
    this.buttons.appendChild(btn);
  }
  /**
   * rename this dir.
   */
  addRenameButton() {
    if (this.path === `.`) return;
    if (this.hasButton(`rename-dir`)) return;
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
    if (this.hasButton(`delete-dir`)) return;
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
    this.root.removeEntry(this);
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
  toggle(state) {
    this.classList.toggle(`closed`, state);
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
    if (this.hasButton(`rename-file`)) return;
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
    if (this.hasButton(`delete-file`)) return;
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
  // This function only works when connected through
  // a websocket. Note that we do NOT store the data
  // here, that's up to whoever is using this file-tree.
  //
  // The return type is { data: string|int[], when:datetime }
  async load() {
    return this.root.loadEntry(this.path);
  }
  // This function only works when connected through
  // a websocket. Note that we do NOT store the data
  // here, that's up to whoever is using this file-tree.
  async updateContent(type, update) {
    this.root.updateEntry(this.path, type, update);
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
  get removeEmptyDir() {
    return !!this.getAttribute(`remove-empty-dir`);
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
  /**
   * Connect to a websocket server. You can provide
   * a custom websocket interface class, but then
   * you better know what you're doing =)
   *
   * @param {*} url
   * @param {*} basePath
   * @param {*} ConnectorClass
   */
  async connectViaWebSocket(url, basePath = `.`, keepAliveInterval = 6e4, ConnectorClass = WebSocketInterface) {
    this.OT = new ConnectorClass(this, url, basePath, keepAliveInterval);
  }
  /**
   * Setting files is a destructive operation, clearing whatever is already
   * in this tree in favour of new tree content.
   */
  setContent({ dirs, files }, bypassOT = false) {
    this.clear();
    dirs?.forEach(
      (path2) => this.#addPath(
        `${path2}/`,
        false,
        // isFile
        void 0,
        // content
        true,
        // bulk
        `tree:add:dir`,
        true,
        //immediately create the entry
        bypassOT
      )
    );
    files?.forEach(
      (path2) => this.#addPath(
        path2,
        true,
        // isFile
        void 0,
        // content
        true,
        // bulk
        `tree:add:file`,
        true,
        // immediately create the entry
        bypassOT
      )
    );
    this.ready = true;
    return this.emit(`tree:ready`);
  }
  // create or upload
  createEntry(path2, isFile, content = void 0, bulk = false) {
    let eventType = (isFile ? `file` : `dir`) + `:create`;
    this.#addPath(path2, isFile, content, bulk, eventType);
  }
  // get the file contents for an entry via a websocket connection
  async loadEntry(path2) {
    return this.OT?.read(path2);
  }
  // notify the server of a file content change
  async updateEntry(path2, type, update) {
    return this.OT?.update(path2, type, update);
  }
  // A rename is a relocation where only the last part of the path changed.
  renameEntry(entry, newName) {
    const isFile = !!entry.isFile;
    const oldPath = entry.path;
    const pos = oldPath.lastIndexOf(entry.name);
    let newPath = oldPath.substring(0, pos) + newName;
    if (entry.isDir) newPath += `/`;
    const eventType = (entry.isFile ? `file` : `dir`) + `:rename`;
    this.#relocateEntry(isFile, oldPath, newPath, eventType);
  }
  // A move is a relocation where everything *but* the last part of the path may have changed.
  moveEntry(entry, oldPath, newPath) {
    const isFile = !!entry.isFile;
    const eventType = (entry.isFile ? `file` : `dir`) + `:move`;
    this.#relocateEntry(isFile, oldPath, newPath, eventType);
  }
  // Deletes are a DOM removal of the entry itself, and a pruning
  // of the path -> entry map for any entry that started with the
  // same path, so we don't end up with any orphans.
  removeEntry(entry) {
    const { path: path2, isFile, parentDir } = entry;
    const eventType = (isFile ? `file` : `dir`) + `:delete`;
    const detail = { path: path2, emptyDir: this.removeEmptyDir };
    this.emit(eventType, detail, () => {
      const removed = this.__delete(path2, isFile);
      this.OT?.delete(path2);
      detail.removed = removed;
      setTimeout(() => parentDir.checkEmpty(), 10);
      return removed;
    });
  }
  // ================================================================================================
  async #loadSource(url) {
    const response = await fetch(url);
    const data = await response.json();
    if (data) {
      const { dirs, files } = data;
      this.setContent({ dirs, files });
    }
  }
  // private function for initiating <file-entry> or <dir-entry> creation
  #addPath(path2, isFile, content = void 0, bulk = false, eventType, immediate = false, bypassOT = false) {
    const { entries } = this;
    if (entries[path2]) {
      return this.emit(`${eventType}:error`, {
        error: localeStrings.PATH_EXISTS(path2)
      });
    }
    const detail = { path: path2, content, bulk };
    const grant = (processedContent = content) => {
      const entry = this.__create(path2, isFile);
      if (!bypassOT) this.OT?.create(path2, isFile, processedContent);
      detail.entry = entry;
      return entry;
    };
    if (immediate) return grant();
    this.emit(eventType, detail, grant);
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
  // private function for initiating <file-entry> or <dir-entry> path changes
  #relocateEntry(isFile, oldPath, newPath, eventType) {
    const { entries } = this;
    if (oldPath === newPath) return;
    if (newPath.startsWith(oldPath)) {
      const reduced = newPath.replace(oldPath, ``);
      if (reduced.includes(`/`)) {
        return this.emit(`${eventType}:error`, {
          oldPath,
          newPath,
          error: localeStrings.PATH_INSIDE_ITSELF(oldPath)
        });
      }
    }
    if (entries[newPath]) {
      return this.emit(`${eventType}:error`, {
        oldPath,
        newPath,
        error: localeStrings.PATH_EXISTS(newPath)
      });
    }
    const detail = { oldPath, newPath };
    this.emit(eventType, detail, () => {
      const entry = this.__move(isFile, oldPath, newPath);
      this.OT?.move(isFile, oldPath, newPath);
      detail.entry = entry;
      return entry;
    });
  }
  // ================================================================================================
  // create notification via websocket or immediate code path:
  __create(path2, isFile) {
    const { entries } = this;
    const EntryType = isFile ? FileEntry : DirEntry;
    const entry = entries[path2] = new EntryType();
    entry.path = path2;
    this.#mkdir(entry).addEntry(entry);
    return entry;
  }
  // move notification via websocket or immediate code path:
  __move(isFile, oldPath, newPath, when) {
    const { entries } = this;
    const entry = entries[oldPath];
    Object.keys(entries).forEach((key) => {
      if (key.startsWith(oldPath)) {
        const entry2 = entries[key];
        const updated = entry2.updatePath(isFile, oldPath, newPath);
        if (updated) {
          entries[entry2.path] = entry2;
          delete entries[key];
        }
      }
    });
    const { dirPath } = entries[newPath] = entry;
    let dir = dirPath ? entries[dirPath] : this.rootDir;
    dir.addEntry(entry);
    return entry;
  }
  // update notification via websocket or immediate code path:
  __update(path2, type, update, ours) {
    this.entries[path2]?.dispatchEvent(
      new CustomEvent(`content:update`, { detail: { type, update, ours } })
    );
  }
  // delete notification via websocket or immediate code path:
  __delete(path2, isFile, when) {
    const { entries } = this;
    const entry = entries[path2];
    const removed = [entry];
    if (isFile) {
      entry.remove();
      delete entries[path2];
    } else {
      Object.entries(entries).forEach(([key, entry2]) => {
        if (key.startsWith(path2)) {
          removed.push(entry2);
          entry2.remove();
          delete entries[key];
        }
      });
    }
    return removed;
  }
  // ================================================================================================
  // Select an entry by its path
  select(path2) {
    const entry = this.entries[path2];
    if (!entry) throw new Error(localeStrings.PATH_DOES_NOT_EXIST(path2));
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
    this.emit(eventType, detail, () => {
      entry.select();
      detail.entry = entry;
      return entry;
    });
  }
  toggleDirectory(entry, detail = {}) {
    const eventType = `dir:toggle`;
    detail.path = entry.path;
    this.emit(eventType, detail, () => {
      detail.entry = entry;
      entry.toggle();
    });
  }
  sort() {
    this.rootDir.sort();
  }
  // ================================================================================================
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
