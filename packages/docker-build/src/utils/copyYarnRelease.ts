import { PortablePath, xfs, ppath } from '@yarnpkg/fslib';
import { Project, Report } from '@yarnpkg/core';

export default async function copyYarnRelease({
  destination,
  project,
  report,
}: {
  destination: PortablePath;
  project: Project;
  report: Report;
}): Promise<void> {
  const src = project.configuration.get('yarnPath');
  const path = ppath.relative(project.cwd, src);
  const dest = ppath.join(destination, path);

  report.reportInfo(null, path);
  await xfs.copyPromise(dest, src, {
    overwrite: true,
  });
}
