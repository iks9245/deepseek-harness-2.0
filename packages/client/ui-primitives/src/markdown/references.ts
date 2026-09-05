/** HTTP references parsed as Markdown links, excluding literal code and unused definitions. */
import type { Nodes } from 'mdast'
import { parseGfm } from './parse.ts'

/** A rendered link's label and HTTP destination; it does not certify the linked content. */
export interface MarkdownReference {
  readonly label: string
  readonly url: string
}

function label(node: Nodes): string {
  if ('value' in node) return node.value
  if ('alt' in node) return node.alt ?? ''
  return 'children' in node ? node.children.map(label).join('') : ''
}

/**
 * Collect inline, autolink, and reference-style HTTP links in source order.
 * @param text - Complete settled Markdown, including any reference definitions.
 * @returns one reference per destination, retaining its first label; code, images, and non-HTTP links are excluded.
 */
export function extractMarkdownReferences(text: string): readonly MarkdownReference[] {
  const root = parseGfm(text)
  const definitions = new Map<string, string>()
  const collect = (node: Nodes): void => {
    if (node.type === 'definition' && !definitions.has(node.identifier.toUpperCase())) {
      definitions.set(node.identifier.toUpperCase(), node.url)
    }
    if ('children' in node) node.children.forEach(collect)
  }
  collect(root)
  const references = new Map<string, MarkdownReference>()
  const visit = (node: Nodes): void => {
    const url = node.type === 'link' ? node.url
      : node.type === 'linkReference' ? definitions.get(node.identifier.toUpperCase()) : undefined
    if (url !== undefined && /^https?:\/\//i.test(url) && !references.has(url)) {
      references.set(url, { label: label(node) || url, url })
    }
    if ('children' in node) node.children.forEach(visit)
  }
  visit(root)
  return [...references.values()]
}
