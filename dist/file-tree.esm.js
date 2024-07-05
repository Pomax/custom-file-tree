// src/utils.js
var create = (tag) => document.createElement(tag);
var isFile = (path) => path.split(`/`).at(-1).includes(`.`);
var registry = globalThis.customElements;
var HTMLElement = globalThis.HTMLElement ?? class Dummy {
};
var LocalCustomElement = class extends HTMLElement {
  get removeEmpty() {
    return this.root.getAttribute(`remove-empty`);
  }
  get name() {
    return this.getAttribute(`name`);
  }
  set name(name) {
    this.setAttribute(`name`, name);
  }
  get path() {
    return this.getAttribute(`path`);
  }
  set path(path) {
    this.setAttribute(`path`, path);
  }
  get root() {
    return this.closest(`file-tree`);
  }
  get parentDir() {
    return this.closest(`dir-entry`);
  }
  emit(name, detail = {}, grant = () => {
  }) {
    detail.grant = grant;
    this.root.dispatchEvent(new CustomEvent(name, { detail }));
  }
  find(qs) {
    return this.querySelector(qs);
  }
  findInTree(qs) {
    return this.root.querySelector(qs);
  }
  findAll(qs) {
    return Array.from(this.querySelectorAll(qs));
  }
  findAllInTree(qs) {
    return Array.from(this.root.querySelectorAll(qs));
  }
};

// src/file-entry.js
var FileEntry = class extends LocalCustomElement {
  init(fileName, fullPath) {
    this.name = fileName;
    this.path = fullPath;
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
        if (newFileName.includes(`/`)) {
          return alert(`If you want to relocate a file, just move it.`);
        }
        const oldName = this.path;
        const newName = oldName.replace(this.heading.textContent, newFileName);
        const currentPath = this.path;
        this.emit(`file:rename`, { oldName, newName }, () => {
          this.path = currentPath.replace(
            this.heading.textContent,
            newFileName
          );
          this.name = newFileName;
          this.heading.textContent = newFileName;
        });
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
        this.emit(`file:delete`, { path: this.path }, () => {
          dirEntry.removeChild(this);
          if (this.removeEmpty) dirEntry.checkEmpty();
        });
      }
    });
    this.addEventListener(`click`, () => {
      this.emit(`file:click`, { path: this.path }, () => {
        this.findAllInTree(`.selected`).forEach(
          (e) => e.classList.remove(`selected`)
        );
        this.classList.add(`selected`);
      });
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
    this.clickListener = (evt) => {
      evt.stopPropagation();
      evt.preventDefault();
      if (this.path === `.`) return;
      const tag = evt.target.tagName;
      if (tag !== `DIR-ENTRY` && tag !== `DIR-HEADING`) return;
      const closed = this.classList.contains(`closed`);
      this.emit(
        `dir:click`,
        { path: this.path, currentState: closed ? `closed` : `open` },
        () => this.classList.toggle(`closed`)
      );
    };
    this.addEventListener(`click`, this.clickListener);
    this.removeListener = addDropZone(this);
    if (this.path === `.`) {
      this.draggable = false;
    }
  }
  disconnectedCallback() {
    this.removeListener();
    this.removeEventListener(`click`, this.clickListener);
  }
  setNameAndPath(name, fullPath) {
    this.name = name;
    this.path = fullPath;
    let heading = this.find(`dir-heading`);
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
    add.addEventListener(`click`, () => addEntryToDir(this, fullPath));
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
    if (this.path !== `.`) {
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
    let dir = this.find(`& > dir-entry[name="${dirName}"]`);
    if (!dir) {
      dir = new _DirEntry();
      dir.init(dirName, dirPath);
      this.appendChild(dir);
    }
    return dir.addEntry(fileName.replace(dirName, ``), fullPath);
  }
  addFile(fileName, fullPath) {
    let file = this.find(`& > file-entry[name="${fileName}"]`);
    if (!file) {
      file = new FileEntry();
      file.init(fileName, fullPath);
      this.appendChild(file);
      this.sort(false);
    }
    return file;
  }
  addFileFromUpload(fileName, content) {
    const localPath = this.path;
    const fullPath = (localPath !== `.` ? localPath : ``) + fileName;
    this.emit(`file:upload`, { fileName: fullPath, content }, () => {
      this.addEntry(fileName, fullPath);
      this.sort();
    });
  }
  addDirectory(dirName, fullPath) {
    let dir = this.find(`& > dir-entry[name="${dirName}"]`);
    if (!dir) {
      dir = new _DirEntry();
      dir.init(dirName, fullPath);
      this.appendChild(dir);
      this.sort(false);
    }
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
        a = a.path;
        b = b.path;
        return a < b ? -1 : 1;
      } else if (a.tagName === `DIR-ENTRY`) {
        return -1;
      } else if (b.tagName === `DIR-ENTRY`) {
        return 1;
      }
      a = a.path;
      b = b.path;
      return a < b ? -1 : 1;
    });
    children.forEach((c) => this.appendChild(c));
    if (recursive) {
      this.findAll(`& > dir-entry`).forEach((d) => d.sort(recursive));
    }
  }
  relocateContent(oldPath, newPath) {
    for (let c of this.children) c.relocateContent?.(oldPath, newPath);
  }
  removeEntry(path) {
    if (path === this.path) {
      return this.remove();
    }
    for (let c of this.children) c.removeEntry?.(path);
  }
  selectEntry(filePath) {
    for (let c of this.children) c.selectEntry?.(filePath);
  }
  checkEmpty() {
    if (!this.removeEmpty) return;
    if (!this.find(`file-entry`)) {
      this.emit(`dir:delete`, { path: this.path }, () => {
        this.parentNode.removeChild(this);
      });
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
      this.findAll(`& > dir-entry`).map((d) => d.toValue()),
      this.findAll(`& > file-entry`).map((f) => f.toValue())
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
  const unmark = () => {
    dirEntry.findAllInTree(`.drop-target`).forEach((d) => d.classList.remove(`drop-target`));
  };
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
      unmark();
      dirEntry.classList.add(`drop-target`);
    },
    { signal: abort.signal }
  );
  dirEntry.addEventListener(
    `dragover`,
    (evt) => {
      const el = evt.target;
      if (inThisDir(dirEntry, el)) {
        evt.preventDefault();
        unmark();
        dirEntry.classList.add(`drop-target`);
      }
    },
    { signal: abort.signal }
  );
  dirEntry.addEventListener(
    `dragleave`,
    (evt) => {
      evt.preventDefault();
      unmark();
    },
    { signal: abort.signal }
  );
  dirEntry.addEventListener(
    `drop`,
    async (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      unmark();
      const entryId = evt.dataTransfer.getData(`id`);
      if (entryId) return processRelocation(dirEntry, entryId);
      await processUpload(dirEntry, evt.dataTransfer.items);
    },
    { signal: abort.signal }
  );
  return () => abort.abort();
}
function addEntryToDir(dirEntry, dir) {
  let fileName = prompt("Please specify a filename.")?.trim();
  if (fileName) {
    if (fileName.includes(`/`)) {
      return alert(
        `Just add new files directly to the directory where they should live.`
      );
    }
    let prompted = fileName;
    if (dir !== `.`) {
      fileName = dir + fileName;
    }
    const exists = dirEntry.findInTree(`[path="${fileName}"]`);
    if (exists) return;
    if (fileName.includes(`.`)) {
      dirEntry.emit(`file:create`, { fileName }, () => {
        return dirEntry.addEntry(prompted, fileName);
      });
    } else {
      if (confirm(`Did you mean to create a new directory ${fileName}?`)) {
        dirEntry.emit(`dir:create`, { dirName: fileName }, () => {
          dirEntry.addDirectory(prompted + `/`, fileName + `/`);
        });
      }
    }
  }
}
function uploadFilesFromDevice(dirEntry) {
  const upload = create(`input`);
  upload.type = `file`;
  upload.multiple = true;
  const uploadFiles = confirm(
    `To upload one or more files, press "OK". To upload an entire folder, press "Cancel".`
  );
  if (!uploadFiles) upload.webkitdirectory = true;
  upload.addEventListener(`change`, () => {
    const { files } = upload;
    if (!files) return;
    processUpload(dirEntry, files);
  });
  upload.click();
}
async function processUpload(dirEntry, items) {
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
      const updatedPath = path + item.name + "/";
      item.createReader().readEntries(async (entries) => {
        for (let entry of entries) await iterate(entry, updatedPath);
      });
    }
  }
  for await (let item of items) {
    try {
      await iterate(item instanceof File ? item : item.webkitGetAsEntry());
    } catch (e) {
      return alert(`Unfortunately, a ${item.kind} is not a file or folder.`);
    }
  }
}
function renameDir(dirEntry) {
  const newName = prompt(
    `Choose a new directory name`,
    dirEntry.heading.textContent
  )?.trim();
  if (newName) {
    if (newName.includes(`/`)) {
      return alert(`If you want to relocate a dir, just move it.`);
    }
    const oldName = dirEntry.heading.textContent;
    const oldPath = dirEntry.path;
    const newPath = oldPath.replace(oldName, newName);
    const dir = dirEntry.findInTree(`dir-entry[path="${newPath}"]`);
    if (dir && confirm(`That directory already exists. Move all the content?`)) {
      dirEntry.emit(`dir:rename`, { oldPath, newPath }, () => {
        const oldPath2 = dirEntry.path;
        dirEntry.heading.textContent = newName;
        dirEntry.name = newName;
        dirEntry.path = newPath;
        dirEntry.relocateContent(oldPath2, newPath);
        return { oldPath: oldPath2, newPath };
      });
    }
  }
}
function deleteDir(dirEntry) {
  const msg = `Are you *sure* you want to delete this directory and everything in it?`;
  if (confirm(msg)) {
    dirEntry.emit(`dir:delete`, { path: dirEntry.path }, () => {
      dirEntry.remove();
    });
  }
}
function processRelocation(dirEntry, entryId) {
  const entry = dirEntry.findInTree(`[data-id="${entryId}"]`);
  delete entry.dataset.id;
  entry.classList.remove(`dragging`);
  if (entry === dirEntry) return;
  const oldPath = entry.path;
  const dirPath = dirEntry.path;
  if (entry instanceof FileEntry) {
    const newPath = (dirPath !== `.` ? dirPath : ``) + oldPath.substring(oldPath.lastIndexOf(`/`) + 1);
    if (oldPath !== newPath) {
      const grant = dirEntry.root.relocateEntry(oldPath, newPath);
      if (grant) {
        dirEntry.emit(`file:move`, { oldPath, newPath }, grant);
      }
    }
  }
  if (entry instanceof DirEntry) {
    const newPath = (dirPath !== `.` ? dirPath : ``) + entry.heading.textContent + `/`;
    if (oldPath !== newPath) {
      const grant = dirEntry.root.relocateEntry(oldPath, newPath);
      if (grant) {
        dirEntry.emit(`dir:move`, { oldPath, newPath }, grant);
      }
    }
  }
}

// src/file-tree.js
var FileTree = class extends LocalCustomElement {
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
        this.rootDir.addEntry(addPath);
        this.removeEntry(removePath);
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
