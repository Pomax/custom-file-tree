import { expect } from "@playwright/test";

export async function bootstrapPage(browser, options={}) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.on("console", (msg) => console.log(msg.text()));
  await page.goto(`http://localhost:8000`);
  const utils = setupHelpers(page);
  utils.page = page;
  utils.fileTree = page.locator(`file-tree`).first();
  return utils;
}

export function setupHelpers(page) {
  /**
   * ...docs go here...
   * @param {*} eventType
   * @returns
   */
  async function listenForEvent(eventType) {
    return page.evaluate((eventType) => {
      return new Promise((resolve) => {
        document
          .querySelector(`file-tree`)
          .addEventListener(eventType, ({ type, detail }) => {
            if (detail.content) {
              const typedArray = new Uint8Array(detail.content);
              detail.content = [...typedArray];
            }
            resolve({ type, detail });
          });
      });
    }, eventType);
  }

  /**
   * ...docs go here...
   * @param {*} path
   * @returns
   */
  async function hasEntry(path) {
    return page.evaluate((path) => {
      const { entries } = document.querySelector(`file-tree`);
      const entry = entries[path];
      return !!(entry?.path === path);
    }, path);
  }

  /**
   * ...docs go here...
   * @param {*} path
   * @returns
   */
  async function entryExists(path) {
    return expect(await hasEntry(path)).toBe(true);
  }

  /**
   * ...docs go here...
   * @param {*} path
   * @returns
   */
  async function entryDoesNotExist(path) {
    return expect(await hasEntry(path)).toBe(false);
  }

  /**
   * ...docs go here...
   * @param {*} target
   * @param {*} fileNames
   */
  async function dragAndDropFiles(target, data) {
    let dataTransfer;
    const targetSelector = `[path="${target}"]`;

    // list of files
    if (data instanceof Array) {
      dataTransfer = await page.evaluateHandle((fileNames) => {
        const dataTransfer = new DataTransfer();
        const { items } = dataTransfer;
        fileNames.forEach((fileName) => {
          const item = new File([..."test data"], fileName, {
            type: `text/plain`,
          });
          items.add(item);
        });
        return dataTransfer;
      }, data);
    }

    // directory drop
    else {
      dataTransfer = await page.evaluateHandle((dirContent) => {
        const dataTransfer = new DataTransfer();
        const { items } = dataTransfer;

        // And now we hack the hell out of this because headless
        // chrome does not expose DirectoryEntry, which is SUPER
        // USEFUL... So we need to fake a File, and make sure the
        // code in `upload-file.js` knows that this is a directory.
        class FakeDir extends File {
          name = `temp`;
          isDirectory = true;
          constructor() {
            super([], `temp`);
          }
          createReader() {
            return {
              readEntries(fn) {
                fn([
                  {
                    isFile: true,
                    fullPath: `/temp/test.file`,
                    name: `test.file`,
                    file(fn) {
                      fn(
                        new File([...`test data`], `test.file`, {
                          type: `text/plain`,
                        })
                      );
                    },
                  },
                ]);
              },
            };
          }
        }

        // create a dir content object
        items.add(new FakeDir());
        return dataTransfer;
      }, data);
    }

    await page.dispatchEvent(targetSelector, `drop`, { dataTransfer });
  }

  // This is a scoped export, basically.
  return {
    listenForEvent,
    entryExists,
    entryDoesNotExist,
    dragAndDropFiles,
  };
}
