import { expect, test } from "@playwright/test";
import { Strings } from "../src/utils/strings.js";

test.describe(`file events`, () => {
  let page;
  let fileTree;
  let eventPromise;

  async function listenForEvent(eventType) {
    eventPromise = page.evaluate((eventType) => {
      return new Promise((resolve) => {
        document
          .querySelector(`file-tree`)
          .addEventListener(eventType, ({ type, detail }) => {
            resolve({ type, detail });
          });
      });
    }, eventType);
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
  async function dragAndDropFiles(target, fileNames) {
    const targetSelector = `[path="${target}"]`;

    const dataTransfer = await page.evaluateHandle((fileNames) => {
      const dataTransfer = new DataTransfer();
      const { items } = dataTransfer;
      fileNames.forEach((fileName) => {
        const item = new File([..."test data"], fileName, {
          type: `text/plain`,
        });
        items.add(item);
      });
      return dataTransfer;
    }, fileNames);

    await page.dispatchEvent(targetSelector, `drop`, { dataTransfer });
  }

  test.beforeEach(async ({ browser }) => {
    eventPromise = undefined;
    page = await browser.newPage();
    page.on("console", (msg) => console.log(msg.text()));
    await page.goto(`http://localhost:8000`);
    fileTree = page.locator(`file-tree`).first();
  });

  /**
   * All file:move event code paths
   */
  test.describe(`file:move`, () => {
    const listenForFileCreateEvent = () => listenForEvent(`file:create`);

    test(`dropping files on the root "uploads" them there`, async () => {
      listenForFileCreateEvent();
      const targetPath = `.`;
      await entryDoesNotExist(`test.file`);
      await dragAndDropFiles(targetPath, [`test.file`]);
      const { detail } = await eventPromise;
      expect(detail.path).toBe(`test.file`);
      await entryExists(`test.file`);
    });

    test(`dropping files on a directory "uploads" them there`, async () => {
      listenForFileCreateEvent();
      const targetPath = `dist/`;
      await entryDoesNotExist(`test.file`);
      await dragAndDropFiles(targetPath, [`test.file`]);
      const { detail } = await eventPromise;
      expect(detail.path).toBe(`dist/test.file`);
      await entryExists(`dist/test.file`);
    });
  });
});
