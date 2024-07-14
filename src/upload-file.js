import { create, getFileContent } from "./utils.js";

export function uploadFilesFromDevice({ root }) {
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
    processUpload(root, files);
  });

  upload.click();
}

async function processUpload(root, items) {
  async function iterate(item, path = ``) {
    if (item instanceof File) {
      const content = await getFileContent(item);
      const filePath = path + (item.webkitRelativePath || item.name);
      root.createFile(filePath, content);
    } else if (item.isFile) {
      item.file(async (file) => {
        const content = await getFileContent(file);
        const filePath = path + file.name;
        root.createFile(filePath, content);
      });
    } else if (item.isDirectory) {
      // NOTE: This will skip empty dirs, which is unfortunately by design. The
      //       whole "uploading an entire folder" isn't part of the standard, so
      //       all browser makers (lol, all two of them) support this sad version.
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
