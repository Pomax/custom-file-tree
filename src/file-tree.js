import { FileTreeElement } from "./classes/file-tree-element.js";
import { SocketInterface } from "./classes/socket-interface.js";
import { DirEntry } from "./classes/dir-entry.js";
import { FileEntry } from "./classes/file-entry.js";
import { registry, isFile } from "./utils/utils.js";
import { Strings } from "./utils/strings.js";

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

  async connectViaWebSocket(url, ConnectorClass = SocketInterface) {
    this.OT = new ConnectorClass(this, url);
  }

  /**
   * Setting files is a destructive operation, clearing whatever is already
   * in this tree in favour of new tree content.
   */
  setContent(paths = [], bypassOT = false) {
    this.clear();
    paths.sort();

    // remove all prefix strings, because those are dirs, not files.
    for (let i = 0, j; i < paths.length; i++) {
      let isDir = false;
      let mark = paths[i];
      for (j = i + 1; j < paths.length; j++) {
        if (paths[j].startsWith(mark)) {
          isDir = true;
        } else break;
      }
      if (isDir) {
        paths.splice(i--, 1);
        i = j - 2; // once to counter i++, once to counter j++
      }
    }

    paths.forEach((path) => {
      const type = isFile(path) ? `file` : `dir`;
      this.#addPath(path, undefined, `tree:add:${type}`, true, bypassOT);
    });

    this.ready = true;
    return this.emit(`tree:ready`);
  }

  // create or upload
  createEntry(path, content = undefined) {
    let eventType = (isFile(path) ? `file` : `dir`) + `:create`;
    this.#addPath(path, content, eventType);
  }

  // A rename is a relocation where only the last part of the path changed.
  renameEntry(entry, newName) {
    const oldPath = entry.path;
    const pos = oldPath.lastIndexOf(entry.name);
    let newPath = oldPath.substring(0, pos) + newName;
    if (entry.isDir) newPath += `/`;
    const eventType = (entry.isFile ? `file` : `dir`) + `:rename`;
    this.#relocateEntry(oldPath, newPath, eventType);
  }

  // A move is a relocation where everything *but* the last part of the path may have changed.
  moveEntry(entry, oldPath, newPath) {
    const eventType = (entry.isFile ? `file` : `dir`) + `:move`;
    this.#relocateEntry(oldPath, newPath, eventType);
  }

  // Deletes are a DOM removal of the entry itself, and a pruning
  // of the path -> entry map for any entry that started with the
  // same path, so we don't end up with any orphans.
  removeEntry(entry) {
    const { path, isFile, parentDir } = entry;
    const eventType = (isFile ? `file` : `dir`) + `:delete`;
    const detail = { path, emptyDir: this.removeEmptyDir };

    this.emit(eventType, detail, () => {
      // grant
      const removed = this.__delete(path, isFile);
      parentDir.checkEmpty();
      this.OT?.delete(path);
      return removed;
    });
  }

  // ================================================================================================

  async #loadSource(url) {
    const response = await fetch(url);
    const data = await response.json();
    if (data) this.setContent(data);
  }

  // private function for initiating <file-entry> or <dir-entry> creation
  #addPath(
    path,
    content = undefined,
    eventType,
    immediate = false,
    bypassOT = false
  ) {
    const { entries } = this;

    // is this a dir but missing the trailing slash?
    const fileEntry = isFile(path);
    if (!fileEntry && !path.endsWith(`/`)) path += `/`;

    if (entries[path]) {
      return this.emit(`${eventType}:error`, {
        error: Strings.PATH_EXISTS(path),
      });
    }

    // When granted, build the entry.
    const grant = () => {
      const entry = this.__create(path, fileEntry);
      if (!bypassOT) this.OT?.create(path, fileEntry);
      return entry;
    };

    // We will not be asking for permission during setContent()
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

  // private function for initiating <file-entry> or <dir-entry> path changes
  #relocateEntry(oldPath, newPath, eventType) {
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
    this.emit(eventType, { oldPath, newPath }, () => {
      // grant
      const entry = this.__move(oldPath, newPath);
      this.OT?.move(oldPath, newPath);
      return entry;
    });
  }

  // ================================================================================================

  // create notification via websocket or immediate code path:
  __create(path, isFile, when = -1) {
    const { entries } = this;

    const EntryType = isFile ? FileEntry : DirEntry;
    const entry = (entries[path] = new EntryType());
    entry.path = path;
    this.#mkdir(entry).addEntry(entry);

    return entry;
  }

  // move notification via websocket or immediate code path:
  __move(oldPath, newPath, when) {
    const { entries } = this;
    const entry = entries[oldPath];

    // Update all entries whose path starts with {oldPath},
    // which for files is just a single entry, but for dirs
    // can be any number of entries.
    Object.keys(entries).forEach((key) => {
      if (key.startsWith(oldPath)) {
        const entry = entries[key];
        entry.updatePath(oldPath, newPath);
        entries[entry.path] = entry;
        delete entries[key];
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
  __update(path, update) {
    const { entries } = this;
    const entry = entries[path];
    entry.dispatchEvent(
      new CustomEvent(`file-tree:update`, { detail: { update } })
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
      // grant
      entry.select();
      return entry;
    });
  }

  toggleDirectory(entry, detail = {}) {
    const eventType = `dir:toggle`;
    detail.path = entry.path;
    this.emit(eventType, detail, () => {
      // grant
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
