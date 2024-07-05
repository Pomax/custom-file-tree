import {
  create,
  registry,
  LocalCustomElement,
  dispatchEvent,
  findAll,
} from "./utils.js";

/**
 * ...
 */
export class FileEntry extends LocalCustomElement {
  init(fileName, fullPath) {
    this.setAttribute(`name`, fileName);
    this.setAttribute(`path`, fullPath);

    const heading = (this.heading = create(`file-heading`));
    heading.textContent = fileName;
    this.appendChild(heading);

    const rename = create(`button`);
    rename.title = `rename file`;
    rename.textContent = `✏️`;
    this.appendChild(rename);
    rename.addEventListener(`click`, (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      const newFileName = prompt(
        `New file name?`,
        this.heading.textContent,
      )?.trim();
      if (newFileName) {
        const oldName = this.getAttribute(`path`);
        const newName = oldName.replace(this.heading.textContent, newFileName);
        const currentPath = this.getAttribute(`path`);
        dispatchEvent(
          this,
          `filetree:file:rename`,
          { oldName, newName },
          () => {
            this.setAttribute(
              `path`,
              currentPath.replace(this.heading.textContent, newFileName),
            );
            this.setAttribute(`name`, newFileName);
            this.heading.textContent = newFileName;
          },
        );
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
        dispatchEvent(
          this,
          `filetree:file:delete`,
          { path: this.getAttribute(`path`) },
          () => {
            dirEntry.removeChild(this);
            if (this.root?.getAttribute(`remove-empty`)) {
              dirEntry.checkEmpty();
            }
          },
        );
      }
    });

    this.addEventListener(`click`, () => {
      dispatchEvent(
        this,
        `filetree:file:click`,
        { fullPath: this.getAttribute(`path`) },
        () => {
          findAll(`.selected`, this.root).forEach((e) =>
            e.classList.remove(`selected`),
          );
          this.classList.add(`selected`);
        },
      );
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
      newPath,
    );
    this.setAttribute(
      `path`,
      this.getAttribute(`path`).replace(oldPath, newPath),
    );
  }

  removeEntry(path) {
    if (this.getAttribute(`path`) === path) {
      this.remove();
    }
  }

  selectEntry(path) {
    this.classList.toggle(`selected`, path === this.getAttribute(`path`));
  }

  toJSON() {
    return `"${this.toValue()}"`;
  }

  toString() {
    return this.toValue();
  }

  toValue() {
    return this.getAttribute(`path`);
  }
}

class FileHeading extends LocalCustomElement {
  // this is "just an HTML element" for housing some text
}

registry.define(`file-entry`, FileEntry);
registry.define(`file-heading`, FileHeading);
