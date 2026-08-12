# Fix sidebar button hover readability

## Problem
The sidebar buttons (New List, Import, Settings) use `variant="ghost"`. The ghost variant applies `hover:text-accent-foreground`, and in dark mode `--accent-foreground` is `215 25% 12%` (very dark). So on hover the button text turns dark and becomes hard to read against the dark sidebar.

The buttons also currently hover to `bg-sidebar-accent` (a dark blue), not the orange accent used elsewhere.

## Fix
In `src/components/Sidebar.tsx`, update the three ghost `Button` instances (New List, Import, Settings) so their `className`:
- Keeps text as `text-sidebar-foreground` on hover by overriding the ghost variant's `hover:text-accent-foreground` with `hover:text-sidebar-foreground`.
- Changes the hover background to the orange accent: `hover:bg-accent` (the `--accent: 38 95% 62%` orange token, matching the orange used for `--sidebar-primary` / `--ring`).

Example className change:
```
className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-accent hover:text-sidebar-foreground"
```

This keeps the text light on hover (sidebar-foreground) and swaps the hover fill to the orange accent. No changes to `button.tsx` or the theme tokens — the override is scoped to these sidebar buttons only.

## Verification
- Open the preview in dark mode, hover each sidebar button: text stays light/readable and the background highlights orange.
- Confirm light mode also looks correct (orange bg, dark text via sidebar-foreground).
