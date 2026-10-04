// @vitest-environment jsdom
// CommentText's links in the Tauri apps (sortable-list-links-own-dispatch).
//
// These URLs are written by whoever wrote the comment, so they arrive in shapes
// the app never builds itself. Before this change the opener plugin's window
// listener sent `new URL(anchor.href)`, the anchor's RESOLVED href; the link's
// own handler must send exactly that string, not the raw text, or a user URL
// would open differently than it did. The gate rows (modifier keys, other
// buttons, a cancelled click, web and Pi) are OutboundLink.test.tsx's.
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { CommentText } from './CommentText'
import { installTauriOpener } from '../test/tauriOpener'

afterEach(cleanup)

describe('CommentText links own their dispatch', () => {
  it('Tauri: each link sends the anchor\'s resolved href, the string the listener sent, for user-written URL shapes', () => {
    const opener = installTauriOpener()
    try {
      render(
        <CommentText
          decoded
          raw={'See https://Example.COM/Path, https://bücher.example/straße?q=ü and https://x.test\\a/b{c}.'}
        />,
      )
      const links = screen.getAllByRole<HTMLAnchorElement>('link')
      // A mixed-case host, a non-ASCII host, path and query, a backslash and
      // braces: in every one the resolved href differs from the text written.
      expect(links.map(a => a.getAttribute('href'))).toEqual([
        'https://Example.COM/Path',
        'https://bücher.example/straße?q=ü',
        'https://x.test\\a/b{c}',
      ])
      expect(links.map(a => a.href)).toEqual([
        'https://example.com/Path',
        'https://xn--bcher-kva.example/stra%C3%9Fe?q=%C3%BC',
        'https://x.test/a/b%7Bc%7D',
      ])
      for (const link of links) expect(fireEvent.click(link)).toBe(false)
      expect(opener.calls()).toEqual(links.map(a => ({ url: a.href, via: 'own' })))
    } finally {
      opener.uninstall()
    }
  })
})
