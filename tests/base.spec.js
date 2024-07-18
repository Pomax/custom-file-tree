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
});
