# Installing DSH Client UI Shortcuts

This guide installs `@hytime/dsh-client-ui-shortcuts` into a DSH Web profile. The plugin is loaded by the DSH Web composition; it is not a standalone browser application.

## Prerequisites

- A DSH installation or source checkout with the Web profile available.
- Node.js and the package-manager version required by that DSH installation.
- The package's DSH peer packages available from the installation or profile.

The package itself declares pnpm `11.21.0` for local development. This is separate from the package-manager version required by the DSH installation. Check the target DSH checkout before running its commands:

```bash
node -e "console.log(JSON.parse(require('node:fs').readFileSync('/path/to/deepseek-harness/package.json', 'utf8')).packageManager)"
```

Use the version declared by the target DSH checkout, not the package's development version.

For a source checkout at `/Volumes/hydisk/deepseek-harness`, the commands below use `pnpm --dir`. Replace that path with the root of your DSH installation.

## Install a published package

Use the DSH plugin command with the Web profile:

```bash
dsh plugin --profile web add @hytime/dsh-client-ui-shortcuts@0.1.0
```

The command forwards the package installation to the profile and reconciles packages that declare `dsh.bundle.patch` into `dsh.profile.bundles`.

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

pnpm --dir /Volumes/hydisk/deepseek-harness \\
  dsh plugin --profile web add \\
  /tmp/dsh-client-ui-shortcuts-pack/hytime-dsh-client-ui-shortcuts-0.1.0.tgz
```

Use a persistent `DSH_HOME` instead of `mktemp -d` when the profile should survive the shell session. The package tarball must contain `lib/client.js`, `lib/index.js`, `lib/invariant.js`, type declarations, and `cordis.patch.yml`.

## Verify the profile

Dump the composed profile without starting the Web server:

```bash
pnpm --dir /Volumes/hydisk/deepseek-harness \\
  dsh --profile web --dump-config
```

The output should contain the installed package and its canonical row:

```yaml
# == @hytime/dsh-client-ui-shortcuts
- id: dsh-ui-shortcuts
  name: '@hytime/dsh-client-ui-shortcuts'
```

The profile manifest should also list the package in both `dependencies` and `dsh.profile.bundles`. `--dump-config` verifies Host-side composition and patch resolution; it does not start the browser, load `window.__DSH_BOOT__`, or prove Client slot activation.

## Start DSH Web

After the profile is installed, start the Web surface through DSH:

```bash
pnpm --dir /Volumes/hydisk/deepseek-harness \\
  dsh --profile web
```

The shortcuts settings card is available under the composed settings plugin surface. The persisted settings namespace is `dsh-ui-shortcuts`, with `activeProfile` set to `standard` or `vim`.

Do not open `apps/web` directly. The Web entry needs DSH boot injection and the Client module table that the real DSH composition provides.

## DSH source-checkout package-manager versions

When a source checkout rejects the ambient pnpm version, use the version declared by that checkout in an isolated Corepack directory. For example, when the checkout requires pnpm `11.7.0`:

```bash
export COREPACK_HOME=/tmp/dsh-corepack

COREPACK_HOME="$COREPACK_HOME" \\
  corepack pnpm@11.7.0 --dir /Volumes/hydisk/deepseek-harness \\
  dsh plugin --profile web add \\
  /tmp/dsh-client-ui-shortcuts-pack/hytime-dsh-client-ui-shortcuts-0.1.0.tgz

COREPACK_HOME="$COREPACK_HOME" \\
  corepack pnpm@11.7.0 --dir /Volumes/hydisk/deepseek-harness \\
  dsh --profile web --dump-config
```

Use the version required by the target DSH checkout rather than copying this example unchanged.

## Upgrade or remove

The DSH `plugin` command forwards the remaining arguments to the profile's package manager. The following is therefore the profile equivalent of `pnpm update @hytime/dsh-client-ui-shortcuts`:

```bash
dsh plugin --profile web update @hytime/dsh-client-ui-shortcuts
```

Remove it with the corresponding forwarded package-manager operation:

```bash
dsh plugin --profile web remove @hytime/dsh-client-ui-shortcuts
```

The DSH profile reconciles the bundle list after the package operation. Removing the package removes its `dsh-ui-shortcuts` bundle layer; it does not modify DSH core.

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

- **`lib/client.js` is missing:** run `pnpm run bundle` before packing.
- **The bundle row is absent:** check that the tarball contains `cordis.patch.yml` and that the profile manifest lists `@hytime/dsh-client-ui-shortcuts`.
- **The browser entry does not activate:** use a DSH Web profile, not the Vite entry by itself, and confirm that the peer packages match the DSH installation.
- **pnpm version errors:** run the DSH command with the package-manager version declared by the target DSH checkout.
- **The settings card is absent:** confirm that the Host profile exposes `dsh-ui-shortcuts` and that the Web composition includes the settings plugins surface.
