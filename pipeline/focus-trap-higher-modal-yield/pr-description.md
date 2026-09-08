## Focus Trap Higher-Modal Yield

### What this does

Orders active shared focus traps by activation and makes lower contained traps yield when focus belongs to a trap opened above them. The yield applies to both `focusin` and Tab, registers before opening autofocus, and disappears immediately when the higher trap closes; Welcome can therefore enable full containment without breaking HelpDocs or Cmd-K.

### How to test

1. Run `npx vitest run src/lib/useFocusTrap.test.tsx src/components/WelcomeScreen.test.tsx` from `frontend`.
2. Confirm a higher trap keeps initial focus, owns its own Tab wrap, and wins even when its passive autofocus is declared before its `useFocusTrap` call.
3. Close the higher trap and confirm the lower trap immediately resumes containment.
4. Run the expanded focus family covering embedded fullscreen, Calendar, Map Explorer's sidebar, HelpDocs, CommandPalette, entry-chunk safety, and the tab-order guard.

### Notes for reviewer

Activation order is intentional. DOM order cannot express the stack because CommandPalette renders before WelcomeScreen, while z-index cannot express it reliably because HelpDocs and Welcome share a value and depend on later paint order. The registry is module-local, contains only active hook entries, and keeps `useFocusTrap.ts` React-only on the entry graph.
