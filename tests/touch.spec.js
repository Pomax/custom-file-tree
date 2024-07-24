import { expect, test } from "@playwright/test";
import { bootstrapPage } from "./utils.js";

test.describe(`touch events`, () => {
  let page;
  let fileTree;
  let utils;

  test.beforeEach(async ({ browser }) => {
    utils = await bootstrapPage(browser, {
      hasTouch: true,
    });
    page = utils.page;
    fileTree = utils.fileTree;
  });

  async function touchEntry(sourceSelector) {
    await page.evaluate(
      async ({ sourceSelector }) => {
        const element = document.querySelector(sourceSelector);
        await globalThis.simulatedTouch.tap(element);
      },
      { sourceSelector }
    );
  }

  async function touchDragEntry(sourceSelector, targetSelector) {
    await page.evaluate(
      async ({ sourceSelector, targetSelector }) => {
        const from = document.querySelector(sourceSelector);
        const to = document.querySelector(targetSelector);
        await globalThis.simulatedTouch.drag(from, to);
      },
      { sourceSelector, targetSelector }
    );
  }

  /**
   * Touch events
   */
  test.describe(`touch events`, () => {
    test(`click a file`, async () => {
      const eventPromise = utils.listenForEvent(`file:click`);

      const sourcePath = `package.json`;
      await utils.entryExists(sourcePath);

      const sourceSelector = `[path="${sourcePath}"]`;
      await touchEntry(sourceSelector);

      const { detail } = await eventPromise;
      expect(detail.path).toBe(sourcePath);

      await expect(page.locator(sourceSelector)).toHaveClass(`selected`);
      await page.evaluate(() => document.querySelector(`file-tree`).unselect());
      await expect(page.locator(sourceSelector)).not.toHaveClass(`selected`);
    });

    test(`click a dir`, async () => {
      const eventPromise = utils.listenForEvent(`dir:click`);

      const sourcePath = `dist/`;
      await utils.entryExists(sourcePath);

      const sourceSelector = `[path="${sourcePath}"]`;
      await touchEntry(sourceSelector);

      const { detail } = await eventPromise;
      expect(detail.path).toBe(sourcePath);
    });

    test(`toggle a dir`, async () => {
      const eventPromise = utils.listenForEvent(`dir:toggle`);

      const sourcePath = `dist/`;
      await utils.entryExists(sourcePath);

      const sourceSelector = `[path="${sourcePath}"] > .icon`;
      await touchEntry(sourceSelector);

      const { detail } = await eventPromise;
      expect(detail.path).toBe(sourcePath);
    });

    test(`move a root file into a subdirectory`, async () => {
      const eventPromise = utils.listenForEvent(`file:move`);

      const sourcePath = `package.json`;
      await utils.entryExists(sourcePath);

      const targetPath = `src/`;
      const finalPath = targetPath + sourcePath;
      await utils.entryDoesNotExist(finalPath);

      const sourceSelector = `[path="${sourcePath}"]`;
      const targetSelector = `[path="${targetPath}"]`;
      await touchDragEntry(sourceSelector, targetSelector);

      const { detail } = await eventPromise;
      const { oldPath, newPath } = detail;
      expect(oldPath).toBe(sourcePath);
      expect(newPath).toBe(finalPath);

      await utils.entryDoesNotExist(sourcePath);
      await utils.entryExists(finalPath);
    });

    test(`move a file from one directory to another directory`, async () => {
      const eventPromise = utils.listenForEvent(`file:move`);

      const sourcePath = `dist/README.md`;
      await utils.entryExists(sourcePath);

      const targetPath = `dist/old/`;
      const finalPath = `dist/old/README.md`;
      await utils.entryDoesNotExist(finalPath);

      const sourceSelector = `[path="${sourcePath}"]`;
      const targetSelector = `[path="${targetPath}"]`;
      await touchDragEntry(sourceSelector, targetSelector);

      const { detail } = await eventPromise;
      const { oldPath, newPath } = detail;
      expect(oldPath).toBe(sourcePath);
      expect(newPath).toBe(finalPath);

      await utils.entryDoesNotExist(sourcePath);
      await utils.entryExists(finalPath);
    });
  });
});
