import { expect, test } from "@playwright/test";
import { bootstrapPage } from "./utils.js";

test.describe(`delete events`, () => {
  let page;
  let fileTree;
  let utils;

  test.beforeEach(async ({ browser }) => {
    utils = await bootstrapPage(browser);
    page = utils.page;
    fileTree = utils.fileTree;
  });

  /**
   * All file:delete event code paths
   */
  test.describe(`file:delete`, () => {
    const listenForFileDeleteEvent = () => utils.listenForEvent(`file:delete`);

    test(`deleting a file at the root location`, async () => {
      const eventPromise = listenForFileDeleteEvent();

      page.on(`dialog`, async (dialog) => {
        await dialog.accept();

        const { detail } = await eventPromise;
        const { path } = detail;
        await expect(path).toBe(`README.md`);
        await utils.entryDoesNotExist(`README.md`);
      });

      await utils.entryExists(`README.md`);
      await page.locator(`[path="README.md"]`).click();
      await page.locator(`[path="README.md"] > .delete-file`).click();
    });

    test(`deleting a file in a subdirectory`, async () => {
      const eventPromise = listenForFileDeleteEvent();

      page.on(`dialog`, async (dialog) => {
        await dialog.accept();

        const { detail } = await eventPromise;
        const { path } = detail;
        await expect(path).toBe(`dist/README.md`);
        await utils.entryDoesNotExist(`dist/README.md`);
      });

      await utils.entryExists(`dist/README.md`);
      await page.locator(`[path="dist/README.md"]`).click();
      await page.locator(`[path="dist/README.md"] > .delete-file`).click();
    });
  });

  /**
   * All dir:delete event code paths
   */
  test.describe(`dir:delete`, () => {
    const listenForDirDeleteEvent = () => utils.listenForEvent(`dir:delete`);

    test(`deleting a dir at the root location`, async () => {
      const eventPromise = listenForDirDeleteEvent();

      page.on(`dialog`, async (dialog) => {
        await dialog.accept();

        const { detail } = await eventPromise;
        const { path } = detail;
        await expect(path).toBe(`dist/`);
        await utils.entryDoesNotExist(`dist/`);

        // verify no entries start with this path anymore
        const keys = await page.evaluate(() =>
          Object.keys(document.querySelector(`file-tree`).entries)
        );
        expect(!keys.some((v) => v.startsWith(`dist/`))).toBe(true);
      });

      await utils.entryExists(`dist/`);
      await page.locator(`[path="dist/"] > entry-heading`).click();
      await page.locator(`[path="dist/"] > .delete-dir`).click();
    });

    test(`deleting a dir in another directory`, async () => {
      const eventPromise = listenForDirDeleteEvent();

      page.on(`dialog`, async (dialog) => {
        await dialog.accept();

        const { detail } = await eventPromise;
        const { path } = detail;
        await expect(path).toBe(`dist/old/`);
        await utils.entryDoesNotExist(`dist/old/`);

        // verify no entries start with this path anymore
        const keys = await page.evaluate(() =>
          Object.keys(document.querySelector(`file-tree`).entries)
        );
        expect(!keys.some((v) => v.startsWith(`dist/old/`))).toBe(true);
        expect(keys.some((v) => v.startsWith(`dist/`))).toBe(true);
      });

      await utils.entryExists(`dist/old/`);
      await page.locator(`[path="dist/old/"] > entry-heading`).click();
      await page.locator(`[path="dist/old/"] > .delete-dir`).click();
    });
  });
});
