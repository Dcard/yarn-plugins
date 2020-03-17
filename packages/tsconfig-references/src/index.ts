import { Plugin, Workspace, Descriptor } from '@yarnpkg/core';
import { Hooks, suggestUtils } from '@yarnpkg/plugin-essentials';
import { ppath, toFilename, xfs, PortablePath } from '@yarnpkg/fslib';
import detectIndent from 'detect-indent';

const BASE_TSCONFIG = {
  references: [],
  indent: '  ',
};

function getTsConfigPath(workspace: Workspace): PortablePath {
  return ppath.join(workspace.cwd, toFilename('tsconfig.json'));
}

interface TsReference {
  path: string;
}

interface TsConfig {
  indent: string;
  references: TsReference[];
  [key: string]: unknown;
}

async function readTsConfig(workspace: Workspace): Promise<TsConfig> {
  const path = getTsConfigPath(workspace);
  const exist = await xfs.existsPromise(path);

  if (!exist) {
    return BASE_TSCONFIG;
  }

  const content = await xfs.readFilePromise(path, 'utf8');

  return {
    ...BASE_TSCONFIG,
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
  return descriptor.range.startsWith('workspace:');
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
    descriptor.range.substring(10) as PortablePath,
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

  await writeTsConfig(workspace, {
    ...tsConfig,
    references: uniqTsReference([
      ...tsConfig.references,
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
  const refPath = getReferencePath(workspace, descriptor);

  await writeTsConfig(workspace, {
    ...tsConfig,
    references: uniqTsReference(
      tsConfig.references.filter(ref => ref.path !== refPath),
    ),
  });
}

const plugin: Plugin<Hooks> = {
  hooks: {
    afterWorkspaceDependencyAddition,
    afterWorkspaceDependencyRemoval,
  },
};

export default plugin;
