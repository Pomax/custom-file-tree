import { expect, test } from "@playwright/test";
import { bootstrapPage } from "./utils.js";
import { Strings } from "../src/utils/strings.js";

test.describe(`create events`, () => {
  let page;
  let fileTree;
  let utils;

  test.beforeEach(async ({ browser }) => {
    utils = await bootstrapPage(browser);
    page = utils.page;
    fileTree = utils.fileTree;
  });

  /**
   * All file:create event code paths
   */
  test.describe(`file:create`, () => {
    const listenForFileCreateEvent = () => utils.listenForEvent(`file:create`);

    test(`creating a file at the root location`, async () => {
      const eventPromise = listenForFileCreateEvent();

      page.on(`dialog`, async (dialog) => {
        await dialog.accept(`newfile.txt`);

        const qs = `file-entry[path="newfile.txt"]`;
        const fileEntry = await page.locator(qs).first();
        await expect(fileEntry).toHaveAttribute(`name`, `newfile.txt`);

        const { detail } = await eventPromise;
        const { path } = detail;
        await expect(path).toBe(`newfile.txt`);
        await utils.entryExists(`newfile.txt`);
      });

      await utils.entryDoesNotExist(`newfile.txt`);
      await page.locator(`[path="."] > .create-file`).click();
    });

    test(`creating a file in the "dist" directory`, async () => {
      const eventPromise = listenForFileCreateEvent();

      page.on(`dialog`, async (dialog) => {
        await dialog.accept(`newfile.txt`);

        const qs = `file-entry[path="dist/newfile.txt"]`;
        const fileEntry = await page.locator(qs).first();
        await expect(fileEntry).toHaveAttribute(`name`, `newfile.txt`);

        const { detail } = await eventPromise;
        const { path } = detail;
        await expect(path).toBe(`dist/newfile.txt`);
        await utils.entryExists(`dist/newfile.txt`);
      });

      await utils.entryDoesNotExist(`dist/newfile.txt`);
      await page.locator(`[path="dist/"] > entry-heading`).click();
      await page.locator(`[path="dist/"] > .create-file`).click();
    });

    test(`creating a file with dir delimiter should get rejected`, async () => {
      page.on(`dialog`, async (dialog) => {
        const type = dialog.type();
        if (type === `alert`) {
          expect(dialog.message()).toBe(Strings.CREATE_FILE_NO_DIRS);
          await dialog.dismiss();
          await utils.entryDoesNotExist(`dist/newfile.txt`);
        } else {
          await dialog.accept(`dist/newfile.txt`);
        }
      });
      await utils.entryDoesNotExist(`dist/newfile.txt`);
      await page.locator(`[path="."] > .create-file`).click();
    });
  });

  /**
   * All dir:create event code paths
   */
  test.describe(`dir:create`, () => {
    const listenForDirCreateEvent = () => utils.listenForEvent(`dir:create`);

    test(`creating a directory at the root location`, async () => {
      const eventPromise = listenForDirCreateEvent();

      page.on(`dialog`, async (dialog) => {
        await dialog.accept(`newdir`);

        const qs = `dir-entry[path="newdir/"]`;
        const fileEntry = await page.locator(qs).first();
        await expect(fileEntry).toHaveAttribute(`name`, `newdir`);

        const { detail } = await eventPromise;
        const { path } = detail;
        await expect(path).toBe(`newdir/`);
        await utils.entryExists(`newdir/`);
      });

      await utils.entryDoesNotExist(`newdir/`);
      await page.locator(`[path="."] > .create-dir`).click();
    });

    test(`creating a directory inside the "dist" directory`, async () => {
      const eventPromise = listenForDirCreateEvent();

      page.on(`dialog`, async (dialog) => {
        await dialog.accept(`newdir`);

        const qs = `dir-entry[path="dist/newdir/"]`;
        const fileEntry = await page.locator(qs).first();
        await expect(fileEntry).toHaveAttribute(`name`, `newdir`);

        const { detail } = await eventPromise;
        const { path } = detail;
        await expect(path).toBe(`dist/newdir/`);
        await utils.entryExists(`dist/newdir/`);
      });

      await utils.entryDoesNotExist(`dist/newdir/`);
      await page.locator(`[path="dist/"] > entry-heading`).click();
      await page.locator(`[path="dist/"] > .create-dir`).click();
    });

    test(`creating a directory with a dir delimiter in it should fail`, async () => {
      page.on(`dialog`, async (dialog) => {
        const type = dialog.type();
        if (type === `alert`) {
          expect(dialog.message()).toBe(Strings.CREATE_DIRECTORY_NO_NESTING);
          await dialog.dismiss();
          await utils.entryDoesNotExist(`dist/newdir/`);
        } else {
          await dialog.accept(`dist/newdir`);
        }
      });

      await page.locator(`[path="."] > .create-dir`).click();
    });
  });
});
