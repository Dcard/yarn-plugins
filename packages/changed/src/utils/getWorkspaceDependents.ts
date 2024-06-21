import { Workspace, structUtils } from '@yarnpkg/core';
import getWorkspaceDependencies from './getWorkspaceDependencies';

export default function getWorkspaceDependents(
  workspace: Workspace,
): readonly Workspace[] {
  const dependents = new Set<Workspace>();

  for (const ws of workspace.project.workspaces) {
    const isDep = getWorkspaceDependencies(ws).some((dep) =>
      structUtils.areLocatorsEqual(
        dep.anchoredLocator,
        workspace.anchoredLocator,
      ),
    );

    if (isDep) {
      dependents.add(ws);
    }
  }

  return [...dependents];
}
