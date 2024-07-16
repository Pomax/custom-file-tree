import { create, registry } from "../utils/utils.js";

const HTMLElement = globalThis.HTMLElement ?? class {};

/**
 * A convenient little superclass for file tree related elements.
 */
export class FileTreeElement extends HTMLElement {
  state = {};
  eventControllers = [];

  constructor(path = ``) {
    super();

    if (path) {
      // set up our icon
      const icon = (this.icon = create(`span`));
      icon.classList.add(`icon`);
      this.appendChild(icon);

      // set up our heading
      const heading = (this.heading = create(`entry-heading`));
      this.appendChild(heading);

      // and then bootstrap
      this.path = path;
    }
  }

  addExternalListener(target, eventName, handler, options = {}) {
    const abortController = new AbortController();
    options.signal = abortController.signal;
    target.addEventListener(eventName, handler, options);
    this.addAbortController(abortController);
  }

  addListener(eventName, handler, options = {}) {
    this.addExternalListener(this, eventName, handler, options);
  }

  addAbortController(controller) {
    this.eventControllers.push(controller);
  }

  disconnectedCallback() {
    const { eventControllers } = this;
    while (eventControllers.length) {
      eventControllers.shift().abort();
    }
  }

  get removeEmptyDir() {
    return this.root.getAttribute(`remove-empty-dir`);
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
    if (!path) return;

    // Directories end in `/` so their name is at "index" -2, not -1.
    const pos = path.endsWith(`/`) ? -2 : -1;
    this.name = path.split(`/`).at(pos).replace(/#.*/, ``);

    if (!this.name && path) {
      throw Error(`why? path is ${path}`);
    }

    const heading = this.find(`& > entry-heading`);
    heading.textContent = this.name;
    this.setAttribute(`path`, path);
  }

  updatePath(oldPath, newPath) {
    const regex = new RegExp(`^${oldPath}`);
    this.path = this.path.replace(regex, newPath);
  }

  get dirPath() {
    let { path, name } = this;
    if (this.isFile) return path.replace(name, ``);
    if (this.isDir) return path.substring(0, path.lastIndexOf(name));
    throw Error(`entry is file nor dir.`);
  }

  get root() {
    return this.closest(`file-tree`);
  }

  get parentDir() {
    let element = this;
    if (element.tagName === `DIR-ENTRY`) {
      element = element.parentNode;
    }
    return element.closest(`dir-entry`);
  }

  emit(eventType, detail = {}, grant = () => {}) {
    detail.grant = grant;
    this.root.dispatchEvent(new CustomEvent(eventType, { detail }));
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

  select() {
    this.root.find(`.selected`)?.classList.remove(`selected`);
    this.classList.add(`selected`);
  }

  setState(stateUpdate) {
    Object.assign(this.state, stateUpdate);
  }
}

class EntryHeading extends HTMLElement {}
registry.define(`entry-heading`, EntryHeading);
