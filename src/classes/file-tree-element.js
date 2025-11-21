import { create, registry } from "../utils/utils.js";

const HTMLElement = globalThis.HTMLElement ?? class {};

/**
 * A convenient little superclass for file tree related elements.
 */
export class FileTreeElement extends HTMLElement {
  state = {};
  eventControllers = [];
  isFile = false;
  isDir = false;

  #inserted = false;

  constructor() {
    super();
    this.provisionElements();
  }

  provisionElements() {
    // allocate now, but we'll add them to the DOM later
    const icon = (this.icon = create(`span`));
    icon.classList.add(`icon`);
    this.heading = create(`entry-heading`);
    const buttons = (this.buttons = create(`span`));
    buttons.classList.add(`buttons`);
  }

  connectedCallback() {
    this.addUIElements();
  }

  afterConnectedCallback() {
    // Make sure the file-tree knows about us part of it.
    // Any "setContent" file entries will be guaranteed
    // to be known of course, but if you manually create
    // a new FileEntry() and then append that to a dir-entry
    // we need to make sure things get recorded, too.

    if (!this.#inserted) {
      this.#inserted = true;
      const dirPath = this.parentNode?.path;
      if (dirPath && dirPath !== `.` && !this.path.startsWith(dirPath)) {
        this.path = `${this.parentNode.path}${this.path}`;
      }
      this.root?.__insert(this);
    }
  }

  addUIElements() {
    const { icon, heading, buttons } = this;

    const [first] = this.children;

    if (!first) {
      !icon.parentNode && this.appendChild(icon);
      !heading.parentNode && this.appendChild(heading);
      !this.readonly && !buttons.parentNode && this.appendChild(buttons);
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
    return this.root?.removeEmptyDir;
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
    const terms = path.split(`/`);
    const name = (this.name = terms.at(pos).replace(/#.*/, ``));

    if (!this.name && path) {
      throw Error(`why? path is ${path}`);
    }

    if (this.isFile) {
      const dot = name.indexOf(`.`);
      if (dot >= 0 && dot < name.length - 1) {
        this.extension = name.substring(dot + 1);
        this.setAttribute(`extension`, this.extension);
      }
    }

    this.heading.textContent = this.name;
    this.setAttribute(`path`, path);
  }

  updatePath(isFile, oldPath, newPath) {
    // Is this an exact match?
    if (this.path === oldPath) {
      this.path = newPath;
      return true;
    }

    // If this is a file rename, there can only be an exact match
    if (isFile) return false;

    // If this is a dir path, we need to do a prefix replacement.
    const regex = new RegExp(`^${oldPath}`);
    this.path = this.path.replace(regex, newPath);
    return true;
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
    this.root?.dispatchEvent(new CustomEvent(eventType, { detail }));
  }

  find(qs) {
    return this.querySelector(qs);
  }

  findInTree(qs) {
    return this.root?.querySelector(qs);
  }

  findAll(qs) {
    return Array.from(this.querySelectorAll(qs));
  }

  findAllInTree(qs) {
    return Array.from(this.root?.querySelectorAll(qs));
  }

  hasButton(className) {
    return this.find(`& > .buttons .${className}`);
  }

  select() {
    this.root?.unselect();
    this.classList.add(`selected`);
    // If we're selecting a file, make sure that the parent dir is open.
    this.parentNode?.toggle?.(false);
  }

  setState(stateUpdate) {
    Object.assign(this.state, stateUpdate);
  }
}

class EntryHeading extends HTMLElement {}
registry.define(`entry-heading`, EntryHeading);
