import { DirEntry } from "./dir-entry.js";
import { registry, LocalCustomElement, isFile } from "./utils.js";

/**
 * Not much going on here, just entry points into the tree.
 * Most of the code lives in the DirEntry class, instead.
 */
class FileTree extends LocalCustomElement {
  get root() {
    return this;
  }
  get parentDir() {
    return this.rootDir;
  }

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
    const exists = this.find(`[path="${path}"]`);
    if (exists) {
      return alert(`${path} already exists. Overwrite?`);
    }
    return this.rootDir.addEntry(path);
  }

  // rename and move
  relocateEntry(oldPath, newPath) {
    const exists = this.find(`[path="${newPath}"]`);
    if (exists) return alert(`${newPath} already exists.`);
    if (isFile(oldPath)) return this.relocateFile(oldPath, newPath);
    return this.relocateDir(oldPath, newPath);
  }

  relocateFile(oldPath, newPath) {
    return () => {
      const added = this.rootDir.addEntry(newPath);
      const removed = this.find(`[path="${oldPath}"]`);
      added.setAttribute(`class`, removed.getAttribute(`class`));
      this.removeEntry(oldPath);
    };
  }

  relocateDir(oldPath, newPath) {
    const dirEntry = this.find(`[path="${oldPath}"]`, this.rootDir);
    return () => {
      const list = dirEntry.toValue();
      list.forEach((removePath) => {
        const addPath = removePath.replace(oldPath, newPath);
        this.removeEntry(removePath);
        console.log(`adding ${addPath}`);
        this.rootDir.addEntry(addPath);
      });
      this.removeEntry(oldPath);
      this.rootDir.sort();
    };
  }

  removeEntry(path) {
    this.rootDir.removeEntry(path);
  }

  selectEntry(path) {
    this.rootDir.selectEntry(path);
  }

  sort() {
    this.rootDir.sort();
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
