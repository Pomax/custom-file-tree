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
   * All file:create event code paths
   */
  test.describe(`file:create`, () => {
    const listenForFileCreateEvent = () => listenForFileEvent(`file:create`);

    test(`creating a file at the root location`, async () => {
      listenForFileCreateEvent();

      page.on(`dialog`, async (dialog) => {
        await dialog.accept(`newfile.txt`);

        const qs = `file-entry[path="newfile.txt"]`;
        const fileEntry = await page.locator(qs).first();
        await expect(fileEntry).toHaveAttribute(`name`, `newfile.txt`);

        const { type, detail } = await fileEventPromise;
        await expect(type).toBe(`file:create`);
        await expect(detail).toHaveProperty(`path`);
        await expect(detail.path).toBe(`newfile.txt`);
        await entryExists(`newfile.txt`);
      });

      await entryDoesNotExist(`newfile.txt`);
      const qs = `file-tree dir-entry[path="."] button[title="${Strings.CREATE_FILE}"]`;
      const btn = page.locator(qs).first();
      await btn.click();
    });

    test(`creating a file in the "dist" directory`, async () => {
      listenForFileCreateEvent();

      page.on(`dialog`, async (dialog) => {
        await dialog.accept(`newfile.txt`);

        const qs = `file-entry[path="dist/newfile.txt"]`;
        const fileEntry = await page.locator(qs).first();
        await expect(fileEntry).toHaveAttribute(`name`, `newfile.txt`);

        const { type, detail } = await fileEventPromise;
        await expect(type).toBe(`file:create`);
        await expect(detail).toHaveProperty(`path`);
        await expect(detail.path).toBe(`dist/newfile.txt`);
        await entryExists(`dist/newfile.txt`);
      });

      await entryDoesNotExist(`dist/newfile.txt`);
      const qs = `file-tree dir-entry[path="dist/"] button[title="${Strings.CREATE_FILE}"]`;
      const btn = page.locator(qs).first();
      await btn.click();
    });

    test(`creating a file with dir delimiter should get rejected`, async () => {
      page.on(`dialog`, async (dialog) => {
        const type = dialog.type();
        if (type === `alert`) {
          expect(dialog.message()).toBe(Strings.CREATE_FILE_NO_DIRS);
          await dialog.dismiss();
          await entryDoesNotExist(`dist/newfile.txt`);
        } else {
          await dialog.accept(`dist/newfile.txt`);
        }
      });
      await entryDoesNotExist(`dist/newfile.txt`);
      const qs = `file-tree dir-entry[path="."] button[title="${Strings.CREATE_FILE}"]`;
      const btn = page.locator(qs).first();
      await btn.click();
    });
  });

  /**
   * All file:rename event code paths
   */
  test.describe(`file:rename`, () => {
    const listenForFileRenameEvent = () => listenForFileEvent(`file:rename`);

    test(`renaming a file at the root location`, async () => {
      listenForFileRenameEvent();

      page.on(`dialog`, async (dialog) => {
        await dialog.accept(`newfile.txt`);

        const qs = `file-entry[path="newfile.txt"]`;
        const fileEntry = await page.locator(qs).first();
        await expect(fileEntry).toHaveAttribute(`name`, `newfile.txt`);

        const { type, detail } = await fileEventPromise;
        await expect(type).toBe(`file:rename`);

        const { oldPath, newPath } = detail;
        await expect(oldPath).toBe(`README.md`);
        await expect(newPath).toBe(`newfile.txt`);

        await entryDoesNotExist(`README.md`);
        await entryExists(`newfile.txt`);
      });

      await entryExists(`README.md`);
      await entryDoesNotExist(`newfile.txt`);

      const qs = `file-tree file-entry[path="README.md"] button[title="${Strings.RENAME_FILE}"]`;
      const btn = page.locator(qs).first();
      await btn.click();
    });

    test(`renaming a file in the "dist" directory`, async () => {
      listenForFileRenameEvent();

      page.on(`dialog`, async (dialog) => {
        await dialog.accept(`newfile.txt`);

        const qs = `file-entry[path="dist/newfile.txt"]`;
        const fileEntry = await page.locator(qs).first();
        await expect(fileEntry).toHaveAttribute(`name`, `newfile.txt`);

        const { type, detail } = await fileEventPromise;
        await expect(type).toBe(`file:rename`);

        const { oldPath, newPath } = detail;
        await expect(oldPath).toBe(`dist/README.md`);
        await expect(newPath).toBe(`dist/newfile.txt`);

        await entryDoesNotExist(`dist/README.md`);
        await entryExists(`dist/newfile.txt`);
      });

      await entryExists(`dist/README.md`);
      await entryDoesNotExist(`dist/newfile.txt`);

      const qs = `file-tree file-entry[path="dist/README.md"] button[title="${Strings.RENAME_FILE}"]`;
      const btn = page.locator(qs).first();
      await btn.click();
    });

    test(`renaming a file with dir delimiter should get rejected`, async () => {
      page.on(`dialog`, async (dialog) => {
        const type = dialog.type();
        if (type === `alert`) {
          expect(dialog.message()).toBe(Strings.RENAME_FILE_MOVE_INSTEAD);
          await dialog.dismiss();
          await entryExists(`README.md`);
          await entryDoesNotExist(`dist/newfile.txt`);
        } else {
          await dialog.accept(`dist/newfile.txt`);
        }
      });
      await entryExists(`README.md`);
      await entryDoesNotExist(`dist/newfile.txt`);
      const qs = `file-tree file-entry[path="README.md"] button[title="${Strings.RENAME_FILE}"]`;
      const btn = page.locator(qs).first();
      await btn.click();
    });
  });

  /**
   * All file:upload event code paths - no idea how we test this given that
   * we use a JS-only input dialog, or device drag-and-drop...???
   */
});
