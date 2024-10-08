import { FileTreeElement } from "./file-tree-element.js";
import { create, registry } from "../utils/utils.js";
import { makeDropZone } from "../utils/make-drop-zone.js";
import { uploadFilesFromDevice } from "../utils/upload-file.js";
import { Strings } from "../utils/strings.js";

/**
 * ...
 */
export class DirEntry extends FileTreeElement {
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
    this.addExternalListener(this.icon, `click`, (evt) =>
      this.foldListener(evt),
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
      currentState: closed ? `closed` : `open`,
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
    btn.title = Strings.CREATE_FILE;
    btn.textContent = `📄`;
    btn.addEventListener(`click`, () => this.#createFile());
    this.buttons.appendChild(btn);
  }

  #createFile() {
    let fileName = prompt(Strings.CREATE_FILE_PROMPT)?.trim();
    if (fileName) {
      if (fileName.includes(`/`)) {
        return alert(Strings.CREATE_FILE_NO_DIRS);
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
    if (this.hasButton(`create-dir`)) return;

    const btn = create(`button`);
    btn.classList.add(`create-dir`);
    btn.title = Strings.CREATE_DIRECTORY;
    btn.textContent = `📁`;
    btn.addEventListener(`click`, () => this.#createDir());
    this.buttons.appendChild(btn);
  }

  #createDir() {
    let dirName = prompt(String.CREATE_DIRECTORY_PROMPT)?.trim();
    if (dirName) {
      if (dirName.includes(`/`)) {
        return alert(Strings.CREATE_DIRECTORY_NO_NESTING);
      }
      let path = (this.path !== `.` ? this.path : ``) + dirName + `/`;
      this.root.createEntry(path);
    }
  }

  /**
   * Upload files or an entire directory from your device
   */
  addUploadButton() {
    if (this.hasButton(`upload`)) return;

    const btn = create(`button`);
    btn.classList.add(`upload`);
    btn.title = Strings.UPLOAD_FILES;
    btn.textContent = `💻`;
    // This is fairly involved, so it's its own utility function.
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
    btn.title = Strings.RENAME_DIRECTORY;
    btn.textContent = `✏️`;
    this.buttons.appendChild(btn);
    btn.addEventListener(`click`, () => this.#rename());
  }

  #rename() {
    const newName = prompt(Strings.RENAME_DIRECTORY_PROMPT, this.name)?.trim();
    if (newName) {
      if (newName.includes(`/`)) {
        return alert(Strings.RENAME_DIRECTORY_MOVE_INSTEAD);
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
    btn.title = Strings.DELETE_DIRECTORY;
    btn.textContent = `🗑️`;
    this.buttons.appendChild(btn);
    btn.addEventListener(`click`, () => this.#deleteDir());
  }

  #deleteDir() {
    const msg = Strings.DELETE_DIRECTORY_PROMPT(this.path);
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
    // let's make the reason explicit:
    const deleteBecauseWeAreEmpty = true;
    this.root.removeEntry(this, deleteBecauseWeAreEmpty);
  }

  // File tree sorting, with dirs at the top
  sort(recursive = true, separateDirs = true) {
    const children = [...this.children];
    children.sort((a, b) => {
      // icon first (there can only be one)
      if (a.tagName === `SPAN` && a.classList.contains(`icon`)) return -1;
      if (b.tagName === `SPAN` && b.classList.contains(`icon`)) return 1;

      // then dir heading (there can only be one)
      if (a.tagName === `ENTRY-HEADING`) return -1;
      if (b.tagName === `ENTRY-HEADING`) return 1;

      // then the buttons, which are a span but don't use the "icon" class:
      if (a.tagName === `SPAN` && b.tagName === `SPAN`) return 0;
      else if (a.tagName === `SPAN`) return -1;
      else if (b.tagName === `SPAN`) return 1;

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

  toggle() {
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
