import { Workspace, Project, Manifest } from '@yarnpkg/core';

export default function getRequiredWorkspaces({
  project,
  workspaces,
  production = false,
  scopes = production ? ['dependencies'] : Manifest.hardDependencies,
}: {
  project: Project;
  workspaces: Workspace[];
  scopes?: string[];
  production?: boolean;
}): Set<Workspace> {
  const requiredWorkspaces = new Set([...workspaces]);

  for (const ws of requiredWorkspaces) {
    for (const scope of scopes) {
      const deps = ws.manifest.getForScope(scope).values();

      for (const dep of deps) {
        const workspace = project.tryWorkspaceByDescriptor(dep);

        if (workspace) {
          requiredWorkspaces.add(workspace);
        }
      }
    }
  }

  for (const ws of project.workspaces) {
    if (requiredWorkspaces.has(ws)) {
      if (production) {
        ws.manifest.devDependencies.clear();
      }
    } else {
      ws.manifest.dependencies.clear();
      ws.manifest.devDependencies.clear();
      ws.manifest.peerDependencies.clear();
    }
  }

  return requiredWorkspaces;
}
