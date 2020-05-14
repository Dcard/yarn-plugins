import { Workspace, Manifest } from '@yarnpkg/core';

export default function getWorkspaceDependencies(
  workspace: Workspace,
): readonly Workspace[] {
  const { project } = workspace;
  const dependencies = new Set<Workspace>();

  function addDependency({ manifest }: Workspace): void {
    for (const depType of Manifest.hardDependencies) {
      for (const descriptor of manifest.getForScope(depType).values()) {
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
