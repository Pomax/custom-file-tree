import { expect, test } from "@playwright/test";
import { bootstrapPage } from "./utils.js";
import { Strings } from "../src/utils/strings.js";

test.describe(`rename events`, () => {
  let page;
  let fileTree;
  let utils;

  test.beforeEach(async ({ browser }) => {
    utils = await bootstrapPage(browser);
    page = utils.page;
    fileTree = utils.fileTree;
  });

  /**
   * All file:rename event code paths
   */
  test.describe(`file:rename`, () => {
    const listenForFileRenameEvent = () => utils.listenForEvent(`file:rename`);

    test(`renaming a file at the root location`, async () => {
      const eventPromise = listenForFileRenameEvent();

      page.on(`dialog`, async (dialog) => {
        await dialog.accept(`newfile.txt`);

        const qs = `file-entry[path="newfile.txt"]`;
        const fileEntry = await page.locator(qs).first();
        await expect(fileEntry).toHaveAttribute(`name`, `newfile.txt`);

        const { detail } = await eventPromise;
        const { oldPath, newPath } = detail;
        await expect(oldPath).toBe(`README.md`);
        await expect(newPath).toBe(`newfile.txt`);

        await utils.entryDoesNotExist(`README.md`);
        await utils.entryExists(`newfile.txt`);
      });

      await utils.entryExists(`README.md`);
      await utils.entryDoesNotExist(`newfile.txt`);

      await page.locator(`[path="README.md"]`).click();
      await page.locator(`[path="README.md"] > .rename-file`).click();
    });

    test(`renaming a file in the "dist" directory`, async () => {
      const eventPromise = listenForFileRenameEvent();

      page.on(`dialog`, async (dialog) => {
        await dialog.accept(`newfile.txt`);

        const qs = `file-entry[path="dist/newfile.txt"]`;
        const fileEntry = await page.locator(qs).first();
        await expect(fileEntry).toHaveAttribute(`name`, `newfile.txt`);

        const { detail } = await eventPromise;
        const { oldPath, newPath } = detail;
        await expect(oldPath).toBe(`dist/README.md`);
        await expect(newPath).toBe(`dist/newfile.txt`);

        await utils.entryDoesNotExist(`dist/README.md`);
        await utils.entryExists(`dist/newfile.txt`);
      });

      await utils.entryExists(`dist/README.md`);
      await utils.entryDoesNotExist(`dist/newfile.txt`);
      await page.locator(`[path="dist/README.md"]`).click();
      await page.locator(`[path="dist/README.md"] > .rename-file`).click();
    });

    test(`renaming a file with dir delimiter should get rejected`, async () => {
      page.on(`dialog`, async (dialog) => {
        const type = dialog.type();
        if (type === `alert`) {
          expect(dialog.message()).toBe(Strings.RENAME_FILE_MOVE_INSTEAD);
          await dialog.dismiss();
          await utils.entryExists(`README.md`);
          await utils.entryDoesNotExist(`dist/newfile.txt`);
        } else {
          await dialog.accept(`dist/newfile.txt`);
        }
      });
      await utils.entryExists(`README.md`);
      await utils.entryDoesNotExist(`dist/newfile.txt`);
      await page.locator(`[path="README.md"]`).click();
      await page.locator(`[path="README.md"] > button.rename-file`).click();
    });
  });

  /**
   * All dir:rename event code paths
   */
  test.describe(`dir:rename`, () => {
    const listenForDirRenameEvent = () => utils.listenForEvent(`dir:rename`);

    test(`renaming "dist" to "newname"`, async () => {
      const eventPromise = listenForDirRenameEvent();

      page.on(`dialog`, async (dialog) => {
        await dialog.accept(`newname`);

        const qs = `[path="newname/"]`;
        const dirEntry = await page.locator(qs);
        await expect(dirEntry).toHaveAttribute(`name`, `newname`);

        const { detail } = await eventPromise;
        const { oldPath, newPath } = detail;
        await expect(oldPath).toBe(`dist/`);
        await expect(newPath).toBe(`newname/`);

        // confirm all child content got renamed, too.
        for await (const path of [
          `newname/README.md`,
          `newname/file-tree.esm.js`,
          `newname/file-tree.esm.min.js`,
          `newname/old/README.old`,
          `newname/old/file-tree.esm.js`,
          `newname/old/file-tree.esm.min.js`,
        ]) {
          await utils.entryExists(path);
        }
      });

      await utils.entryExists(`dist/`);
      await page.locator(`[path="dist/"] > entry-heading`).click();
      await page.locator(`[path="dist/"] > .rename-dir`).click();
    });

    test(`renaming "dist/old" to "dist/newname"`, async () => {
      const eventPromise = listenForDirRenameEvent();

      page.on(`dialog`, async (dialog) => {
        await dialog.accept(`newname`);

        const qs = `[path="dist/newname/"]`;
        const dirEntry = await page.locator(qs);
        await expect(dirEntry).toHaveAttribute(`name`, `newname`);

        const { detail } = await eventPromise;
        const { oldPath, newPath } = detail;
        await expect(oldPath).toBe(`dist/old/`);
        await expect(newPath).toBe(`dist/newname/`);

        // confirm all child content got renamed, too.
        for await (const path of [
          `dist/README.md`,
          `dist/file-tree.esm.js`,
          `dist/file-tree.esm.min.js`,
          `dist/newname/README.old`,
          `dist/newname/file-tree.esm.js`,
          `dist/newname/file-tree.esm.min.js`,
        ]) {
          await utils.entryExists(path);
        }
      });

      await utils.entryExists(`dist/old/`);
      await page.locator(`[path="dist/old/"] > entry-heading`).click();
      await page.locator(`[path="dist/old/"] > .rename-dir`).click();
    });
  });
});
