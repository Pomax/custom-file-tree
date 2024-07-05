export const find = (qs, root = document) => root.querySelector(qs);

export const findAll = (qs, root = document) =>
  Array.from(root.querySelectorAll(qs));

export const create = (tag) => document.createElement(tag);

export const registry = globalThis.customElements;

export const HTMLElement = globalThis.HTMLElement ?? class Dummy {};

export class LocalCustomElement extends HTMLElement {
  get root() {
    return this.closest(`file-tree`);
  }
  get parentDir() {
    return this.closest(`dir-entry`);
  }
}

export function dispatchEvent(from, name, detail = {}, grant = () => {}) {
  detail.grant = grant;
  from.root?.dispatchEvent(new CustomEvent(name, { detail }));
}
