// TODO: switch to a more "universal" locale approach using `text(...)` where the key is normal English?

const LOCALE_STRINGS = {
  "en-GB": {
    CREATE_FILE: `Create new file`,
    CREATE_FILE_PROMPT: `Please specify a filename.`,
    CREATE_FILE_NO_DIRS: `Just add new files directly to the directory where they should live.`,

    RENAME_FILE: `Rename file`,
    RENAME_FILE_PROMPT: `New file name?`,
    RENAME_FILE_MOVE_INSTEAD: `If you want to relocate a file, just move it.`,

    DELETE_FILE: `Delete file`,
    DELETE_FILE_PROMPT: (path) => `Are you sure you want to delete ${path}?`,

    CREATE_DIRECTORY: `Add new directory`,
    CREATE_DIRECTORY_PROMPT: `Please specify a directory name.`,
    CREATE_DIRECTORY_NO_NESTING: `You'll have to create nested directories one at a time.`,

    RENAME_DIRECTORY: `Rename directory`,
    RENAME_DIRECTORY_PROMPT: `Choose a new directory name`,
    RENAME_DIRECTORY_MOVE_INSTEAD: `If you want to relocate a directory, just move it.`,

    DELETE_DIRECTORY: `Delete directory`,
    DELETE_DIRECTORY_PROMPT: (path) =>
      `Are you *sure* you want to delete ${path} and everything in it?`,

    UPLOAD_FILES: `Upload files from your device`,

    PATH_EXISTS: (path) => `${path} already exists.`,
    PATH_DOES_NOT_EXIST: (path) => `${path} does not exist.`,

    INVALID_UPLOAD_TYPE: (type) =>
      `Unfortunately, a ${type} is not a file or folder.`,
  },
};

const defaultLocale = `en-GB`;
const userLocale = globalThis.navigator?.language;
const localeStrings =
  LOCALE_STRINGS[userLocale] || LOCALE_STRINGS[defaultLocale];

export { localeStrings as Strings };
