import { expect, test } from "@playwright/test";
import { Strings } from "../src/utils/strings.js";
import { bootstrapPage } from "./utils.js";

test.describe(`move events`, () => {
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

  async function touchDragEntry(source, target) {
    const sourceSelector = `[path="${source}"]`;
    const targetSelector = `[path="${target}"]`;

    await page.evaluate(
      async ({ sourceSelector, targetSelector }) => {
        const from = document.querySelector(sourceSelector);
        const to = document.querySelector(targetSelector);
        Simulator.gestures.drag(from, to);
      },
      { sourceSelector, targetSelector }
    );
  }

  /**
   * All file:move event code paths
   */
  test.describe(`file:move`, () => {
    const listenForFileMoveEvent = () => utils.listenForEvent(`file:move`);

    test(`move a root file into a subdirectory`, async () => {
      const eventPromise = listenForFileMoveEvent();

      const sourcePath = `package.json`;
      const targetPath = `src/`;
      const finalPath = targetPath + sourcePath;

      await utils.entryExists(sourcePath);
      await utils.entryDoesNotExist(finalPath);

      await touchDragEntry(sourcePath, targetPath);
      const { detail } = await eventPromise;
      const { oldPath, newPath } = detail;
      expect(oldPath).toBe(sourcePath);
      expect(newPath).toBe(finalPath);

      await utils.entryDoesNotExist(sourcePath);
      await utils.entryExists(finalPath);
    });
  });
});
