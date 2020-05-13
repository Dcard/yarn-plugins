import { Project, Workspace } from '@yarnpkg/core';
import getWorkspaceDependents from './getWorkspaceDependents';

export default function listChangedWorkspaces(
  project: Project,
  files: readonly string[],
): readonly Workspace[] {
  const workspaces = new Set<Workspace>();

  for (const ws of project.workspaces) {
    const changed = files.some((path) => path.startsWith(ws.relativeCwd));

    if (changed && !workspaces.has(ws)) {
      workspaces.add(ws);

      for (const dep of getWorkspaceDependents(ws)) {
        workspaces.add(dep);
      }
    }
  }

  return [...workspaces];
}
