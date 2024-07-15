import { expect, test } from "@playwright/test";
import { Strings } from "../src/utils/strings.js";

test.describe(`file events`, () => {
  let page;
  let fileTree;
  let fileEventPromise;

  async function listenForFileEvent(eventType) {
    // and then hook into the file:create event, of course.
    fileEventPromise = await page.evaluate(
      (eventType) =>
        new Promise((resolve) => {
          document
            .querySelector(`file-tree`)
            .addEventListener(eventType, ({ type, detail }) =>
              resolve({ type, detail })
            );
        }),
      eventType
    );
  }

  async function hasEntry(path) {
    return page.evaluate((path) => {
      const { entries } = document.querySelector(`file-tree`);
      return !!entries[path];
    }, path);
  }

  async function entryExists(path) {
    return expect(await hasEntry(path)).toBe(true);
  }

  async function entryDoesNotExist(path) {
    return expect(await hasEntry(path)).toBe(false);
  }

  test.beforeEach(async ({ browser }) => {
    fileEventPromise = undefined;
    page = await browser.newPage();
    page.on("console", (msg) => console.log(msg.text()));
    await page.goto(`http://localhost:8000`);
    fileTree = page.locator(`file-tree`).first();
  });

  /**
   * UPDATE: turn into drag-and-drop test
   */
  test.describe(`drag and drop`, () => {
    const listenForFileMoveEvent = () => listenForFileEvent(`file:move`);

    test(`move a root file into a subdirectory`, async () => {
      listenForFileMoveEvent();

      await entryExists(`package.json`);
      await entryDoesNotExist(`dist/newfile.txt`);

      const dataTransfer = await page.evaluateHandle(() => new DataTransfer());

      const source = page.locator(`file-entry[path="package.json"]`);
      expect(source).toHaveAttribute(`path`, `package.json`);
      await page.dispatchEvent(`file-entry[path="package.json"]`, `dragstart`, { dataTransfer });

      const target = page.locator(`dir-entry[path="dist/"]`);
      expect(target).toHaveAttribute(`path`, `dist/`);
      await page.dispatchEvent(`dir-entry[path="dist/"]`, `drop`, { dataTransfer });

      const { detail } = await fileEventPromise;
      const { oldPath, newPath } = detail;
      expect(oldPath).toBe(`package.json`);
      expect(newPath).toBe(`dist/package.json`);

      await entryDoesNotExist(`package.json`);
      await entryExists(`dist/package.json`);
    });
  });
});
