import {
  Descriptor,
  Locator,
  Project,
  Report,
  structUtils,
} from '@yarnpkg/core';
import { PortablePath, ppath, xfs } from '@yarnpkg/fslib';

// https://github.com/yarnpkg/berry/blob/d38d573/packages/plugin-patch/sources/patchUtils.ts#L10
const BUILTIN_REGEXP = /^builtin<([^>]+)>$/;

export default async function copyProtocolFiles({
  destination,
  report,
  project,
  parseDescriptor,
}: {
  destination: PortablePath;
  report: Report;
  project: Project;
  parseDescriptor: (
    descriptor: Descriptor,
  ) => { parentLocator: Locator; paths: PortablePath[] } | undefined;
}): Promise<void> {
  const copiedPaths = new Set<string>();

  for (const descriptor of project.storedDescriptors.values()) {
    const resolvedDescriptor = structUtils.isVirtualDescriptor(descriptor)
      ? structUtils.devirtualizeDescriptor(descriptor)
      : descriptor;

    const parsed = parseDescriptor(resolvedDescriptor);
    if (!parsed) continue;

    const { parentLocator, paths } = parsed;

    for (const path of paths) {
      // Ignore builtin modules
      if (BUILTIN_REGEXP.test(path)) continue;

      // TODO: Handle absolute path
      if (ppath.isAbsolute(path)) continue;

      // Get the workspace by parentLocator
      const parentWorkspace = project.getWorkspaceByLocator(parentLocator);

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
