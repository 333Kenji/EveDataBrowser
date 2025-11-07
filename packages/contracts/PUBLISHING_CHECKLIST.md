# @evedatabrowser/contracts Publishing Checklist

This checklist captures the steps required to publish an updated `@evedatabrowser/contracts` package whenever schema or contract work resumes. Run these steps from the repository root unless noted otherwise.

1. **Verify working tree is clean**  
   Ensure all schema changes are committed and `git status` shows no pending edits.

2. **Regenerate domain artefacts**  
   ```bash
   docker compose exec api npm --prefix packages/contracts run generate
   ```
   Confirm that `packages/contracts/src/generated/` only contains expected changes.

3. **Build the package**  
   ```bash
   docker compose exec api npm --prefix packages/contracts run build
   ```
   This runs the TypeScript compiler and refreshes `dist/` output.

4. **Run the contract test suite**  
   ```bash
   docker compose exec api npm --prefix packages/contracts test
   ```
   The `prepublishOnly` hook will re-run this guard, but performing it explicitly catches issues earlier.

5. **Update version metadata**  
   - Adjust `packages/contracts/package.json#version` according to semver.
   - Regenerate or edit `CHANGELOG.md` (if present) to describe the release.

6. **Smoke check the consumers**  
   - Run `docker compose exec api npm run typecheck` to ensure the API compiles against the regenerated contracts.
   - Execute the relevant Vitest suites (`npm run test -- app/api/tests/endpoints.test.ts`) if API surface changed.

7. **Publish**  
   Once dependencies are green and the release notes are staged, publish from the package directory:
   ```bash
   cd packages/contracts
   npm publish --access public
   ```
   (Drop `--access public` if the package remains private.)

8. **Tag and document**  
   - Push the release commit and create a git tag `contracts-v<version>`.
   - Announce the release in the deployment notes, referencing the schema hash included in `persistence/manifests/schema-manifest.json`.

> **Tip:** The new `prepublishOnly` script (`npm run prepublishOnly`) will regenerate contracts and run tests automatically during `npm publish`, acting as a final safeguard.
