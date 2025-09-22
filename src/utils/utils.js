export const create = (tag) => document.createElement(tag);

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

export const registry = globalThis.customElements ?? { define: () => {} };

export /*async*/ function getFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = ({ target }) => resolve(target.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
