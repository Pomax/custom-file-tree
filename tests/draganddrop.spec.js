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

      await page
        .locator(`file-entry[path="package.json"]`)
        .dragTo(page.locator(`dir-entry[path="dist/"]`));

      // Why the fuck is this selecting "src/file-tree.css"???
      const { detail } = await fileEventPromise;
      const { oldPath, newPath } = detail;
      await expect(oldPath).toBe(`package.json`);
      await expect(newPath).toBe(`dist/package.json`);

      await entryExists(`package.json`);
      await entryDoesNotExist(`dist/package.json`);
    });
  });
});
