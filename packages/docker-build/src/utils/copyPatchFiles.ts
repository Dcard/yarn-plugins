import { Report, Workspace } from '@yarnpkg/core';
import { PortablePath, ppath, xfs } from '@yarnpkg/fslib';
import { patchUtils } from '@yarnpkg/plugin-patch';

// https://github.com/yarnpkg/berry/blob/d38d573/packages/plugin-patch/sources/patchUtils.ts#L10
const BUILTIN_REGEXP = /^builtin<([^>]+)>$/;

export default async function copyPatchFiles({
  destination,
  workspaces,
  report,
}: {
  destination: PortablePath;
  workspaces: Workspace[];
  report: Report;
}): Promise<void> {
  const copiedPaths = new Set<string>();

  for (const ws of workspaces) {
    for (const descriptor of ws.dependencies.values()) {
      if (!descriptor.range.startsWith('patch:')) continue;

      const { parentLocator, patchPaths } = patchUtils.parseDescriptor(
        descriptor,
      );

      for (const path of patchPaths) {
        // Ignore builtin modules
        if (BUILTIN_REGEXP.test(path)) continue;

        // TODO: Handle absolute path
        if (ppath.isAbsolute(path)) continue;

        if (!parentLocator) continue;

        // Get the workspace by parentLocator
        const parentWorkspace = ws.project.getWorkspaceByLocator(parentLocator);

        // The path relative to the project CWD
        const relativePath = ppath.join(parentWorkspace.relativeCwd, path);

        // Skip if the path has been copied already
        if (copiedPaths.has(relativePath)) continue;

        copiedPaths.add(relativePath);

        const src = ppath.join(parentWorkspace.cwd, path);
        const dest = ppath.join(destination, relativePath);

        report.reportInfo(null, relativePath);
        await xfs.mkdirpPromise(ppath.dirname(dest));
        await xfs.copyFilePromise(src, dest);
      }
    }
  }
}
