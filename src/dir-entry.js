import { FileTreeElement } from "./file-tree-element.js";
import { create, registry } from "./utils.js";
import { makeDropZone } from "./make-drop-zone.js";
import { uploadFilesFromDevice } from "./upload-file.js";

/**
 * ...
 */
export class DirEntry extends FileTreeElement {
  isDir = true;

  constructor(name, fullPath = name) {
    super(name, fullPath);
    this.addButtons();
  }

  connectedCallback() {
    this.clickListener = (evt) => {
      evt.stopPropagation();
      evt.preventDefault();
      if (this.path === `.`) return;
      const tag = evt.target.tagName;
      if (tag !== `DIR-ENTRY` && tag !== `ENTRY-HEADING`) return;
      const closed = this.classList.contains(`closed`);
      this.root.selectEntry(this, { currentState: closed ? `closed` : `open` });
    };

    this.addListener(`click`, this.clickListener);
    const controller = makeDropZone(this);
    if (controller) this.addAbortController(controller);
  }

  addButtons() {
    this.addRenameButton();
    this.addDeleteButton();
    this.createFileButton();
    this.createDirButton();
    this.addUploadButton();
  }

  /**
   * rename this dir.
   */
  addRenameButton() {
    if (this.path === `.`) return;
    const btn = create(`button`);
    btn.title = `Rename directory`;
    btn.textContent = `✏️`;
    this.appendChild(btn);
    btn.addEventListener(`click`, () => this.#rename());
  }

  #rename() {
    const newName = prompt(`Choose a new directory name`, this.name)?.trim();
    if (newName) {
      if (newName.includes(`/`)) {
        return alert(`If you want to relocate a dir, just move it.`);
      }
      this.root.renameEntry(this, newName);
    }
  }

  /**
   * Remove this dir and everything in it
   */
  addDeleteButton() {
    const btn = create(`button`);
    btn.title = `Delete directory`;
    btn.textContent = `🗑️`;
    this.appendChild(btn);
    btn.addEventListener(`click`, () => this.#deleteDir());
  }

  #deleteDir() {
    const msg = `Are you *sure* you want to delete this directory and everything in it?`;
    if (confirm(msg)) {
      this.root.removeEntry(this);
    }
  }

  /**
   * New file in this directory
   */
  createFileButton() {
    const btn = create(`button`);
    btn.title = `Add new file`;
    btn.textContent = `📄`;
    btn.addEventListener(`click`, () => this.#createFile());
    this.appendChild(btn);
  }

  #createFile() {
    let fileName = prompt("Please specify a filename.")?.trim();
    if (fileName) {
      if (fileName.includes(`/`)) {
        return alert(
          `Just add new files directly to the directory where they should live.`
        );
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
    const btn = create(`button`);
    btn.title = `Add new directory`;
    btn.textContent = `📁`;
    btn.addEventListener(`click`, () => this.#createDir());
    this.appendChild(btn);
  }

  #createDir() {
    let dirName = prompt("Please specify a directory name.")?.trim();
    if (dirName) {
      if (dirName.includes(`/`)) {
        return alert(
          `You'll have to create nested directories one at a time..`
        );
      }
      let path = (this.path !== `.` ? this.path : ``) + dirName + `/`;
      this.root.createEntry(path);
    }
  }

  /**
   * Upload files or an entire directory from your device
   */
  addUploadButton() {
    const btn = create(`button`);
    btn.title = `Upload files from your device`;
    btn.textContent = `💻`;
    // This is fairly involved, so it's its own utility function.
    btn.addEventListener(`click`, () => uploadFilesFromDevice(this));
    this.appendChild(btn);
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

  // File tree sorting, with dirs at the top
  sort(recursive = true, separateDirs = true) {
    const children = [...this.children];
    children.sort((a, b) => {
      // dir heading goes first, and there can only be one.
      if (a.tagName === `ENTRY-HEADING`) return -1;
      if (b.tagName === `ENTRY-HEADING`) return 1;

      // then the buttons, and there are several.
      if (a.tagName === `BUTTON` && b.tagName === `BUTTON`) return 0;
      else if (a.tagName === `BUTTON`) return -1;
      else if (b.tagName === `BUTTON`) return 1;

      // then dirs, sorted by name, if there are any.
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

      // then finally, files.
      a = a.path;
      b = b.path;
      return a < b ? -1 : 1;
    });

    children.forEach((c) => this.appendChild(c));

    if (recursive) {
      this.findAll(`& > dir-entry`).forEach((d) => d.sort(recursive));
    }
  }

  select() {
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
}

registry.define(`dir-entry`, DirEntry);
