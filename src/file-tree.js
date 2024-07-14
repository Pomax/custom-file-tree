import { DirEntry } from "./dir-entry.js";
import { FileEntry } from "./file-entry.js";
import { registry, isFile } from "./utils.js";
import { FileTreeElement } from "./file-tree-element.js";

/**
 * All operations "start" in the file tree, and when granted get
 * sent into the root directory for placement handling.
 */
class FileTree extends FileTreeElement {
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
    const rootDir = (this.rootDir = new DirEntry(`.`));
    this.appendChild(rootDir);
  }

  connectedCallback() {
    this.addExternalListener(document, `dragend`, () =>
      this.findAll(`.dragging`).forEach((e) => e.classList.remove(`dragging`))
    );
  }

  /**
   * Setting files is a destructive operation, clearing whatever is already
   * in this tree in favour of new tree content.
   *
   * @param {*} files
   */
  setFiles(files = []) {
    this.clear();
    files.forEach((path) =>
      this.#addPath(path, undefined, `tree:setfiles`, true)
    );
    console.log(`\n === setFiles complete ===\n\n`);
    console.log(this.entries);
  }

  // create or upload
  createEntry(path, content = undefined) {
    let eventType = (isFile(path) ? `file` : `dir`) + `:create`;
    this.#addPath(path, content, eventType);
  }

  // private function for initiating <file-entry> or <dir-entry> creation
  #addPath(path, content = undefined, eventType, immediate = false) {
    const { entries } = this;

    if (entries[path]) throw new Error(`${path} already exists.`);

    const grant = () => {
      console.log(`\n--- adding entry ---`);

      // Build the entry
      const parts = path.split(`/`);
      const name = parts.at(-1);
      const EntryType = isFile(name) ? FileEntry : DirEntry;
      const entry = new EntryType(path);
      entries[path] = entry;

      // Then add it to the actual DOM tree, after making sure its parent dir exists.
      this.#mkdir(entry).addEntry(entry);
    };

    if (immediate) {
      return grant();
    }

    this.emit(eventType, { path, content }, grant);
  }

  #mkdir({ dirPath }) {
    const { entries } = this;
    if (!dirPath) return this.rootDir;
    let dir = this.find(`[path="${dirPath}"`);
    if (dir) return dir;
    dir = this.rootDir;
    dirPath.split(`/`).forEach((fragment) => {
      if (!fragment) return;
      console.log({ dirPath: dir.path, fragment });
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

  // rename
  renameEntry(entry, newName) {
    const oldPath = entry.path;
    const pos = oldPath.lastIndexOf(entry.name);
    let newPath = oldPath.substring(0, pos) + newName;
    if (entry.isDir) {
      newPath += `/`;
    }
    console.log({ rename: true, newName, oldPath, newPath });
    const eventType = (entry.isFile ? `file` : `dir`) + `:rename`;
    this.#relocateEntry(entry, oldPath, newPath, eventType);
  }

  // move
  moveEntry(entry, oldPath, newPath) {
    const eventType = (entry.isFile ? `file` : `dir`) + `:move`;
    this.#relocateEntry(entry, oldPath, newPath, eventType);
  }

  // private function for initiating <file-entry> or <dir-entry> path changes
  #relocateEntry(entry, oldPath, newPath, eventType) {
    const { entries } = this;
    if (entries[newPath]) throw new Error(`${newPath} already exists.`);
    this.emit(eventType, { oldPath, newPath }, () => {
      console.log(`---relocate---`);

      Object.keys(entries).forEach((key) => {
        if (key.startsWith(oldPath)) {
          const entry = entries[key];
          entry.updatePath(oldPath, newPath);
          entries[entry.path] = entry;
          delete entries[key];
        }
      });

      const { dirPath } = (entries[newPath] = entry);
      console.log(`dirPath for`, entry, `is`, dirPath);
      let dir = dirPath ? entries[dirPath] : this.rootDir;
      console.log(`adding`, entry, `to`, dir);
      dir.addEntry(entry);
    });
  }

  // delete
  removeEntry(path) {
    const { entries } = this;
    const entry = entries[path];
    if (!entry) throw new Error(`${path} does not exist.`);
    const eventType = (entry.isFile ? `file` : `dir`) + `:delete`;
    this.emit(eventType, { path }, () => {
      const { path } = entry;
      Object.entries(entries).forEach(([key, entry]) => {
        if (key.startsWith(path)) {
          entry.remove();
          delete entries[key];
        }
      });
    });
  }

  selectEntry(path) {
    const entry = this.entries[path];
    if (!entry) throw new Error(`${path} does not exist.`);
    entry.click();
  }

  selected(entry) {
    const eventType = (entry.isFile ? `file` : `dir`) + `:click`;
    this.emit(eventType, { path: entry.path }, () => {
      this.find(`.selected`)?.classList.remove(`selected`);
      entry.classList.add(`selected`);
    });
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
}

registry.define(`file-tree`, FileTree);
