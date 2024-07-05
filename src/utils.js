export const create = (tag) => document.createElement(tag);
export const isFile = (path) => path.split(`/`).at(-1).includes(`.`);
export const registry = globalThis.customElements;
export const HTMLElement = globalThis.HTMLElement ?? class Dummy {};
export class LocalCustomElement extends HTMLElement {
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
    if (this.tagName === `FILE-TREE`) return this;
    return this.closest(`file-tree`);
  }
  get parentDir() {
    return this.closest(`dir-entry`);
  }
  emit(name, detail = {}, grant = () => {}) {
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
}
