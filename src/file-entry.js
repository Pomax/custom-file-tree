import { create, registry } from "./utils.js";
import { FileTreeElement } from "./file-tree-element.js";

export class FileEntry extends FileTreeElement {
  isFile = true;

  constructor(fileName, fullPath) {
    super(fileName, fullPath);

    const rename = create(`button`);
    rename.title = `rename file`;
    rename.textContent = `✏️`;
    this.appendChild(rename);
    rename.addEventListener(`click`, (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      const newFileName = prompt(
        `New file name?`,
        this.heading.textContent
      )?.trim();
      if (newFileName) {
        if (newFileName.includes(`/`)) {
          return alert(`If you want to relocate a file, just move it.`);
        }
        this.root.renameEntry(this, newFileName);
      }
    });

    const remove = create(`button`);
    remove.title = `delete file`;
    remove.textContent = `🗑️`;
    this.appendChild(remove);
    remove.addEventListener(`click`, (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      if (confirm(`are you sure you want to delete this file?`)) {
        const dirEntry = this.parentDir;
        this.emit(`file:delete`, { path: this.path }, () => {
          dirEntry.removeChild(this);
          dirEntry.checkEmpty();
        });
      }
    });

    this.addEventListener(`click`, (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      this.root.selected(this);
    });

    // allow this file to be moved from one dir to another
    this.draggable = true;
    this.addEventListener(`dragstart`, (evt) => {
      evt.stopPropagation();
      this.classList.add(`dragging`);
      this.dataset.id = `${Date.now()}-${Math.random()}`;
      evt.dataTransfer.setData("id", this.dataset.id);
    });
  }

  relocateContent(oldPath, newPath) {
    // TODO: check if this is safe? (e.g. is there already an entry with this name in the tree?
    this.heading.textContent = this.heading.textContent.replace(
      oldPath,
      newPath
    );
    this.path = this.path.replace(oldPath, newPath);
  }

  removeEntry(path) {
    if (this.path === path) {
      this.remove();
    }
  }

  selectEntry(path) {
    this.classList.toggle(`selected`, path === this.path);
  }

  toJSON() {
    return JSON.stringify(this.toValue());
  }

  toString() {
    return this.path;
  }

  toValue() {
    return [this.toString()];
  }
}

class FileHeading extends FileTreeElement {
  // this is "just an HTML element" for housing some text
}

registry.define(`file-entry`, FileEntry);
registry.define(`file-heading`, FileHeading);
