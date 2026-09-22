/** Extract plain SQL from contenteditable markup, including HTML line boundaries. */
export function getEditorText(root: Node): string {
  let text = '';
  const blocks = /^(DIV|P|PRE|LI|H[1-6]|BLOCKQUOTE)$/;
  let previousBlock = false;
  let previousEmptyBlock = false;
  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      if (previousBlock && (!text.endsWith('\n') || previousEmptyBlock)) text += '\n';
      text += child.textContent ?? '';
      previousBlock = false;
      previousEmptyBlock = false;
      continue;
    }
    if (!(child instanceof Element)) continue;
    if (child.tagName === 'BR') {
      if (!child.hasAttribute('data-sql-workbench-placeholder')) text += '\n';
      previousBlock = false;
      previousEmptyBlock = false;
      continue;
    }
    const block = blocks.test(child.tagName);
    if ((block || previousBlock) && (text || previousBlock) && (!text.endsWith('\n') || previousEmptyBlock)) text += '\n';
    const placeholder = block && child.childNodes.length === 1 && child.firstChild?.nodeName === 'BR';
    const content = placeholder ? '' : getEditorText(child);
    text += content;
    previousBlock = block;
    previousEmptyBlock = block && !content;
  }
  return text;
}
