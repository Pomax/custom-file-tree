import { FileTreeElement } from "./file-tree-element.js";
import { create, registry } from "../utils/utils.js";
import { Strings } from "../utils/strings.js";

export class FileEntry extends FileTreeElement {
  isFile = true;

  constructor(fileName, fullPath) {
    super(fileName, fullPath);
    this.addRenameButton();
    this.addDeleteButton();
    this.addEventHandling();
  }

  addRenameButton() {
    const btn = create(`button`);
    btn.classList.add(`rename-file`);
    btn.title = Strings.RENAME_FILE;
    btn.textContent = `✏️`;
    this.appendChild(btn);
    btn.addEventListener(`click`, (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      const newFileName = prompt(
        Strings.RENAME_FILE_PROMPT,
        this.heading.textContent,
      )?.trim();
      if (newFileName) {
        if (newFileName.includes(`/`)) {
          return alert(Strings.RENAME_FILE_MOVE_INSTEAD);
        }
        this.root.renameEntry(this, newFileName);
      }
    });
  }

  addDeleteButton() {
    const btn = create(`button`);
    btn.classList.add(`delete-file`);
    btn.title = Strings.DELETE_FILE;
    btn.textContent = `🗑️`;
    this.appendChild(btn);
    btn.addEventListener(`click`, (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      if (confirm(Strings.DELETE_FILE_PROMPT)) {
        this.root.removeEntry(this);
      }
    });
  }

  addEventHandling() {
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
