import { DirEntry } from "./dir-entry.js";
import { registry, LocalCustomElement } from "./utils.js";

/**
 * Not much going on here, just entry points into the tree.
 * Most of the code lives in the DirEntry class, instead.
 */
class FileTree extends LocalCustomElement {
  setFiles(files = []) {
    let rootDir = this.querySelector(`dir-tree[path="."]`);
    if (!rootDir) {
      rootDir = this.rootDir = new DirEntry();
      rootDir.init(`.`);
      this.appendChild(rootDir);
    }
    rootDir.setFiles(files);
  }

  // create or upload
  addEntry(path) {
    const exists = find(`[path="${path}"]`);
    if (exists) {
      return alert(`${path} already exists. Overwrite?`);
    }
    return this.rootDir.addEntry(path);
  }

  // rename and move
  relocateEntry(oldPath, newPath) {
    let exists = find(`[path="${newPath}"]`);
    if (exists && !prompt(`${newPath} already exists. Overwrite?`)) return;
    // create new entries instead of trying to move things.
  }

  // delete might require
  removeEntry(path) {
    this.rootDir.removeEntry(path);
  }

  selectEntry(path) {
    this.rootDir.selectEntry(path);
  }

  toJSON() {
    return this.rootDir.toJSON();
  }

  toString() {
    return this.rootDir.toString();
  }

  toValue() {
    return this.toString();
  }
}

registry.define(`file-tree`, FileTree);
