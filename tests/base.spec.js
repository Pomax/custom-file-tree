import { expect, test } from "@playwright/test";
import { bootstrapPage } from "./utils.js";

test.describe(`Basic tests`, () => {
  let page;
  let fileTree;
  let utils;

  test.beforeEach(async ({ browser }) => {
    utils = await bootstrapPage(browser);
    page = utils.page;
    fileTree = utils.fileTree;
  });

  test(`file-tree can be created`, async () => {
    const canBeCreated = await page.evaluate(() => {
      return customElements.whenDefined(`file-tree`).then(() => {
        try {
          document.querySelector(`file-tree`);
          return true;
        } catch {
          return false;
        }
      });
    });
    expect(canBeCreated).toBe(true);
  });

  test(`dir-entry can be created and added`, async () => {
    const canBeCreated = await page.evaluate(() => {
      return customElements.whenDefined(`dir-entry`).then(() => {
        try {
          document.querySelector(`dir-entry`);
          return true;
        } catch {
          return false;
        }
      });
    });
    expect(canBeCreated).toBe(true);
  });

  test(`file-entry can be created and added`, async () => {
    const canBeCreated = await page.evaluate(() => {
      return customElements.whenDefined(`file-entry`).then(() => {
        try {
          document.querySelector(`file-entry`);
          return true;
        } catch {
          return false;
        }
      });
    });
    expect(canBeCreated).toBe(true);
  });

  test(`file-tree can be cloned`, async () => {
    const canBeCloned = await page.evaluate(() => {
      return customElements.whenDefined(`file-tree`).then(() => {
        const tree = document.querySelector(`file-tree`);
        const clone = tree.cloneNode(true);
        const sameChildren = (n1, n2) => {
          // verify same node type
          if (n1.tagName !== n2.tagName) return false;
          // verify all children the same too
          if (n1.children.length !== n2.children.length) return false;
          return [...n1.children].every((c, i) =>
            sameChildren(c, n2.children[i])
          );
        };
        return sameChildren(tree, clone);
      });
    });
    expect(canBeCloned).toBe(true);
  });

  test(`file-tree filters out dirs`, async () => {
    const entryCount = await page.evaluate(() => {
      return customElements.whenDefined(`file-tree`).then(() => {
        const tree = document.querySelector(`file-tree`);
        tree.setContent({
          dirs: [`a`, `c`, `.d`, `f.g`],
          files: [`a/b.txt`, `c/d.txt`, `.d/e`, `f.g/h`],
        });
        const set = tree.querySelectorAll(`file-entry,dir-entry`);
        return set.length;
      });
    });
    expect(entryCount).toBe(9);
  });

  test(`file-tree does not filter filename prefix matches`, async () => {
    const entryCount = await page.evaluate(() => {
      return customElements.whenDefined(`file-tree`).then(() => {
        const tree = document.querySelector(`file-tree`);
        tree.setContent({ files: [`a.txt`, `a.txt2`] });
        const set = tree.querySelectorAll(`file-entry`);
        return set.length;
      });
    });
    expect(entryCount).toBe(2);
  });
});
