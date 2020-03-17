import { Workspace } from '@yarnpkg/core';
import getWorkspaceDependencies from './getWorkspaceDependencies';
import { structUtils } from '@yarnpkg/core';

export default function getWorkspaceDependents(
  workspace: Workspace,
): readonly Workspace[] {
  const dependents = new Set<Workspace>();

  for (const ws of workspace.project.workspaces) {
    const isDep = getWorkspaceDependencies(ws).some(dep =>
      structUtils.areLocatorsEqual(dep.locator, workspace.locator),
    );

    if (isDep) {
      dependents.add(ws);
    }
  }

  return [...dependents];
}
