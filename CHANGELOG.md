# Changelog

All notable changes to `@hytime/dsh-client-ui-shortcuts` are documented here.

## 0.1.4 - Interaction card and shortcut list fixes

### Fixed

- Fixed question and approval interaction cards to stay in the DSH conversation composer with bounded scrolling and visible action rows.
- Fixed question skip labels and skip submission for click and keyboard activation.
- Added semantic approval warning styling and responsive card geometry.

### Changed

- Restyled question and approval shortcut summaries as grouped DSH-style lists.


### Fixed

- Fixed the shortcuts composer priority ordering so it is tried before the official DSH question and approval composers.
- Added a slot-wiring regression for the lower-first DSH chain election order.

## 0.1.2 - Composer priority metadata

### Fixed

- Added explicit composer priority metadata and a slot-wiring regression while aligning the takeover with DSH chain routing.

## 0.1.1 - UI interaction fixes

### Fixed

- Fixed question option controls rendering with DSH token-based card styling instead of unstyled native controls.
- Fixed initial question focus and roving `tabIndex` navigation for Arrow/Enter keyboard selection.
- Added a collapsible settings card matching the DSH plugin-card disclosure pattern.
- Preserved session-scoped cancellation while refreshing the active conversation lookup at cancel time.

## 0.1.0 - Initial release

### Added

- Added the independent DSH Client UI shortcuts plugin for Web question and approval interactions.
- Added the `standard` and `vim` profiles with one active profile at a time.
- Added Arrow-key, `j`/`k`, Enter, and Escape handling for question and approval surfaces.
- Added single-select, multi-select, custom-answer, skip, submit, allow-once, reject, and session-scoped cancel flows.
- Added the `dsh-ui-shortcuts` Host settings namespace with the persisted `activeProfile` field.
- Added the `dsh-shortcuts` locale namespace and a profile settings card.
- Added CSS Modules, semantic DSH design tokens, local offline Iconify icons, and responsive reduced-motion styling.

### Package and integration

- Added the DSH bundle patch with row id `dsh-ui-shortcuts`.
- Added the lazy-CJS browser artifact at `lib/client.js` and the Node/invariant artifacts.
- Added package purity checks that reject non-platform DSH runtime imports from the browser bundle.
- Added profile, composer, slot lifecycle, settings, bundle, tarball, and DSH composition verification.
- Added bilingual package and installation documentation.
