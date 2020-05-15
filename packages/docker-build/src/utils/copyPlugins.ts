import { PortablePath, xfs, toFilename, ppath } from '@yarnpkg/fslib';
import { Project, Report } from '@yarnpkg/core';

export default async function copyPlugins({
  destination,
  project,
  report,
}: {
  destination: PortablePath;
  project: Project;
  report: Report;
}): Promise<void> {
  const pluginDir = ppath.join(toFilename('.yarn'), toFilename('plugins'));

  report.reportInfo(null, pluginDir);
  await xfs.copyPromise(
    ppath.join(destination, pluginDir),
    ppath.join(project.cwd, pluginDir),
    { overwrite: true },
  );
}
