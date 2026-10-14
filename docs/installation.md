# Installing DSH Client UI Shortcuts

English | [中文](installation.zh.md)

This guide installs `@hytime/dsh-client-ui-shortcuts` into a DSH Web profile. The plugin is loaded by the DSH Web composition; it is not a standalone browser application.

## Prerequisites

- A DSH installation or source checkout with the Web profile available.
- Node.js and the package-manager version required by that DSH installation.
- The package's DSH peer packages available from the installation or profile.

The DSH CLI owns profile installation, upgrade, and removal. The package's pnpm declaration applies only when developing or packing this source checkout; it is not an installation command for a DSH profile. Do not invoke `npm install`, `pnpm add`, or edit a profile manifest or lockfile directly. These package-manager commands and direct lockfile edits belong only to the development or packing context, not the consumer installation flow.

## Install the published npm package

The npm release is the recommended installation path. It already contains the built `lib/` entries, so installation does not need to execute a package build.

Use the DSH plugin command with the Web profile:

```bash
dsh plugin --profile web add @hytime/dsh-client-ui-shortcuts@0.2.0
```

The command forwards the package installation to the profile and reconciles packages that declare `dsh.bundle.patch` into `dsh.profile.bundles`. This package supports DSH `0.1.6-alpha.2` and later; earlier generations are no longer supported — see "DSH version support boundary" below.

## Install pinned GitHub source

Use a release tag or full commit SHA when installing source. Do not install the moving default branch:

```bash
dsh plugin --profile web add github:hytime/dsh-client-ui-shortcuts#v0.2.0
```

A Git dependency contains source rather than committed `lib/` output. During package installation on your machine, pnpm runs `prepare`, which calls `pnpm run bundle` and generates the published entries. This is install-time code execution outside any Agent sandbox.

pnpm may initially refuse to run that build. Follow the DSH or pnpm error and add the exact package key it reports to the Web profile's `pnpm-workspace.yaml`; for this package the entry is expected to be:

```yaml
allowBuilds:
  '@hytime/dsh-client-ui-shortcuts': true
```

Then rerun the same pinned `dsh plugin` command. Only grant build permission to source you trust, and retain the release tag or commit suffix so later changes to the default branch cannot alter the installed code.

## Install a local tarball

Build and pack the plugin from its source checkout:

```bash
cd /Volumes/hydisk/vsProject/dsh-claude-shortcuts
pnpm install
pnpm run bundle
pnpm pack --pack-destination /tmp/dsh-client-ui-shortcuts-pack
```

Then install the generated tarball into the DSH Web profile:

```bash
export DSH_HOME="$(mktemp -d)"

dsh plugin --profile web add \\
  /tmp/dsh-client-ui-shortcuts-pack/hytime-dsh-client-ui-shortcuts-0.2.0.tgz
```

Use a persistent `DSH_HOME` instead of `mktemp -d` when the profile should survive the shell session. The package tarball must contain `lib/client.js`, `lib/index.js`, `lib/invariant.js`, type declarations, and `cordis.patch.yml`.

## Verify the profile

Dump the composed profile without starting the Web server:

```bash
dsh --profile web --dump-config
```

The output should contain the installed package and its canonical row:

```yaml
# == @hytime/dsh-client-ui-shortcuts
- id: dsh-ui-shortcuts
  name: '@hytime/dsh-client-ui-shortcuts'
```

The profile manifest should also list the package in both `dependencies` and `dsh.profile.bundles`. `--dump-config` verifies only the Host composition and patch resolution; it does not start the browser, load `window.__DSH_BOOT__`, or prove Client slot activation. After installing, reload the DSH Web composition or refresh the already running Web page before checking the Client UI; installing a package does not update an already loaded page.

## Start DSH Web

After the profile is installed, start the Web surface through DSH:

```bash
dsh --profile web
```

After startup, press the default binding (macOS `⌘⌥⇧S`, Windows `Ctrl+Alt+Shift+S`; Linux Web has no default) to open the plugin quick panel, or click the "open quick panel" entry on the plugin settings page. The panel shows the summon binding, configuration import/export, a shortcut search field, a list of **every official shortcut** with per-command record / restore-default / clear, and two enhancement switches that default to off. DSH owns the bindings and persists them in `dsh.keybindings.v1`; the plugin's own settings store only `questionEnabled` and `approvalEnabled`. Export writes a complete snapshot of all shortcuts, including untouched defaults, which Import restores on another device or profile.

## DSH version support boundary

Plugin `0.2.0` has DSH **`0.2.0-rc.1`** as its verified baseline. Every `@deepseek-ai/dsh-*` peer is declared as `>=0.2.0-rc.1 <1.0.0`, so the baseline and newer releases below `1.0.0` are accepted, while older generations and `1.0.0`+ are refused. `devDependencies` remain pinned to `0.2.0-rc.1` as the compile and type baseline.

At startup DSH validates those peers through `evaluatePluginCompatibility`, and prereleases participate in the range check. A mismatch reports the exact peer and the exact-version exemption path (`dsh plugin allow-version` or the plugin manager). **Grant that exemption for a specific plugin+DSH pair only after you understand the crash and data-loss risk.**

The new version does not support older DSH releases and does not read `0.1.x` profile settings:

- no `settingsScope` and no legacy Connection settings API;
- no `settings.plugin.item` seat probe;
- no legacy sessions-summary or question/approval payload adapters;
- no plugin-owned profiles, key store, or conflict checking.

Users on older releases should stay on `0.1.23`. Upgrading to `0.2.0` is a behavior change; read the [integration notes (Chinese)](official-shortcuts-integration.zh.md).

## Shortcuts and the panel

The plugin registers exactly one editable official command, "Open quick panel":

| Platform | Default |
| --- | --- |
| Web / macOS | `⌘⌥⇧S` |
| Web / Windows | `Ctrl+Alt+Shift+S` |
| Web / Linux | No default (the official allowed set is narrower there) |

Change it in **DSH Settings → General → Keyboard shortcuts** or in the plugin quick panel; both read and write the same official configuration. The panel also offers restore-default and clear, plus two enhancements that default to **off**. Enabling the enhanced approval card never grants approval automatically.

Do not open `apps/web` directly. The Web entry needs DSH boot injection and the Client module table that the real DSH composition provides.

## DSH CLI

Use the `dsh` executable provided by the target DSH installation. The CLI selects the profile, performs package reconciliation, updates the bundle list, and starts the composition. Do not bypass it with a package-manager command in the profile directory.

## Upgrade or remove

Upgrade it with the DSH plugin command:

```bash
dsh plugin --profile web update @hytime/dsh-client-ui-shortcuts
```

Remove it with the DSH plugin command:

```bash
dsh plugin --profile web remove @hytime/dsh-client-ui-shortcuts
```

The DSH profile reconciles the bundle list after the package operation. Reload the Web composition or refresh the page after installing, upgrading, or removing the package so the running Web surface picks up the new composition. Removing the package removes its `dsh-ui-shortcuts` bundle layer; it does not modify DSH core.

## Local validation

From the plugin checkout:

```bash
CI=true pnpm run typecheck
CI=true pnpm exec vitest run tests
CI=true pnpm run bundle
pnpm pack --pack-destination /tmp/dsh-client-ui-shortcuts-pack
```

For a Host-side profile composition check, run `dsh plugin --profile web add <tarball>` followed by `dsh --profile web --dump-config` with a temporary `DSH_HOME`. These commands verify installation, dependency reconciliation, and the composed Host patch; `--dump-config` does not activate the browser Client.

For browser activation, start `dsh --profile web` and inspect the actual DSH Web page. Confirm that an "open quick panel" entry appears on the plugin settings page and opens the panel, that **DSH Settings → General → Keyboard shortcuts** lists "Open quick panel" with the documented default, that a rebind made in the plugin panel shows up in official settings (one shared configuration), that both enhancement switches default to off, and that the console shows no plugin error. The package's automated smoke uses the DSH `loadProfile` and `composeEntries` source path when the target checkout provides its `tsx` runner; that smoke validates package/profile resolution, not browser activation.

## Troubleshooting

- **A pinned Git source build is blocked:** copy the exact package key from the DSH or pnpm error into the profile's `allowBuilds`, then rerun the same pinned install command.
- **`lib/client.js` is missing:** run `pnpm run bundle` before packing.
- **The bundle row is absent:** check that the tarball contains `cordis.patch.yml` and that the profile manifest lists `@hytime/dsh-client-ui-shortcuts`.
- **The browser entry does not activate:** use a DSH Web profile, not the Vite entry by itself, and confirm that the peer packages match the DSH installation.
- **DSH CLI or profile errors:** use the `dsh` executable from the target DSH installation and do not manage the profile with a direct package-manager command.
- **The "open quick panel" entry is absent:** confirm that the Host profile exposes `dsh-ui-shortcuts` and that the Web composition includes the plugin manager and settings surfaces.
- **The shortcut does not work:** confirm the official shortcuts service is composed (`@deepseek-ai/dsh-client-shortcuts`); Linux Web has no default binding, so record one; if the command reports a conflict, pick another combination in official keyboard settings or in the plugin panel.
- **Installation or startup reports an incompatible plugin:** the running DSH version differs from `0.2.0-rc.1`. Move to a supported release, or grant the exact-version exemption for that pair after accepting the risk.
