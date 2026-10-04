// @vitest-environment jsdom
// The Weather tab's two hand-written new-tab links (sortable-list-links-own-dispatch).
// They were lifted out of App.tsx so a click can be tested without rendering the
// whole app; App.tsx renders these components in place of the inline anchors.
//
// In the Tauri apps a click must send the link's own URL to the opener and cancel
// itself, so the plugin's listener (replicated by installTauriOpener) opens
// nothing more. The gate rows (modifier keys, other buttons, a cancelled click,
// web and Pi) are OutboundLink.test.tsx's; all of these call the same handler.
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EditCommentLink, SnowRavenMiniLink } from './WeatherTabLinks'
import { installTauriOpener, type TauriOpener } from '../test/tauriOpener'

let opener: TauriOpener | null = null
afterEach(() => {
  opener?.uninstall()
  opener = null
  cleanup()
})

describe('the Weather tab links own their dispatch', () => {
  it('Tauri: Edit checklist comment sends this checklist\'s edit page once and cancels the click', () => {
    opener = installTauriOpener()
    render(<EditCommentLink checklistId="S123456" />)
    const link = screen.getByRole('link', { name: 'Edit checklist comment on eBird (opens in a new tab)' })
    expect(link.getAttribute('href')).toBe('https://ebird.org/edit/effort?subID=S123456')
    expect(fireEvent.click(link)).toBe(false)
    expect(opener.calls()).toEqual([{ url: 'https://ebird.org/edit/effort?subID=S123456', via: 'own' }])
  })

  it('renders nothing for a malformed checklist id, never a link built from it', () => {
    const { container } = render(<EditCommentLink checklistId="S1@evil.com" />)
    expect(container.innerHTML).toBe('')
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('Tauri: SnowRaven Mini sends its repository page once and cancels the click', () => {
    opener = installTauriOpener()
    render(<SnowRavenMiniLink />)
    const link = screen.getByRole('link', { name: 'SnowRaven Mini on GitHub (opens in a new tab)' })
    expect(link.getAttribute('href')).toBe('https://github.com/dtgibson/snowraven-mini')
    expect(fireEvent.click(link)).toBe(false)
    expect(opener.calls()).toEqual([{ url: 'https://github.com/dtgibson/snowraven-mini', via: 'own' }])
  })
})
