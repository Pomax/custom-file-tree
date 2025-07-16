import { expect, test } from "@playwright/test";
import { bootstrapPage } from "./utils.js";

const randomString = Math.random().toFixed(18).substring(2);

async function dragAndDrop(page, source, target) {
  const sourceSelector = `[path="${source}"]`;
  const sourceElement = page.locator(sourceSelector);
  expect(sourceElement).toHaveAttribute(`path`, source);

  const targetSelector = `[path="${target}"]`;
  const targetElement = page.locator(targetSelector);
  expect(targetElement).toHaveAttribute(`path`, target);

  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await page.dispatchEvent(sourceSelector, `dragstart`, { dataTransfer });
  await page.dispatchEvent(targetSelector, `drop`, { dataTransfer });
}

test.describe(`full CRUD round trip check for dirs`, () => {
  let page;
  let fileTree;
  let utils;

  test.beforeEach(async ({ browser }) => {
    utils = await bootstrapPage(browser);
    page = utils.page;
    fileTree = utils.fileTree;
  });

  const listenForDirCreateEvent = () => utils.listenForEvent(`dir:create`);
  const listenForDirRenameEvent = () => utils.listenForEvent(`dir:rename`);
  const listenForDirMoveEvent = () => utils.listenForEvent(`dir:move`);
  const listenForDirDeleteEvent = () => utils.listenForEvent(`dir:delete`);

  test(`dir operations`, async () => {
    let eventPromise = listenForDirCreateEvent();

    async function createDir(dialog) {
      const dirName = `testdir`;
      await dialog.accept(dirName);
      const dirPath = `${dirName}/`;
      const qs = `dir-entry[path="${dirPath}"]`;
      const dirEntry = await page.locator(qs).first();
      await expect(dirEntry).toHaveAttribute(`name`, dirName);

      const { detail } = await eventPromise;
      const { path } = detail;
      expect(path).toBe(`${dirPath}`);

      // set state one newly created file entry
      await page.evaluate((randomString) => {
        globalThis.__lastGrantData.setState({ randomString });
        return randomString;
      }, randomString);

      // rename the file
      eventPromise = listenForDirRenameEvent();
      page.once(`dialog`, renameDir);
      await page.locator(`[path="${dirPath}"]`).click();
      await page.locator(`[path="${dirPath}"] > .buttons .rename-dir`).click();
    }

    async function renameDir(dialog) {
      const dirName = `newtestdir`;
      await dialog.accept(dirName);
      const dirPath = `${dirName}/`;
      const qs = `dir-entry[path="${dirPath}"]`;
      const dirEntry = await page.locator(qs).first();
      await eventPromise;
      await expect(dirEntry).toHaveAttribute(`name`, dirName);

      // confirm the state is still correct
      expect(
        await page.evaluate(() => globalThis.__lastGrantData.state.randomString)
      ).toBe(randomString);

      // time to move this file!
      eventPromise = listenForDirMoveEvent();

      const sourcePath = dirPath;
      const targetPath = `dist/`;
      const finalPath = targetPath + sourcePath;
      await utils.entryExists(sourcePath);
      await utils.entryDoesNotExist(finalPath);
      await dragAndDrop(page, sourcePath, targetPath);
      const { detail } = await eventPromise;
      const { oldPath, newPath } = detail;
      expect(oldPath).toBe(sourcePath);
      expect(newPath).toBe(finalPath);

      // reconfirm the state is correct
      expect(
        await page.evaluate(() => globalThis.__lastGrantData.state.randomString)
      ).toBe(randomString);

      // Cool. Time to delete it again. Just make sure we don't have auto-delete-empty turned on.
      eventPromise = listenForDirDeleteEvent();
      page.once(`dialog`, deleteDir);
      // dirs cannot be clicked directly, they need their heading clicked:
      await page.locator(`[path="${newPath}"] > entry-heading`).click();
      await page.locator(`[path="${newPath}"] > .buttons .delete-dir`).click();
    }

    async function deleteDir(dialog) {
      await dialog.accept();

      const { detail } = await eventPromise;
      const { path } = detail;
      expect(path).toBe(`dist/newtestdir/`);
      await utils.entryDoesNotExist(`dist/newtestdir/`);

      // Even though we deleted it, the entry state
      // should exist until GC cleans up the element:
      expect(
        await page.evaluate(
          () => globalThis.__lastGrantData[0].state.randomString
        )
      ).toBe(randomString);
    }

    page.once(`dialog`, createDir);
    await utils.entryDoesNotExist(`testdir`);
    await page.locator(`[path="."] > .buttons .create-dir`).click();
  });
});
