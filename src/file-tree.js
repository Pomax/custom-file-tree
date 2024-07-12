import { DirEntry } from "./dir-entry.js";
import { FileEntry } from "./file-entry.js";
import { registry, LocalCustomElement, isFile } from "./utils.js";

/**
 * Not much going on here, just entry points into the tree.
 * Most of the code lives in the DirEntry class, instead.
 */
class FileTree extends LocalCustomElement {
  entries = {};

  constructor() {
    super();
    this.clearDraggingState = () => {
      this.findAll(`.dragging`).forEach((e) => e.classList.remove(`dragging`));
    };
  }

  get root() {
    return this;
  }

  get parentDir() {
    return this.rootDir;
  }

  connectedCallback() {
    document.addEventListener(`dragend`, this.clearDraggingState);
  }

  disconnectedCallback() {
    document.removeEventListener(`dragend`, this.clearDraggingState);
  }

  setFiles(files = []) {
    let rootDir = this.querySelector(`dir-tree[path="."]`);
    if (!rootDir) {
      rootDir = this.rootDir = new DirEntry();
      rootDir.init(`.`);
      this.appendChild(rootDir);
    }
    files.forEach((path) => this.addPath(path, undefined, undefined, true));
  }

  // create or upload
  createEntry(path, content = undefined) {
    let eventType = (entry instanceof FileEntry ? `file` : `dir`) + `:create`;
    this.addPath(path, content, eventType);
  }

  addPath(path, content = undefined, eventType, immediate = false) {
    const grant = () => (this.entries[path] = this.rootDir.addPath(path));
    if (this.entries[path]) {
      throw new Error(`${path} already exists.`);
    }
    if (immediate) return grant();
    this.dispatchEvent(
      new CustomEvent(eventType, { detail: { path, content, grant } })
    );
  }

  // rename
  renameEntry(entry, newName) {
    const oldPath = entry.path;
    const newPath = oldPath.replace(new RegExp(`${entry.name}$`), newName);
    const eventType = (entry instanceof FileEntry ? `file` : `dir`) + `:rename`;
    this.relocateEntry(entry, oldPath, newPath, eventType);
  }

  // move
  moveEntry(entry, oldPath, newPath) {
    const eventType = (entry instanceof FileEntry ? `file` : `dir`) + `:move`;
    this.relocateEntry(entry, oldPath, newPath, eventType);
  }

  relocateEntry(entry, oldPath, newPath, eventType) {
    if (this.entries[newPath]) {
      throw new Error(`${newPath} already exists.`);
    }
    const grant = () => {
      delete this.entries[oldPath];
      entry.updatePath(newPath); // for dirs that means recursive content rename
      this.entries[newPath] = entry;
      this.rootDir.addEntry(entry); // appendChild effectively moves 
    };
    this.dispatchEvent(
      new CustomEvent(eventType, { detail: { oldPath, newPath, grant } })
    );
  }

  // delete
  removeEntry(path) {
    const entry = this.entries[path];
    if (!entry) {
      throw new Error(`${path} does not exist.`);
    }
    const grant = () => {
      entry.remove();
      delete this.entries[path];
    };
    const eventType = (entry instanceof FileEntry ? `file` : `dir`) + `:delete`;
    this.dispatchEvent(new CustomEvent(eventType, { detail: { path, grant } }));
  }

  selectEntry(path) {
    const entry = this.entries[path];
    if (!entry) {
      throw new Error(`${path} does not exist.`);
    }
    this.find(`.selected`)?.classList.remove(`selected`);
    entry.classList.add(`selected`);
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
