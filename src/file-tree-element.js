import { create, registry } from "./utils.js";

const HTMLElement = globalThis.HTMLElement ?? class {};

/**
 * A convenient little superclass for file tree related elements.
 */
export class FileTreeElement extends HTMLElement {
  state = {};
  eventControllers = [];

  constructor(path = ``) {
    super();
    const heading = (this.heading = create(`entry-heading`));
    this.appendChild(heading);
    this.path = path;
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
    if (!controller) return console.trace();
    this.eventControllers.push(controller);
  }

  disconnectedCallback() {
    const { eventControllers } = this;
    while (eventControllers.length) {
      eventControllers.shift().abort();
    }
  }

  get removeEmpty() {
    return this.root.getAttribute(`remove-empty`);
  }

  get name() {
    return this.getAttribute(`name`);
  }

  set name(name) {
    console.log(`set name to`, name);
    this.setAttribute(`name`, name);
  }

  get path() {
    return this.getAttribute(`path`);
  }

  set path(path) {
    // TEST
    if (!this.isTree && !path.includes(`.`) && !path.endsWith(`/`)) {
      console.warn(`dir path "${path}" does not end in /`);
      console.trace();
    }
    // END TEST

    // Directories end in `/` so their name is at "index" -2, not -1.
    const pos = path.endsWith(`/`) ? -2 : -1;
    this.name = path.split(`/`).at(pos).replace(/#.*/, ``);

    if (!this.name && path) {
      throw Error(`why? path is ${path}`);
    }

    const heading = this.find(`& > entry-heading`);
    heading.textContent = this.name;
    console.log(`set path to`, path);
    this.setAttribute(`path`, path);
  }

  updatePath(oldPath, newPath) {
    console.log(`replacing ${oldPath} with ${newPath}`);
    const regex = new RegExp(`^${oldPath}`);
    console.log(regex);
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

  emit(eventName, detail = {}, grant = () => {}) {
    detail.grant = () => {
      grant();
      console.log(this.root.entries);
    };
    this.root.dispatchEvent(new CustomEvent(eventName, { detail }));
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

  setState(stateUpdate) {
    Object.assign(this.state, stateUpdate);
  }
}

class EntryHeading extends HTMLElement {}
registry.define(`entry-heading`, EntryHeading);
