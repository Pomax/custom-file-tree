import { expect, test } from "@playwright/test";
import { Strings } from "../src/utils/strings.js";

test.describe(`file events`, () => {
  let page;
  let fileTree;
  let eventPromise;

  async function listenForEvent(eventType) {
    eventPromise = page.evaluate(
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
      const entry = entries[path];
      return !!(entry?.path === path);
    }, path);
  }

  async function entryExists(path) {
    return expect(await hasEntry(path)).toBe(true);
  }

  async function entryDoesNotExist(path) {
    return expect(await hasEntry(path)).toBe(false);
  }

  test.beforeEach(async ({ browser }) => {
    eventPromise = undefined;
    page = await browser.newPage();
    page.on("console", (msg) => console.log(msg.text()));
    await page.goto(`http://localhost:8000`);
    fileTree = page.locator(`file-tree`).first();
  });

  /**
   * All file:create event code paths
   */
  test.describe(`file:create`, () => {
    const listenForFileCreateEvent = () => listenForEvent(`file:create`);

    test(`creating a file at the root location`, async () => {
      listenForFileCreateEvent();

      page.on(`dialog`, async (dialog) => {
        await dialog.accept(`newfile.txt`);

        const qs = `file-entry[path="newfile.txt"]`;
        const fileEntry = await page.locator(qs).first();
        await expect(fileEntry).toHaveAttribute(`name`, `newfile.txt`);

        const { type, detail } = await eventPromise;
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

        const { type, detail } = await eventPromise;
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
   * All dir:create event code paths
   */
  test.describe(`dir:create`, () => {
    const listenForDirCreateEvent = () => listenForEvent(`dir:create`);

    test(`creating a directory at the root location`, async () => {
      listenForDirCreateEvent();

      page.on(`dialog`, async (dialog) => {
        await dialog.accept(`newdir`);

        const qs = `dir-entry[path="newdir/"]`;
        const fileEntry = await page.locator(qs).first();
        await expect(fileEntry).toHaveAttribute(`name`, `newdir`);

        const { type, detail } = await eventPromise;
        await expect(type).toBe(`dir:create`);
        await expect(detail).toHaveProperty(`path`);
        await expect(detail.path).toBe(`newdir/`);
        await entryExists(`newdir/`);
      });

      await entryDoesNotExist(`newdir/`);
      const qs = `file-tree dir-entry[path="."] button[title="${Strings.CREATE_DIRECTORY}"]`;
      const btn = page.locator(qs).first();
      await btn.click();
    });

    test(`creating a directory inside the "dist" directory`, async () => {
      listenForDirCreateEvent();

      page.on(`dialog`, async (dialog) => {
        await dialog.accept(`newdir`);

        const qs = `dir-entry[path="dist/newdir/"]`;
        const fileEntry = await page.locator(qs).first();
        await expect(fileEntry).toHaveAttribute(`name`, `newdir`);

        const { type, detail } = await eventPromise;
        await expect(type).toBe(`dir:create`);
        await expect(detail).toHaveProperty(`path`);
        await expect(detail.path).toBe(`dist/newdir/`);
        await entryExists(`dist/newdir/`);
      });

      await entryDoesNotExist(`dist/newdir/`);
      const qs = `file-tree dir-entry[path="dist/"] button[title="${Strings.CREATE_DIRECTORY}"]`;
      const btn = page.locator(qs).first();
      await btn.click();
    });

    test(`creating a directory with a dir delimiter in it should fail`, async () => {
      page.on(`dialog`, async (dialog) => {
        const type = dialog.type();
        if (type === `alert`) {
          expect(dialog.message()).toBe(Strings.CREATE_DIRECTORY_NO_NESTING);
          await dialog.dismiss();
          await entryDoesNotExist(`dist/newdir/`);
        } else {
          await dialog.accept(`dist/newdir`);
        }
      });

      const qs = `file-tree dir-entry[path="."] button[title="${Strings.CREATE_DIRECTORY}"]`;
      const btn = page.locator(qs).first();
      await btn.click();
    });
  });
});
