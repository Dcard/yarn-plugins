import { PortablePath, xfs, ppath, toFilename } from '@yarnpkg/fslib';
import { Report } from '@yarnpkg/core';

function resolvePath(baseDir: PortablePath, inputPath: string): PortablePath {
  const path = toFilename(inputPath);

  if (ppath.isAbsolute(path)) {
    return ppath.relative(baseDir, path);
  }

  return path;
}

export default async function copyAdditional({
  destination,
  files,
  dockerFilePath,
  report,
}: {
  destination: PortablePath;
  files: string[];
  dockerFilePath: PortablePath;
  report: Report;
}): Promise<void> {
  const baseDir = ppath.dirname(dockerFilePath);

  for (const file of files) {
    const path = resolvePath(baseDir, file);
    const src = ppath.join(baseDir, path);
    const dest = ppath.join(destination, path);

    report.reportInfo(null, path);
    await xfs.copyPromise(dest, src);
  }
}
