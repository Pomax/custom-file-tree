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
        this.root.removeEntry(this);
      }
    });

    this.addEventListener(`click`, (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      this.root.selectEntry(this);
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

  select() {
    this.root.find(`.selected`)?.classList.remove(`selected`);
    this.classList.add(`selected`);
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

registry.define(`file-entry`, FileEntry);
