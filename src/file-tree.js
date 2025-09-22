import { FileTreeElement } from "./classes/file-tree-element.js";
import { WebSocketInterface } from "./classes/websocket-interface.js";
import { DirEntry } from "./classes/dir-entry.js";
import { FileEntry } from "./classes/file-entry.js";
import { registry } from "./utils/utils.js";
import { Strings } from "./utils/strings.js";

// For when folks need more:
export { WebSocketInterface };

/**
 * The file tree maintains the list of path -> entry mappings,
 * and is the only place where mutations happen. If a user
 * creates, renames, uploads, moves, or deletes a file or
 * directory, that operation gets turned into a path based
 * operation, which is then handled by the file tree.
 */
class FileTree extends FileTreeElement {
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
    const rootDir = (this.rootDir = new DirEntry(true));
    rootDir.path = `.`;
    this.appendChild(rootDir);
  }

  connectedCallback() {
    this.addExternalListener(document, `dragend`, () =>
      this.findAll(`.dragging`).forEach((e) => e.classList.remove(`dragging`))
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
  async connectViaWebSocket(
    url,
    basePath = `.`,
    keepAliveInterval = 60_000,
    ConnectorClass = WebSocketInterface
  ) {
    this.OT = new ConnectorClass(this, url, basePath, keepAliveInterval);
    return this.OT.socket;
  }

  /**
   * Setting files is a destructive operation, clearing whatever is already
   * in this tree in favour of new tree content.
   */
  setContent({ dirs, files }, bypassOT = false) {
    this.clear();
    dirs?.forEach((path) =>
      this.#addPath(
        `${path}/`,
        false, // isFile
        undefined, // content
        true, // bulk
        `tree:add:dir`,
        true, //immediately create the entry
        bypassOT
      )
    );

    files?.forEach((path) =>
      this.#addPath(
        path,
        true, // isFile
        undefined, // content
        true, // bulk
        `tree:add:file`,
        true, // immediately create the entry
        bypassOT
      )
    );
    this.ready = true;
    return this.emit(`tree:ready`);
  }

  // create or upload
  createEntry(path, isFile, content = undefined, bulk = false) {
    let eventType = (isFile ? `file` : `dir`) + `:create`;
    this.#addPath(path, isFile, content, bulk, eventType);
  }

  // get the file contents for an entry via a websocket connection
  async loadEntry(path) {
    return this.OT?.read(path);
  }

  // notify the server of a file content change
  async updateEntry(path, type, update) {
    return this.OT?.update(path, type, update);
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
    const { path, isFile, parentDir } = entry;
    const eventType = (isFile ? `file` : `dir`) + `:delete`;
    const detail = { path, emptyDir: this.removeEmptyDir };

    this.emit(eventType, detail, () => {
      // grant: delete
      const removed = this.__delete(path, isFile);
      this.OT?.delete(path);
      detail.removed = removed;
      // We need to run this "later" because it might
      // kick off another removeEntry call. And we want
      // a reasonable pause so we're "sure" the message
      // won't arrive at the same time.
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
  #addPath(
    path,
    isFile,
    content = undefined,
    bulk = false,
    eventType,
    immediate = false,
    bypassOT = false
  ) {
    const { entries } = this;

    if (entries[path]) {
      return this.emit(`${eventType}:error`, {
        error: Strings.PATH_EXISTS(path),
      });
    }

    // When granted, build the entry.
    const detail = { path, content, bulk };
    const grant = (processedContent = content) => {
      // grant: create
      const entry = this.__create(path, isFile);
      if (!bypassOT) this.OT?.create(path, isFile, processedContent);
      detail.entry = entry;
      return entry;
    };

    // We will not be asking for permission during setContent()
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
          error: Strings.PATH_INSIDE_ITSELF(oldPath),
        });
      }
    }
    if (entries[newPath]) {
      return this.emit(`${eventType}:error`, {
        oldPath,
        newPath,
        error: Strings.PATH_EXISTS(newPath),
      });
    }
    const detail = { oldPath, newPath };
    this.emit(eventType, detail, () => {
      // grant: move
      const entry = this.__move(isFile, oldPath, newPath);
      this.OT?.move(isFile, oldPath, newPath);
      detail.entry = entry;
      return entry;
    });
  }

  // ================================================================================================

  // create notification via websocket or immediate code path:
  __create(path, isFile) {
    const { entries } = this;

    const EntryType = isFile ? FileEntry : DirEntry;
    const entry = (entries[path] = new EntryType());
    entry.path = path;
    this.#mkdir(entry).addEntry(entry);

    return entry;
  }

  // move notification via websocket or immediate code path:
  __move(isFile, oldPath, newPath, when) {
    const { entries } = this;
    const entry = entries[oldPath];

    // Update all entries whose path starts with {oldPath},
    // which for files is just a single entry, but for dirs
    // can be any number of entries.
    Object.keys(entries).forEach((key) => {
      if (key.startsWith(oldPath)) {
        const entry = entries[key];
        const updated = entry.updatePath(isFile, oldPath, newPath);
        if (updated) {
          entries[entry.path] = entry;
          delete entries[key];
        }
      }
    });

    // Then make sure the relocated entry gets moved to
    // the correct parent, which we can do directly.
    const { dirPath } = (entries[newPath] = entry);
    let dir = dirPath ? entries[dirPath] : this.rootDir;
    dir.addEntry(entry);

    return entry;
  }

  // update notification via websocket or immediate code path:
  __update(path, type, update, ours) {
    this.entries[path]?.dispatchEvent(
      new CustomEvent(`content:update`, { detail: { type, update, ours } })
    );
  }

  // delete notification via websocket or immediate code path:
  __delete(path, isFile, when) {
    const { entries } = this;
    const entry = entries[path];
    const removed = [entry];

    // single instances are simple removals
    if (isFile) {
      entry.remove();
      delete entries[path];
    }

    // dirs need a mapping traversal to remove everything inside of it.
    else {
      Object.entries(entries).forEach(([key, entry]) => {
        if (key.startsWith(path)) {
          removed.push(entry);
          entry.remove();
          delete entries[key];
        }
      });
    }

    return removed;
  }

  // ================================================================================================

  // Select an entry by its path
  select(path) {
    const entry = this.entries[path];
    if (!entry) throw new Error(Strings.PATH_DOES_NOT_EXIST(path));
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
      // grant: select
      entry.select();
      detail.entry = entry;
      return entry;
    });
  }

  toggleDirectory(entry, detail = {}) {
    const eventType = `dir:toggle`;
    detail.path = entry.path;
    this.emit(eventType, detail, () => {
      // grant: toggle
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
}

registry.define(`file-tree`, FileTree);
