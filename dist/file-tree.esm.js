// src/utils.js
var find = (qs, root = document) => root.querySelector(qs);
var findAll = (qs, root = document) => Array.from(root.querySelectorAll(qs));
var create = (tag) => document.createElement(tag);
var registry = globalThis.customElements;
var HTMLElement = globalThis.HTMLElement ?? class Dummy {
};
var LocalCustomElement = class extends HTMLElement {
  get root() {
    return this.closest(`file-tree`);
  }
  get parentDir() {
    return this.closest(`dir-entry`);
  }
};
function dispatchEvent(from, name, detail = {}, grant = () => {
}) {
  detail.grant = grant;
  from.root?.dispatchEvent(new CustomEvent(name, { detail }));
}

// src/file-entry.js
var FileEntry = class extends LocalCustomElement {
  init(fileName, fullPath) {
    this.setAttribute(`name`, fileName);
    this.setAttribute(`path`, fullPath);
    const heading = this.heading = create(`file-heading`);
    heading.textContent = fileName;
    this.appendChild(heading);
    const rename = create(`button`);
    rename.title = `rename file`;
    rename.textContent = `\u270F\uFE0F`;
    this.appendChild(rename);
    rename.addEventListener(`click`, (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      const newFileName = prompt(
        `New file name?`,
        this.heading.textContent
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
              currentPath.replace(this.heading.textContent, newFileName)
            );
            this.setAttribute(`name`, newFileName);
            this.heading.textContent = newFileName;
          }
        );
      }
    });
    const remove = create(`button`);
    remove.title = `delete file`;
    remove.textContent = `\u{1F5D1}\uFE0F`;
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
          }
        );
      }
    });
    this.addEventListener(`click`, () => {
      dispatchEvent(
        this,
        `filetree:file:click`,
        { fullPath: this.getAttribute(`path`) },
        () => {
          findAll(`.selected`, this.root).forEach(
            (e) => e.classList.remove(`selected`)
          );
          this.classList.add(`selected`);
        }
      );
    });
    this.draggable = true;
    this.addEventListener(`dragstart`, (evt) => {
      evt.stopPropagation();
      this.classList.add(`dragging`);
      this.dataset.id = `${Date.now()}-${Math.random()}`;
      evt.dataTransfer.setData("id", this.dataset.id);
    });
  }
  relocateContent(oldPath, newPath) {
    this.heading.textContent = this.heading.textContent.replace(
      oldPath,
      newPath
    );
    this.setAttribute(
      `path`,
      this.getAttribute(`path`).replace(oldPath, newPath)
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
};
var FileHeading = class extends LocalCustomElement {
  // this is "just an HTML element" for housing some text
};
registry.define(`file-entry`, FileEntry);
registry.define(`file-heading`, FileHeading);

// src/dir-entry.js
var DirEntry = class _DirEntry extends LocalCustomElement {
  init(name, fullPath = name) {
    this.setNameAndPath(name, fullPath);
    this.addButtons(name, fullPath);
  }
  connectedCallback() {
    this.removeListener = addDropZone(this);
    if (this.getAttribute(`path`) === `.`) {
      this.draggable = false;
    }
  }
  disconnectedCallback() {
    this.removeListener();
  }
  setNameAndPath(name, fullPath) {
    this.setAttribute(`name`, name);
    this.setAttribute(`path`, fullPath);
    let heading = find(`dir-heading`, this);
    if (!heading || heading.parentNode !== this) {
      heading = this.heading = create(`dir-heading`);
      this.appendChild(heading);
    }
    heading.textContent = name.replace(`/`, ``);
  }
  addButtons(name, fullPath) {
    this.addNewEntryButton(name, fullPath);
    this.addUploadButton(name, fullPath);
    this.addRenameButton(name, fullPath);
    this.addDeleteButton(name, fullPath);
  }
  addNewEntryButton(name, fullPath) {
    const add = create(`button`);
    add.title = `add new file`;
    add.textContent = `+`;
    add.addEventListener(`click`, () => addFileToDir(this, fullPath));
    this.appendChild(add);
  }
  addUploadButton(name, fullPath) {
    const upload = create(`button`);
    upload.title = `upload files from your device`;
    upload.textContent = `\u{1F4BB}`;
    upload.addEventListener(`click`, () => uploadFilesFromDevice(this));
    this.appendChild(upload);
  }
  addRenameButton(name, fullPath) {
    if (this.getAttribute(`path`) !== `.`) {
      const rename = create(`button`);
      rename.title = `rename dir`;
      rename.textContent = `\u270F\uFE0F`;
      this.appendChild(rename);
      rename.addEventListener(`click`, () => renameDir(this));
    }
  }
  addDeleteButton(name, fullPath) {
    const remove = create(`button`);
    remove.title = `delete dir`;
    remove.textContent = `\u{1F5D1}\uFE0F`;
    this.appendChild(remove);
    remove.addEventListener(`click`, () => deleteDir(this));
  }
  setFiles(files = []) {
    for (let fileName of files) this.addEntry(fileName, fileName);
    this.sort();
  }
  addEntry(fileName, fullPath = fileName) {
    if (!fileName.includes(`/`)) {
      if (fileName.includes(`.`)) {
        return this.addFile(fileName, fullPath);
      } else {
        return this.addDirectory(fileName + `/`, fullPath + `/`);
      }
    }
    const dirName = fileName.substring(0, fileName.indexOf(`/`) + 1);
    const dirPath = fullPath.substring(0, fullPath.lastIndexOf(`/`) + 1);
    let dir = find(`& > dir-entry[name="${dirName}"]`, this);
    if (!dir) {
      dir = new _DirEntry();
      dir.init(dirName, dirPath);
      this.appendChild(dir);
    }
    return dir.addEntry(fileName.replace(dirName, ``), fullPath);
  }
  addFile(fileName, fullPath) {
    let file = find(`& > file-entry[name="${fileName}"]`, this);
    if (!file) {
      file = new FileEntry();
      file.init(fileName, fullPath);
      this.appendChild(file);
      this.sort(false);
    }
    return file;
  }
  addFileFromUpload(fileName, content) {
    const localPath = this.getAttribute(`path`);
    const fullPath = (localPath !== `.` ? localPath : ``) + fileName;
    dispatchEvent(
      this,
      `filetree:file:upload`,
      { fileName: fullPath, content },
      () => {
        this.addEntry(fileName, fullPath);
        this.sort();
      }
    );
  }
  addDirectory(dirName, fullPath) {
    const dir = new _DirEntry();
    dir.init(dirName, fullPath);
    this.appendChild(dir);
    this.sort(false);
    return dir;
  }
  sort(recursive = true) {
    const children = [...this.children];
    children.sort((a, b) => {
      if (a.tagName === `DIR-HEADING`) return -1;
      if (b.tagName === `DIR-HEADING`) return 1;
      if (a.tagName === `BUTTON`) return -1;
      if (b.tagName === `BUTTON`) return 1;
      if (a.tagName === `DIR-ENTRY` && b.tagName === `DIR-ENTRY`) {
        a = a.getAttribute(`path`);
        b = b.getAttribute(`path`);
        return a < b ? -1 : 1;
      } else if (a.tagName === `DIR-ENTRY`) {
        return -1;
      } else if (b.tagName === `DIR-ENTRY`) {
        return 1;
      }
      a = a.getAttribute(`path`);
      b = b.getAttribute(`path`);
      return a < b ? -1 : 1;
    });
    children.forEach((c) => this.appendChild(c));
    if (recursive) {
      findAll(`dir-entry`, this).forEach((d) => d.sort(recursive));
    }
  }
  relocateContent(oldPath, newPath) {
    for (let c of this.children) c.relocateContent?.(oldPath, newPath);
  }
  removeEntry(path) {
    for (let c of this.children) c.removeEntry?.(path);
  }
  selectEntry(filePath) {
    for (let c of this.children) c.selectEntry?.(filePath);
  }
  checkEmpty() {
    if (!this.root.getAttribute(`remove-empty`)) return;
    if (!find(`file-entry`, this)) {
      dispatchEvent(
        this,
        `filetree:dir:delete`,
        { path: this.getAttribute(`path`) },
        () => {
          this.parentNode.removeChild(this);
        }
      );
    }
  }
  toJSON() {
    return JSON.stringify(this.toValue());
  }
  toString() {
    return this.toValue().join(`,`);
  }
  toValue() {
    return [
      findAll(`& > dir-entry`, this).map((d) => d.toValue()),
      findAll(`& > file-entry`, this).map((f) => f.toValue())
    ].flat(Infinity);
  }
};
var DirHeading = class extends LocalCustomElement {
  // this is "just an HTML element" for housing some text
};
registry.define(`dir-entry`, DirEntry);
registry.define(`dir-heading`, DirHeading);
function getFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = ({ target }) => resolve(target.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
function inThisDir(dir, entry) {
  if (entry === dir) return true;
  return entry.parentDir === dir;
}
function addDropZone(dirEntry) {
  const abort = new AbortController();
  dirEntry.draggable = true;
  dirEntry.addEventListener(
    `dragstart`,
    (evt) => {
      evt.stopPropagation();
      dirEntry.classList.add(`dragging`);
      dirEntry.dataset.id = `${Date.now()}-${Math.random()}`;
      evt.dataTransfer.setData("id", dirEntry.dataset.id);
    },
    { signal: abort.signal }
  );
  dirEntry.addEventListener(
    `dragenter`,
    (evt) => {
      evt.preventDefault();
      dirEntry.classList.add(`drop`);
    },
    { signal: abort.signal }
  );
  dirEntry.addEventListener(
    `dragover`,
    (evt) => {
      const el = evt.target;
      if (inThisDir(dirEntry, el)) {
        evt.preventDefault();
        dirEntry.classList.add(`drop`);
      }
    },
    { signal: abort.signal }
  );
  dirEntry.addEventListener(
    `dragleave`,
    (evt) => {
      evt.preventDefault();
      dirEntry.classList.remove(`drop`);
    },
    { signal: abort.signal }
  );
  dirEntry.addEventListener(
    `drop`,
    async (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      dirEntry.classList.remove(`drop`);
      const entryId = evt.dataTransfer.getData(`id`);
      if (entryId) {
        return processRelocation(dirEntry, entryId);
      }
      await processUpload(dirEntry, evt.dataTransfer.items);
    },
    { signal: abort.signal }
  );
  return () => abort.abort();
}
function addFileToDir(dirEntry, dir) {
  let fileName = prompt(
    "Please specify a filename.\nUse / as directory delimiter (e.g. cake/yum.js)"
  )?.trim();
  if (fileName) {
    let prompted = fileName;
    if (dir !== `.`) {
      fileName = dir + fileName;
    }
    if (fileName.includes(`.`)) {
      dispatchEvent(dirEntry, `filetree:file:create`, { fileName }, () => {
        return dirEntry.addEntry(prompted, fileName);
      });
    } else {
      if (confirm(`Did you mean to create a new directory ${fileName}?`)) {
        dispatchEvent(
          dirEntry,
          `filetree:dir:create`,
          { dirName: fileName },
          () => {
            dirEntry.addDirectory(prompted + `/`, fileName + `/`);
          }
        );
      }
    }
  }
}
function uploadFilesFromDevice(dirEntry) {
  const upload = create(`input`);
  upload.type = `file`;
  upload.multiple = true;
  const which = confirm(
    `To upload one or more files, press "OK". To upload an entire folder, press "Cancel".`
  );
  if (!which) upload.webkitdirectory = true;
  upload.addEventListener(`change`, () => {
    const { files } = upload;
    if (!files) return;
    console.log(files);
    processUpload(dirEntry, files);
  });
  upload.click();
}
async function processUpload(dirEntry, items) {
  console.log(items);
  async function iterate(item, path = ``) {
    if (item instanceof File) {
      const content = await getFileContent(item);
      const fileName = path + (item.webkitRelativePath || item.name);
      dirEntry.addFileFromUpload(fileName, content);
    } else if (item.isFile) {
      item.file(async (file) => {
        const content = await getFileContent(file);
        const fileName = path + file.name;
        dirEntry.addFileFromUpload(fileName, content);
      });
    } else if (item.isDirectory) {
      item.createReader().readEntries(async (entries) => {
        for (let entry of entries) await iterate(entry, path + item.name + "/");
      });
    }
  }
  await Promise.all(
    [...items].map(
      async (item) => await iterate(item instanceof File ? item : item.webkitGetAsEntry())
    )
  );
}
function renameDir(dirEntry) {
  const newName = prompt(
    `Choose a new directory name`,
    dirEntry.heading.textContent
  )?.trim();
  if (newName) {
    const oldName = dirEntry.heading.textContent;
    const oldPath = dirEntry.getAttribute(`path`);
    const newPath = oldPath.replace(oldName, newName);
    dispatchEvent(dirEntry, `filetree:dir:rename`, { oldPath, newPath }, () => {
      const oldPath2 = dirEntry.getAttribute(`path`);
      dirEntry.heading.textContent = newName;
      dirEntry.setAttribute(`name`, newName);
      dirEntry.setAttribute(`path`, newPath);
      dirEntry.relocateContent(oldPath2, newPath);
      return { oldPath: oldPath2, newPath };
    });
  }
}
function deleteDir(dirEntry) {
  const msg = `Are you *sure* you want to delete this directory and everything in it?`;
  if (confirm(msg)) {
    dispatchEvent(
      dirEntry,
      `filetree:dir:delete`,
      { path: dirEntry.getAttribute(`path`) },
      () => {
        dirEntry.remove();
      }
    );
  }
}
function processRelocation(dirEntry, entryId) {
  const entry = find(`[data-id="${entryId}"]`);
  delete entry.dataset.id;
  entry.classList.remove(`dragging`);
  const oldPath = entry.getAttribute(`path`);
  const dirPath = dirEntry.getAttribute(`path`);
  if (entry instanceof FileEntry) {
    const newPath = (dirPath !== `.` ? dirPath : ``) + oldPath.substring(oldPath.lastIndexOf(`/`) + 1);
    if (oldPath !== newPath) {
      const exists = find(`[path="${newPath}"]`, dirEntry.root);
      if (exists) return alert(`File ${newPath} already exists.`);
      dispatchEvent(
        dirEntry,
        `filetree:file:move`,
        { oldPath, newPath },
        () => {
          entry.setAttribute(`path`, newPath);
          dirEntry.appendChild(entry);
          dirEntry.sort();
        }
      );
    }
  }
  if (entry instanceof DirEntry) {
    const newPath = (dirPath !== `.` ? dirPath : ``) + entry.heading.textContent + `/`;
    if (oldPath !== newPath) {
      const exists = find(`[path="${newPath}"]`, dirEntry.root);
      if (exists) return alert(`Dir ${newPath} already exists.`);
      dispatchEvent(dirEntry, `filetree:dir:move`, { oldPath, newPath }, () => {
        findAll(`[path]`, entry).forEach((e) => {
          e.setAttribute(
            `path`,
            e.getAttribute(`path`).replace(oldPath, newPath)
          );
        });
        entry.setAttribute(
          `path`,
          entry.getAttribute(`path`).replace(oldPath, newPath)
        );
        dirEntry.appendChild(entry);
        dirEntry.sort();
        return { oldPath, newPath };
      });
    }
  }
}

// src/file-tree.js
var FileTree = class extends LocalCustomElement {
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
};
registry.define(`file-tree`, FileTree);
