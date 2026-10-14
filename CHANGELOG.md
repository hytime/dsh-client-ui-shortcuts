## 0.2.1 - Checkout-independent build artifacts

### Fixed

- **Build artifacts no longer depend on the checkout's absolute path**: with `0.2.0`, the same sources produced different bundle bytes depending on the build directory. The CSS Module class-name hash came from lightningcss's resolved absolute path, and CSS virtual module ids were emitted into `//#region` comments that carried the absolute path too. A CI build under `/home/runner/work/...` and a local clone under e.g. `/Volumes/...` therefore hashed differently, which made a hash useless as proof that the two artifacts were the same. `projectRoot` now anchors the class-name hash at the package root and virtual module ids use package-relative paths, so no absolute path reaches the artifact.

Behavior is identical to `0.2.0`; this release only fixes build reproducibility.

## 0.2.0 - Official shortcut integration (breaking)

### Added

- **Official shortcut manager**: the panel lists **every command** in DSH's official catalog with per-command record / restore-default / clear, all read and written through the official `describeBinding()` and `edit()`. The panel and DSH's own keyboard settings are one configuration, so a change on either side appears on the other immediately.
- **Shortcut search**: the field above the list filters by command name, command id, or keycap; it only affects what is shown.
- **Complete configuration import/export** at the top of the panel. The export is a **complete shortcut snapshot** (`version: 2`): every command in the official catalog is written, including untouched defaults, not only the customized ones, each with a `modified` flag that tells an import whether to write an override, restore the official default, or leave the command alone — so a default is never pinned as a new override. Export normalizes the logical `primary` modifier to the device's real `meta`/`control` through the official service, so importing an export and exporting again is byte-identical. `label`/`keys` are display-only and ignored on import.
- Import is still strictly validated first (`format`, `version`, exact field sets, command ids, physical codes and modifiers; unknown fields, wrong types, and future versions refused wholesale, capped at 1 MiB and 1024 commands) and then writes each entry through the official service. **A refused or conflicting official edit never writes the plugin switches.** Version 1 files remain importable.
- Import and export failures are reported individually: invalid file, newer version, too large, unreadable, officially unsupported, official conflict, and write failure.

### Fixed

- **Approvals no longer approve by mistake**: with focus on Reject, Enter (including after Tab navigation) now activates the actually focused action instead of reusing the earlier "allow once".
- **Enhancement cards no longer steal foreground focus**: a background Question/Approval no longer moves focus out of an open official dialog, and advancing to a shorter question keeps a Tab entry instead of losing the whole card.
- **Complete-snapshot import restores correctly**: the import is planned against the whole target snapshot, releasing keys the file moves or clears before writing target values. This fixes restoring two swapped bindings, a `modified:false` default being pinned as a new override, and a premature conflict when one command hands its key to another. Both switches commit in one atomic write. The official `edit()` has no batch transaction, so a mid-import failure is rolled back on a best-effort basis and unrestored commands are listed instead of reporting success.
- **Recording lifecycle is fully released**: leaving the settings card releases official `recording(false)` so desktop keeps honoring the user's own shortcuts; a delayed native acknowledgement no longer re-arms a closed panel; AltGraph, dead keys, and IME compositions are ignored instead of persisted as unreproducible bindings.
- **Newer question carriers are handled**: a settled call's read-only review card stays with the official presentation, and a limited-time question calls the carrier's `holdFocus/engage/releaseFocus` so editing is not timed out. Older baselines without those methods are skipped automatically.
- **Reproducible builds**: `lightningcss` does not guarantee CSS Module export order, so identical sources produced a differently ordered class-name map on each build and the bundle hash changed, which made a hash useless as evidence that the running code matches the checkout. Exports are now sorted by local name; three consecutive builds produce the same hash.
- Exporting used to fail entirely when a stored binding the official service cannot describe was present; that entry is now skipped and the export continues.
- Each enhancement switch now shares its title's line, with the description on its own line below (previously the description and switch crowded one line).

### Changed

- **DSH now owns keybindings**: the plugin registers one official editable command, `hytime.shortcuts.open`, to open its quick panel, and no longer keeps its own key store, profiles, or conflict checking.
- **The plugin UI can still edit the key**: the panel drives the official `describeBinding()`, `edit()`, and `recording()` APIs for capture, validation, and persistence, so the binding is the same official configuration shown in DSH settings.
- **Question / approval enhancements default to off**: both switches default to `false` and contribute no composer takeover until enabled; enabling never grants approval automatically.
- **Removed legacy compatibility**: `settingsScope` and the legacy Connection settings API, the dual `settings.plugin.item` / `plugins.bundle.config` seat probe, the legacy sessions-summary and question/approval payload adapters, and the plugin-owned profile and keybinding editor (about 30 source files plus their tests).
- Plugin configuration now uses the current `Config` projection (two booleans).

### Fixed

- In the enhanced approval card, moving focus to "Reject" with an arrow key and pressing `Enter` used to submit the earlier "Allow once" selection. `Enter` now always activates the focused action.

### Compatibility

- Plugin version `0.2.0`; the verified baseline is DSH `0.2.0-rc.1`. `peerDependencies` is widened to `>=0.2.0-rc.1 <1.0.0`, accepting the baseline and newer releases (including `0.2.0-rc.2`, `0.2.0`, and `0.3.0-*` prereleases) while refusing older generations and `1.0.0`+. `devDependencies` stays pinned to `0.2.0-rc.1` as the compile and type baseline.
- The new version does not support older DSH releases and no longer reads `0.1.x` profile settings; users on older releases should stay on `0.1.23`.

## 0.1.23 - DSH 0.1.7 settings service compatibility
