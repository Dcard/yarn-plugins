import { Project, Report } from '@yarnpkg/core';
import { PortablePath, ppath, xfs } from '@yarnpkg/fslib';

export default async function copyRcFile({
  destination,
  project,
  report,
}: {
  destination: PortablePath;
  project: Project;
  report: Report;
}): Promise<void> {
  const filename = project.configuration.get('rcFilename');

  report.reportInfo(null, filename);
  await xfs.copyPromise(
    ppath.join(destination, filename),
    ppath.join(project.cwd, filename),
    { overwrite: true },
  );
}
