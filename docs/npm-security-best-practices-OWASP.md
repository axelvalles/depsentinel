# NPM Security best practices

The following cheatsheet covers several npm security best practices and productivity tips, useful for JavaScript and Node.js developers. This list was originally based on the 10 npm security best practices from the Snyk blog.

## 1) Avoid publishing secrets to the npm registry

Whether you’re making use of API keys, passwords or other secrets, they can very easily end up leaking into source control or even a published package on the public npm registry. You may have secrets in your working directory in designated files such as a `.env` which should be added to a `.gitignore` to avoid committing it to a SCM, but what happens when you publish an npm package from the project’s directory?

The npm CLI packs up a project into a tar archive (tarball) in order to push it to the registry. The following criteria determine which files and directories are added to the tarball:

- If there is either a `.gitignore` or a `.npmignore` file, the contents of the file are used as an ignore pattern when preparing the package for publication.
- If both ignore files exist, everything not located in `.npmignore` is published to the registry. This condition is a common source of confusion and is a problem that can lead to leaking secrets.
- Developers may end up updating the `.gitignore` file, but forget to update `.npmignore` as well, which can lead to a potentially sensitive file not being pushed to source control, but still being included in the npm package.

Another good practice to adopt is making use of the `files` property in `package.json`, which works as an allowlist and specifies the array of files to be included in the package that is to be created and installed (while the ignore file functions as a denylist). The `files` property and an ignore file can both be used together to determine which files should explicitly be included, as well as excluded, from the package. When using both, the `files` property in `package.json` takes precedence over the ignore file.

When a package is published, the npm CLI will verbosely display the archive being created. To be extra careful, add a `--dry-run` command-line argument to your publish command in order to first review how the tarball is created without actually publishing it to the registry.

For details about revoking access token, see the official documentation: Revoking access tokens.

---

## 2) Enforce the lockfile

We embraced the birth of package lockfiles with open arms, which introduced: deterministic installations across different environments, and enforced dependency expectations across team collaboration. Life is good! Or so I thought… what would have happened had I slipped a change into the project’s `package.json` file but had forgotten to commit the lockfile alongside of it?

Both Yarn and npm act the same during dependency installation. When they detect an inconsistency between the project’s `package.json` and the lockfile, they compensate for such change based on the `package.json` manifest by installing different versions than those that were recorded in the lockfile.

This kind of situation can be hazardous for build and production environments as they could pull in unintended package versions and render the entire benefit of a lockfile futile.

Luckily, there is a way to tell both Yarn and npm to adhere to a specified set of dependencies and their versions by referencing them from the lockfile. Any inconsistency will abort the installation. The command-line should read as follows:

### Yarn

```bash
yarn install --frozen-lockfile
```

### npm

```bash
npm ci
```

---

## 3) Minimize attack surfaces by ignoring run-scripts

The npm CLI works with package run-scripts. If you’ve ever run `npm start` or `npm test` then you’ve used package run-scripts too. The npm CLI builds on scripts that a package can declare, and allows packages to define scripts to run at specific entry points during the package’s installation in a project.

For example, some of these script hook entries may be `postinstall` scripts that a package that is being installed will execute in order to perform housekeeping chores.

With this capability, bad actors may create or alter packages to perform malicious acts by running any arbitrary command when their package is installed.

A couple of cases where we’ve seen this already happening is the popular `eslint-scope` incident that harvested npm tokens, and the `crossenv` incident, along with 36 other packages that abused a typosquatting attack on the npm registry.

### Recommendations

- Always vet and perform due-diligence on third-party modules you install to confirm their health and credibility.
- Hold-off on upgrading immediately to new versions.
- Before upgrading, make sure to review changelog and release notes.
- Install packages using `--ignore-scripts`.

### Example

```bash
npm install --ignore-scripts
```

### `.npmrc`

```ini
ignore-scripts=true
```

### Allowlist example using LavaMoat

```json
{
  "lavamoat": {
    "allowScripts": {
      "sharp": true
    }
  }
}
```

---

## 4) Assess npm project health

### npm outdated

```bash
npm outdated
```

### npm doctor

```bash
npm doctor
```

Checks include:

- npm registry availability
- Git installation
- Node.js/npm versions
- permissions
- package cache integrity

---

## 5) Audit for vulnerabilities in open source dependencies

Many popular npm packages have been found vulnerable and may carry significant risk without proper auditing.

Examples:

- request
- superagent
- mongoose
- jsonwebtoken
- validator

### Recommendations

- Scan for vulnerabilities continuously
- Monitor manifests for new CVEs
- Integrate dependency tracking tools

---

## 6) Artifact governance and supply chain protections

### Use a local npm proxy

```bash
npm set registry https://my-registry.example.com
```

### Verdaccio

```bash
npm install --global verdaccio
```

Features:

- Private registry
- Proxy cache
- Authentication
- LDAP/GitLab support
- Great for CI/CD and monorepos

---

## Governance & Verification Steps

### Generate SBOM

```bash
npm install @cyclonedx/cyclonedx-npm
```

```bash
npx @cyclonedx/cyclonedx-npm --validate > sbom.json
```

### Sigstore Example

```js
import * as fs from 'fs';
import * as sigstore from 'sigstore';

const artifact = 'my-lib-1.0.0.tgz';

const payload = fs.readFileSync(artifact);

const bundle = await sigstore.sign(payload);

fs.writeFileSync(
  `${artifact}.sigstore.json`,
  JSON.stringify(bundle, null, 2)
);

await sigstore.verify(payload, bundle);
```

### Additional protections

- Immutable registries
- Rotate CI tokens
- Verify signatures in CI
- Validate SBOM
- Static analysis
- Monitoring and alerting

---

## 7) Responsibly disclose security vulnerabilities

When vulnerabilities are found:

- Follow responsible disclosure
- Coordinate with maintainers
- Allow time for patches
- Publish only after remediation

---

## 8) Enable 2FA

### Enable 2FA

```bash
npm profile enable-2fa auth-and-writes
```

Modes:

- `auth-only`
- `auth-and-writes`

Use apps like:

- Google Authenticator
- Authy

---

## 9) Use npm author tokens

### Create read-only token

```bash
npm token create --read-only --cidr=192.0.2.0/24
```

### Manage tokens

```bash
npm token list
```

```bash
npm token revoke
```

Recommendations:

- Rotate tokens
- Restrict permissions
- Limit IP ranges

---

## 10) Understanding typosquatting and slopsquatting attacks

### Typosquatting

Attackers publish packages with names similar to popular libraries.

Examples:

- `cross-env`
- `crossenv`

Risks:

- credential theft
- arbitrary code execution
- malicious payloads

---

### Slopsquatting

AI assistants may hallucinate fake package names.

Attackers publish malicious packages with those names.

Example:

AI suggests:

```txt
node-fetch-promise
```

Real package:

```txt
node-fetch
```

### Protection

```bash
npm view <package-name>
```

Verify:

- download counts
- GitHub repository
- contributors
- release history

---

## 11) Use trusted publishers for secure package publishing

Trusted publishing uses OpenID Connect (OIDC) instead of long-lived npm tokens.

Supported:

- GitHub Actions
- GitLab CI/CD

Benefits:

- short-lived credentials
- workflow-scoped authentication
- automatic provenance generation

---

## 12) Prevent dependency confusion attacks

A dependency confusion attack occurs when attackers publish public packages with the same name as private internal packages.

### Protection

Use scoped packages:

```txt
@yourorg/package-name
```

### `.npmrc`

```ini
@yourorg:registry=https://your-private-registry.example.com
```

Reserve internal names publicly when possible.

---

## 13) Verify documentation examples before copying into production

README examples are not always secure.

### Common insecure examples

- weak crypto
- unanchored regex
- `Math.random()`
- insecure redirects

### Recommendations

- Never copy blindly
- Review secure defaults
- Validate sensitive parameters
- Report insecure documentation

---

# Final Recommendations

- Verify packages before installing
- Prefer logged-out npm sessions
- Use `--ignore-scripts`
- Review package metadata

### Example

```bash
npm info package-name
```

### Safer installation

```bash
npm install my-package --ignore-scripts
```