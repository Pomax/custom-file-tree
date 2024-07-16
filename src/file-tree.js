import { FileTreeElement } from "./classes/file-tree-element.js";
import { DirEntry } from "./classes/dir-entry.js";
import { FileEntry } from "./classes/file-entry.js";
import { registry, isFile } from "./utils/utils.js";
import { Strings } from "./utils/strings.js";

/**
 * The file tree maintains the list of path -> entry mappings,
 * and is the only place where mutations happen. If a user
 * creates, renames, uploads, moves, or deletes a file or
 * directory, that operation gets turned into a path based
 * operation, which is then handled by the file tree.
 */
class FileTree extends FileTreeElement {
  isTree = true;
  entries = {};

  constructor() {
    super();
  }

  get root() {
    return this;
  }

  get parentDir() {
    return this.rootDir;
  }

  clear() {
    if (this.rootDir) this.removeChild(this.rootDir);
    const rootDir = (this.rootDir = new DirEntry(`.`));
    this.appendChild(rootDir);
  }

  connectedCallback() {
    this.addExternalListener(document, `dragend`, () =>
      this.findAll(`.dragging`).forEach((e) => e.classList.remove(`dragging`)),
    );
  }

  /**
   * Setting files is a destructive operation, clearing whatever is already
   * in this tree in favour of new tree content.
   */
  setFiles(files = []) {
    this.clear();
    files.forEach((path) =>
      this.#addPath(path, undefined, `tree:setfiles`, true),
    );
  }

  // create or upload
  createEntry(path, content = undefined) {
    let eventType = (isFile(path) ? `file` : `dir`) + `:create`;
    this.#addPath(path, content, eventType);
  }

  // private function for initiating <file-entry> or <dir-entry> creation
  #addPath(path, content = undefined, eventType, immediate = false) {
    const { entries } = this;

    if (entries[path]) {
      throw new Error(Strings.PATH_EXISTS(path));
    }

    // When granted, build the entry.
    const grant = () => {
      const EntryType = isFile(path) ? FileEntry : DirEntry;
      const entry = new EntryType(path);
      entries[path] = entry;

      // Then add it to the actual DOM tree, after making sure its parent dir exists.
      this.#mkdir(entry).addEntry(entry);
    };

    // During setFiles, we will not be asking for permission.
    if (immediate) return grant();

    this.emit(eventType, { path, content }, grant);
  }

  // Ensure that a dir exists (recursively).
  #mkdir({ dirPath }) {
    const { entries } = this;
    if (!dirPath) return this.rootDir;
    let dir = this.find(`[path="${dirPath}"`);
    if (dir) return dir;
    dir = this.rootDir;
    dirPath.split(`/`).forEach((fragment) => {
      if (!fragment) return;
      const subDirPath = (dir.path === `.` ? `` : dir.path) + fragment + `/`;
      let subDir = this.find(`[path="${subDirPath}"`);
      if (!subDir) {
        subDir = new DirEntry(subDirPath);
        dir.addEntry(subDir);
        entries[subDirPath] = subDir;
      }
      dir = subDir;
    });
    return dir;
  }

  // A rename is a relocation where only the last part of the path changed.
  renameEntry(entry, newName) {
    const oldPath = entry.path;
    const pos = oldPath.lastIndexOf(entry.name);
    let newPath = oldPath.substring(0, pos) + newName;
    if (entry.isDir) newPath += `/`;
    const eventType = (entry.isFile ? `file` : `dir`) + `:rename`;
    this.#relocateEntry(entry, oldPath, newPath, eventType);
  }

  // A move is a relocation where everything *but* the last part of the path may have changed.
  moveEntry(entry, oldPath, newPath) {
    const eventType = (entry.isFile ? `file` : `dir`) + `:move`;
    this.#relocateEntry(entry, oldPath, newPath, eventType);
  }

  // private function for initiating <file-entry> or <dir-entry> path changes
  #relocateEntry(entry, oldPath, newPath, eventType) {
    const { entries } = this;
    if (oldPath === newPath) return;
    if (entries[newPath]) throw new Error(Strings.PATH_EXISTS(newPath));
    this.emit(eventType, { oldPath, newPath }, () => {
      // Update all entries whose path starts with {oldPath},
      // which for files is just a single entry, but for dirs
      // can be any number of entries.
      Object.keys(entries).forEach((key) => {
        if (key.startsWith(oldPath)) {
          const entry = entries[key];
          entry.updatePath(oldPath, newPath);
          entries[entry.path] = entry;
          delete entries[key];
        }
      });

      // Then make sure the relocated entry gets moved to
      // the correct parent, which we can do directly.
      const { dirPath } = (entries[newPath] = entry);
      let dir = dirPath ? entries[dirPath] : this.rootDir;
      dir.addEntry(entry);
    });
  }

  // Deletes are a DOM removal of the entry itself, and a pruning
  // of the path -> entry map for any entry that started with the
  // same path, so we don't end up with any orphans.
  removeEntry(entry, emptyDir = false) {
    const { entries } = this;
    const { path, isFile, parentDir } = entry;
    const eventType = (isFile ? `file` : `dir`) + `:delete`;
    const detail = { path };
    if (emptyDir) detail.emptyDir = true;

    this.emit(eventType, detail, () => {
      // single instances are simple removals
      if (isFile || emptyDir) {
        entry.remove();
        delete entries[path];
      }
      // dirs need a mapping traversal to remove everything inside of it.
      else {
        Object.entries(entries).forEach(([key, entry]) => {
          if (key.startsWith(path)) {
            entry.remove();
            delete entries[key];
          }
        });
      }
      // And then we check whether we need to delete the parent, too.
      parentDir.checkEmpty();
    });
  }

  // Select an entry by  its path
  select(path) {
    const entry = this.entries[path];
    if (!entry) throw new Error(Strings.PATH_DOES_NOT_EXIST(path));
    entry.click();
  }

  // Entry selection depends on the element, so we hand that
  // off to the entry itself once granted. (if granted)
  selectEntry(entry, detail = {}) {
    const eventType = (entry.isFile ? `file` : `dir`) + `:click`;
    detail.path = entry.path;
    this.emit(eventType, { detail }, () => entry.select());
  }

  sort() {
    this.rootDir.sort();
  }

  toJSON() {
    return JSON.stringify(Object.keys(this.entries).sort());
  }

  toString() {
    return this.toJSON();
  }

  toValue() {
    return this;
  }
}

registry.define(`file-tree`, FileTree);
