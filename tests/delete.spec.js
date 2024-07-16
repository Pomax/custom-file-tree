import { expect, test } from "@playwright/test";
import { Strings } from "../src/utils/strings.js";

test.describe(`delete events`, () => {
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
   * All file:rename event code paths
   */
  test.describe(`file:delete`, () => {
    const listenForFileDeleteEvent = () => listenForEvent(`file:delete`);

    test(`deleting a file at the root location`, async () => {
      listenForFileDeleteEvent();

      page.on(`dialog`, async (dialog) => {
        await dialog.accept();

        const { type, detail } = await eventPromise;
        const { path } = detail;
        await expect(path).toBe(`README.md`);
        await entryDoesNotExist(`README.md`);
      });

      await entryExists(`README.md`);
      const qs = `file-tree file-entry[path="README.md"] button[title="${Strings.RENAME_FILE}"]`;
      const btn = page.locator(qs).first();
      await btn.click();
    });
  });
});
