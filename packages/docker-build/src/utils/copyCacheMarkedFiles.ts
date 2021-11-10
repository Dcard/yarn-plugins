import { PortablePath, xfs, ppath } from '@yarnpkg/fslib';
import { Cache, Project, Report } from '@yarnpkg/core';

export default async function copyCacheMarkedFiles({
  destination,
  project,
  cache,
  report,
}: {
  destination: PortablePath;
  project: Project;
  cache: Cache;
  report: Report;
}): Promise<void> {
  for (const src of cache.markedFiles) {
    const path = ppath.relative(project.cwd, src);

    if (await xfs.existsPromise(src)) {
      report.reportInfo(null, path);
      await xfs.copyPromise(ppath.join(destination, path), src);
    }
  }
}
