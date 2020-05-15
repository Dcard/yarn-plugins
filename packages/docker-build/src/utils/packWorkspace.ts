import { Workspace, Report } from '@yarnpkg/core';
import { PortablePath, ppath, xfs } from '@yarnpkg/fslib';
import { packUtils } from '@yarnpkg/plugin-pack';

export default async function packWorkspace({
  workspace,
  destination,
  report,
}: {
  workspace: Workspace;
  destination: PortablePath;
  report: Report;
}): Promise<void> {
  await packUtils.prepareForPack(workspace, { report }, async () => {
    const files = await packUtils.genPackList(workspace);
    const progress = Report.progressViaCounter(files.length);
    const reportedProgress = report.reportProgress(progress);

    try {
      for (const file of files) {
        const src = ppath.join(workspace.cwd, file);
        const dest = ppath.join(destination, workspace.relativeCwd, file);

        report.reportInfo(null, file);
        await xfs.copyPromise(dest, src, { overwrite: true });
        progress.tick();
      }
    } finally {
      reportedProgress.stop();
    }
  });
}
