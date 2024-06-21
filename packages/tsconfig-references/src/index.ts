import { Plugin, Workspace, Descriptor } from '@yarnpkg/core';
import { Hooks, suggestUtils } from '@yarnpkg/plugin-essentials';
import { ppath, xfs, PortablePath } from '@yarnpkg/fslib';
import detectIndent from 'detect-indent';

function getTsConfigPath(workspace: Workspace): PortablePath {
  return ppath.join(workspace.cwd, 'tsconfig.json');
}

interface TsReference {
  path: string;
}

interface TsConfig {
  indent: string;
  newLineEOF: string;
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
    newLineEOF: getNewLineAtEOF(content),
  };
}

async function writeTsConfig(
  workspace: Workspace,
  { indent, newLineEOF, ...tsConfig }: TsConfig,
): Promise<void> {
  const path = getTsConfigPath(workspace);
  await xfs.writeFilePromise(
    path,
    JSON.stringify(tsConfig, null, indent) + newLineEOF,
  );
}

async function isTsWorkspace(workspace: Workspace): Promise<boolean> {
  return xfs.existsPromise(getTsConfigPath(workspace));
}

function uniqTsReference(references: TsReference[]): TsReference[] {
  const obj: Record<string, TsReference> = {};

  for (const ref of references) {
    obj[ref.path] = ref;
  }

  return Object.values(obj);
}

function getReferencePath(source: Workspace, target: Workspace): PortablePath {
  return ppath.relative(source.cwd, target.cwd);
}

async function afterWorkspaceDependencyAddition(
  workspace: Workspace,
  target: suggestUtils.Target,
  descriptor: Descriptor,
): Promise<void> {
  const targetWorkspace =
    workspace.project.tryWorkspaceByDescriptor(descriptor);

  if (!targetWorkspace || !(await isTsWorkspace(targetWorkspace))) {
    return;
  }

  const tsConfig = await readTsConfig(workspace);
  if (!tsConfig) return;

  await writeTsConfig(workspace, {
    ...tsConfig,
    references: uniqTsReference([
      ...(tsConfig.references || []),
      { path: getReferencePath(workspace, targetWorkspace) },
    ]),
  });
}

async function afterWorkspaceDependencyRemoval(
  workspace: Workspace,
  target: suggestUtils.Target,
  descriptor: Descriptor,
): Promise<void> {
  const targetWorkspace =
    workspace.project.tryWorkspaceByDescriptor(descriptor);

  if (!targetWorkspace || !(await isTsWorkspace(targetWorkspace))) {
    return;
  }

  const tsConfig = await readTsConfig(workspace);
  if (!tsConfig) return;

  const refPath = getReferencePath(workspace, targetWorkspace);

  await writeTsConfig(workspace, {
    ...tsConfig,
    ...(tsConfig.references &&
      tsConfig.references.length && {
        references: uniqTsReference(
          tsConfig.references.filter((ref) => ref.path !== refPath),
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

function getNewLineAtEOF(input: string) {
  const length = input.length;

  if (input[length - 1] === '\n') {
    if (input[length - 2] === '\r') {
      return '\r\n';
    }

    return '\n';
  }

  return '';
}
