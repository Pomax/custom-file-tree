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

  addEntry(path) {
    this.rootDir.addEntry(path);
  }

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