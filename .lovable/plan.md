# Speed up drag & drop

Drag & drop uses the existing @dnd-kit library (no custom engine, no new dependency). The slowness is not the library — it's how the tree is rendered around it. Swapping libraries would be a big rewrite for no gain, so the fix is to optimise the current implementation.

## What's slow now

- `TreeItem`, `FolderRow` and `LinkRow` are declared *inside* the `WysiwygEditor` function body. Every render creates brand-new component types, so React throws away and rebuilds the whole tree — including every draggable/droppable registration — on each state change.
- `onDragOver` writes `activeDropId` to state on every pointer move, which triggers that full teardown/rebuild many times per second.
- Each row registers three droppables (before / inside / after), so a 100-item list means ~300 droppable nodes all re-measuring on each of those rebuilds.

## The fix

1. Move `TreeItem`, `FolderRow`, `LinkRow` and `RootDropZone` out to top-level components (same file), wrapped in `React.memo`, receiving callbacks via props or a small context.
2. Stabilise all handlers (`updateItemName`, `deleteItem`, `toggleCollapse`, `addFolder`, `addLink`, `sortFolder`, drag handlers) with `useCallback` and keep tree helpers as module-level pure functions.
3. Stop re-rendering the whole tree during hover: keep the active drop target in a ref/lightweight context so only the row under the cursor restyles, instead of setting state on the editor.
4. Reduce droppable count: keep one droppable per row and derive before/inside/after from the pointer position within that row's rect, so registrations drop by ~3x.
5. Add `measuring: { droppable: { strategy: MeasuringStrategy.WhileDragging } }` to `DndContext` and disable auto-scroll re-measure churn.

Visual behaviour (before/inside/after indicators, collapsed-folder drops, nesting rules, root drop zone) stays exactly as it is today.

## Verification

Run a Playwright drag scenario on a large list and confirm moves still land correctly, then confirm dragging feels smooth in the preview.
