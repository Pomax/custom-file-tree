import { create, getFileContent } from "./utils.js";
import { Strings } from "./strings.js";

export function uploadFilesFromDevice({ root, path }) {
  const upload = create(`input`);
  upload.type = `file`;
  upload.multiple = true;

  const uploadFiles = confirm(
    `To upload one or more files, press "OK". To upload an entire folder, press "Cancel".`,
  );

  if (!uploadFiles) upload.webkitdirectory = true;

  upload.addEventListener(`change`, () => {
    const { files } = upload;
    if (!files) return;
    processUpload(root, files, path);
  });

  upload.click();
}

export async function processUpload(root, items, dirPath = ``) {
  async function iterate(item, path = ``) {
    // Direct file drop? And note the dir check, which is due to
    // the fact that our tests need to shim the directory drop
    // by faking a class that extends File... =(
    if (item instanceof File && !item.isDirectory) {
      const content = await getFileContent(item);
      const filePath = path + (item.webkitRelativePath || item.name);
      const entryPath = (dirPath === `.` ? `` : dirPath) + filePath;
      root.createEntry(entryPath, content);
    }

    // File input dialog result (for files)
    else if (item.isFile) {
      item.file(async (file) => {
        const content = await getFileContent(file);
        const filePath = path + file.name;
        const entryPath = (dirPath === `.` ? `` : dirPath) + filePath;
        root.createEntry(entryPath, content);
      });
    }

    // File input dialog result (for directories)
    else if (item.isDirectory) {
      // NOTE: This will skip empty dirs, which is unfortunately by design. The
      //       whole "uploading an entire folder" isn't part of the standard, so
      //       all browser makers (lol, all two of them) support a limited version.
      const updatedPath = path + item.name + "/";
      item.createReader().readEntries(async (entries) => {
        for (let entry of entries) await iterate(entry, updatedPath);
      });
    }
  }

  for (let item of items) {
    try {
      let entry;
      if (!entry && item instanceof File) {
        entry = item;
      }
      if (!entry && item.webkitGetAsEntry) {
        entry = item.webkitGetAsEntry() ?? entry;
      }
      if (!entry && item.getAsFile) {
        entry = item.getAsFile();
      }
      await iterate(entry);
    } catch (e) {
      return alert(Strings.INVALID_UPLOAD_TYPE(item.kind));
    }
  }
}
