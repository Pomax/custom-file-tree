import { DirEntry } from "./dir-entry.js";
import { registry, LocalCustomElement, isFile } from "./utils.js";

/**
 * Not much going on here, just entry points into the tree.
 * Most of the code lives in the DirEntry class, instead.
 */
class FileTree extends LocalCustomElement {
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
    this.addEventListener(`dragover`, this.scrollTree);

    this._dragEndHandler = (evt) => {
      this.stopScrolling();
      this.clearDraggingState(evt);
    };

    document.addEventListener(`dragend`, this._dragEndHandler);
  }

  disconnectedCallback() {
    document.removeEventListener(`dragend`, this._dragEndHandler);
  }

  keepTouchMoving(evt) {
    // This is the stupidest thing, but without it the browser will
    // go "this finger hasn't moved, so it's time to end this touch
    // event" without a way to tell it not to. So: fake it.
    console.log(`jitter`);
    const jitter = new Event("touchmove");
    Object.assign(jitter, evt);
    this.dispatchEvent(jitter);
    if (this.shouldJitter) setTimeout(() => this.keepTouchMoving(), 50);
  }

  // check if we need to scroll the page up/down  during drag operations
  scrollTree(evt) {
    const { clientY } = evt;

    // are we dragging?
    if (!this.find(`.dragging`)) return;

    if (!this.shouldJitter) {
      this.shouldJitter = true;
      this.keepTouchMoving(evt);
    }

    // does the tree even need scrolling?
    const { innerHeight } = window;
    const { top, bottom } = this.getBoundingClientRect();
    if (top >= 0 && bottom < innerHeight) return;

    // is the event at a verticality that warrants scrolling?
    const scrollPad = 100;
    const yOffset = Math.max(0, top);
    const treeHeight = Math.min(bottom, innerHeight);
    const ratio = (clientY - yOffset) / (treeHeight - yOffset);

    // Scroll up?
    if (!this.scrolling && ratio < 0.25) {
      if (top < scrollPad) {
        console.log(`top hidden, ratio=${ratio.toFixed(2)}`);
        this.scrollPage(-5, innerHeight, scrollPad);
      }
    }

    // Scroll down?
    else if (!this.scrolling && ratio > 0.75) {
      if (bottom + scrollPad > innerHeight) {
        console.log(`bottom hidden, ratio=${ratio.toFixed(2)}`);
        this.scrollPage(5, innerHeight, scrollPad);
      }
    }

    // Stop scrolling? Note that these values don't match the
    // "hot regions" because we don't want the boundary to
    // jitter while scroll is happening.
    else if (this.scrolling && ratio > 0.3 && ratio < 0.6) {
      console.log(
        `scrolling but ratio is ${ratio.toFixed(2)}, stop scrolling.`
      );
      this.stopScrolling();
    }
  }

  scrollPage(step, innerHeight, scrollPad) {
    if (this.scrolling) return;
    this.scrolling = setInterval(() => {
      window.scrollBy(0, step);
    }, 10);
  }

  stopScrolling() {
    console.log(`stop`);
    this.shouldJitter = true;
    clearInterval(this.scrolling);
    this.scrolling = false;
  }

  setFiles(files = []) {
    // TODO: do we merge, or reset?
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
