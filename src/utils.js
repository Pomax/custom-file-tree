export const create = (tag) => document.createElement(tag);

export const isFile = (name) => {
  if (name.includes(`.`)) return true;
  let args = name.substring(name.indexOf(`?`))?.split(`,`) || [];
  return args.includes(`file`);
};

export const registry = window.customElements;

export /*async*/ function getFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = ({ target }) => resolve(target.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
