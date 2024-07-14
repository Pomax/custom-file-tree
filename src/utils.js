export const create = (tag) => document.createElement(tag);

export function isFile(path) {
  const parts = path.split(`/`).filter((v) => !!v);
  if (parts.at(-1).includes(`.`)) return true;
  const metaData = getPathMetaData(path);
  return !!metaData.file;
}

export function getPathMetaData(path) {
  let metaData = {};
  const args = path.substring(path.indexOf(`?`))?.split(`&`) || [];
  args.forEach((v) => {
    if (v.includes(`=`)) {
      const [key, value] = v.split(`=`);
      metaData[key] = value;
    } else {
      metaData[v] = true;
    }
  });
  return metaData;
}

export const registry = window.customElements;

export /*async*/ function getFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = ({ target }) => resolve(target.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
