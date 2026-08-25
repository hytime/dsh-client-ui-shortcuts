# Installing DSH Client UI Shortcuts

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
dsh plugin --profile web add @hytime/dsh-client-ui-shortcuts@0.1.14
```

The command forwards the package installation to the profile and reconciles packages that declare `dsh.bundle.patch` into `dsh.profile.bundles`.

## Install pinned GitHub source

Use a release tag or full commit SHA when installing source. Do not install the moving default branch:

```bash
dsh plugin --profile web add github:hytime/dsh-client-ui-shortcuts#v0.1.14
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
  /tmp/dsh-client-ui-shortcuts-pack/hytime-dsh-client-ui-shortcuts-0.1.14.tgz
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

The shortcuts settings card is available under the composed settings plugin surface. The persisted settings namespace is `dsh-ui-shortcuts`, with `activeProfile` and `customProfiles` fields. The built-in `standard` and `vim` profiles are read-only; `customProfiles` stores the named editable profiles.

## Manage named Custom profiles

The settings card can create, import, export, and delete multiple named Custom profiles. New creates a profile with the current profile's bindings. Import accepts one profile per file and always allocates a new internal ID; importing the same name repeatedly appends continuing numeric suffixes such as `Name 1`, `Name 2`, and then `Name 3`. Delete requires confirmation, and deleting the active Custom profile first selects Standard.

Custom profile files use the strict single-profile JSON v1 envelope below:

```json
{
  "format": "dsh-client-ui-shortcuts/custom-profile",
  "version": 1,
  "profile": {
    "name": "Review",
    "bindings": [
      {
        "command": "focusNext",
        "scope": "question",
        "key": {
          "key": "j",
          "modifiers": []
        }
      }
    ]
  }
}
```

Each import file must be at most 1 MiB. The envelope contains exactly `format`, `version`, and `profile`; the profile contains exactly `name` and `bindings`. It deliberately contains no internal profile ID, so importing never replaces or updates an existing profile.

Export is available only for the active Custom profile after its name and bindings have been saved. It writes the current authoritative saved snapshot, not unsaved editor changes, as one JSON v1 profile. Standard and Vim cannot be exported or edited.

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

For browser activation, start `dsh --profile web` and inspect the actual DSH Web page. Confirm that the settings card appears and that question/approval shortcuts work in that page. The package's automated smoke uses the DSH `loadProfile` and `composeEntries` source path when the target checkout provides its `tsx` runner; that smoke validates package/profile resolution, not browser activation.

## Troubleshooting

- **A pinned Git source build is blocked:** copy the exact package key from the DSH or pnpm error into the profile's `allowBuilds`, then rerun the same pinned install command.
- **`lib/client.js` is missing:** run `pnpm run bundle` before packing.
- **The bundle row is absent:** check that the tarball contains `cordis.patch.yml` and that the profile manifest lists `@hytime/dsh-client-ui-shortcuts`.
- **The browser entry does not activate:** use a DSH Web profile, not the Vite entry by itself, and confirm that the peer packages match the DSH installation.
- **DSH CLI or profile errors:** use the `dsh` executable from the target DSH installation and do not manage the profile with a direct package-manager command.
- **The settings card is absent:** confirm that the Host profile exposes `dsh-ui-shortcuts` and that the Web composition includes the settings plugins surface.
