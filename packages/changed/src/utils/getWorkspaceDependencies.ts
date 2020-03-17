import { Workspace } from '@yarnpkg/core';

const DEPENDENCY_TYPES = ['devDependencies', 'dependencies'];

export default function getWorkspaceDependencies(
  workspace: Workspace,
): readonly Workspace[] {
  const { project } = workspace;
  const dependencies = new Set<Workspace>();

  function addDependency({ manifest }: Workspace): void {
    for (const depType of DEPENDENCY_TYPES) {
      for (const [, descriptor] of manifest.getForScope(depType)) {
        const dep = project.tryWorkspaceByDescriptor(descriptor);

        if (dep && !dependencies.has(dep)) {
          dependencies.add(dep);
          addDependency(dep);
        }
      }
    }
  }

  addDependency(workspace);

  return [...dependencies];
}
