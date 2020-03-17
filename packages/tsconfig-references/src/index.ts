import { Plugin, Workspace, Descriptor } from '@yarnpkg/core';
import { Hooks, suggestUtils } from '@yarnpkg/plugin-essentials';
import { ppath, toFilename, xfs, PortablePath } from '@yarnpkg/fslib';
import detectIndent from 'detect-indent';

const WORKSPACE_PROTOCOL = 'workspace:';

function getTsConfigPath(workspace: Workspace): PortablePath {
  return ppath.join(workspace.cwd, toFilename('tsconfig.json'));
}

interface TsReference {
  path: string;
}

interface TsConfig {
  indent: string;
  references?: TsReference[];
  [key: string]: unknown;
}

async function readTsConfig(
  workspace: Workspace,
): Promise<TsConfig | undefined> {
  const path = getTsConfigPath(workspace);
  const exist = await xfs.existsPromise(path);
  if (!exist) return;

  const content = await xfs.readFilePromise(path, 'utf8');

  return {
    ...JSON.parse(content),
    indent: detectIndent(content).indent,
  };
}

async function writeTsConfig(
  workspace: Workspace,
  { indent, ...tsConfig }: TsConfig,
): Promise<void> {
  const path = getTsConfigPath(workspace);
  await xfs.writeFilePromise(path, JSON.stringify(tsConfig, null, indent));
}

function isLocalPackage(descriptor: Descriptor): boolean {
  return descriptor.range.startsWith(WORKSPACE_PROTOCOL);
}

function uniqTsReference(references: TsReference[]): TsReference[] {
  const obj: Record<string, TsReference> = {};

  for (const ref of references) {
    obj[ref.path] = ref;
  }

  return Object.values(obj);
}

function getReferencePath(
  workspace: Workspace,
  descriptor: Descriptor,
): PortablePath {
  const src = workspace.cwd;
  const dest = ppath.join(
    workspace.project.cwd,
    descriptor.range.substring(WORKSPACE_PROTOCOL.length) as PortablePath,
  );

  return ppath.relative(src, dest);
}

async function afterWorkspaceDependencyAddition(
  workspace: Workspace,
  target: suggestUtils.Target,
  descriptor: Descriptor,
): Promise<void> {
  if (!isLocalPackage(descriptor)) {
    return;
  }

  const tsConfig = await readTsConfig(workspace);
  if (!tsConfig) return;

  await writeTsConfig(workspace, {
    ...tsConfig,
    references: uniqTsReference([
      ...(tsConfig.references || []),
      { path: getReferencePath(workspace, descriptor) },
    ]),
  });
}

async function afterWorkspaceDependencyRemoval(
  workspace: Workspace,
  target: suggestUtils.Target,
  descriptor: Descriptor,
): Promise<void> {
  if (!isLocalPackage(descriptor)) {
    return;
  }

  const tsConfig = await readTsConfig(workspace);
  if (!tsConfig) return;

  const refPath = getReferencePath(workspace, descriptor);

  await writeTsConfig(workspace, {
    ...tsConfig,
    ...(tsConfig.references &&
      tsConfig.references.length && {
        references: uniqTsReference(
          tsConfig.references.filter(ref => ref.path !== refPath),
        ),
      }),
  });
}

const plugin: Plugin<Hooks> = {
  hooks: {
    afterWorkspaceDependencyAddition,
    afterWorkspaceDependencyRemoval,
  },
};

export default plugin;
