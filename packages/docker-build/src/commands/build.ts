import { BaseCommand } from '@yarnpkg/cli';
import { Command, Option } from 'clipanion';
import {
  Configuration,
  Project,
  Cache,
  structUtils,
  StreamReport,
  execUtils,
} from '@yarnpkg/core';
import { patchUtils } from '@yarnpkg/plugin-patch';
import getDockerFilePath from '../utils/getDockerFilePath';
import getRequiredWorkspaces from '../utils/getRequiredWorkspaces';
import copyRcFile from '../utils/copyRcFile';
import { ppath, xfs } from '@yarnpkg/fslib';
import copyPlugins from '../utils/copyPlugins';
import copyYarnRelease from '../utils/copyYarnRelease';
import copyManifests from '../utils/copyManifests';
import copyCacheMarkedFiles from '../utils/copyCacheMarkedFiles';
import generateLockfile from '../utils/generateLockfile';
import packWorkspace from '../utils/packWorkspace';
import copyAdditional from '../utils/copyAdditional';
import copyProtocolFiles from '../utils/copyProtocolFiles';
import { parseSpec } from '../utils/execUtils';

export default class DockerBuildCommand extends BaseCommand {
  public workspaceName: string = Option.String();

  public args: string[] = Option.Proxy();

  public dockerFilePath?: string = Option.String('-f,--file');

  public copyFiles?: string[] = Option.Array('--copy');

  public production?: boolean = Option.Boolean('--production');

  public buildKit?: boolean = Option.Boolean('--buildkit');

  public static usage = Command.Usage({
    category: 'Docker-related commands',
    description: 'Build a Docker image for a workspace',
    details: `
      This command will build a efficient Docker image which only contains necessary dependencies for the specified workspace.

      You have to create a Dockerfile in your workspace or your project. You can also specify the path to Dockerfile using the "-f, --file" option.

      Additional arguments can be passed to "docker build" directly, please check the Docker docs for more info: https://docs.docker.com/engine/reference/commandline/build/

      You can copy additional files or folders to a Docker image using the "--copy" option. This is useful for secret keys or configuration files. The files will be copied to "manifests" folder. The path can be either a path relative to the Dockerfile or an absolute path.
    `,
    examples: [
      ['Build a Docker image for a workspace', 'yarn docker build @foo/bar'],
      [
        'Pass additional arguments to docker build command',
        'yarn docker build @foo/bar -t image-tag',
      ],
      [
        'Copy additional files to a Docker image',
        'yarn docker build --copy secret.key --copy config.json @foo/bar',
      ],
      [
        'Install production dependencies only',
        'yarn docker build --production @foo/bar',
      ],
      [
        'Build a Docker image using BuildKit',
        'yarn docker build --buildkit @foo/bar',
      ],
    ],
  });

  static paths = [['docker', 'build']];

  public async execute(): Promise<number> {
    const configuration = await Configuration.find(
      this.context.cwd,
      this.context.plugins,
    );
    const { project } = await Project.find(configuration, this.context.cwd);

    const workspace = project.getWorkspaceByIdent(
      structUtils.parseIdent(this.workspaceName),
    );

    const requiredWorkspaces = getRequiredWorkspaces({
      project,
      workspaces: [workspace],
      production: this.production,
    });

    const dockerFilePath = await getDockerFilePath(
      workspace,
      this.dockerFilePath,
    );

    const cache = await Cache.find(configuration);

    const report = await StreamReport.start(
      {
        configuration,
        stdout: this.context.stdout,
        includeLogs: !this.context.quiet,
      },
      async (report) => {
        await report.startTimerPromise('Resolution Step', async () => {
          await project.resolveEverything({ report, cache });
        });

        await report.startTimerPromise('Fetch Step', async () => {
          await project.fetchEverything({ report, cache });
        });

        await xfs.mktempPromise(async (cwd) => {
          const manifestDir = ppath.join(cwd, 'manifests');
          const packDir = ppath.join(cwd, 'packs');

          await report.startTimerPromise('Copy files', async () => {
            await copyRcFile({
              destination: manifestDir,
              project,
              report,
            });

            await copyPlugins({
              destination: manifestDir,
              project,
              report,
            });

            await copyYarnRelease({
              destination: manifestDir,
              project,
              report,
            });

            await copyManifests({
              destination: manifestDir,
              workspaces: project.workspaces,
              report,
            });

            await copyProtocolFiles({
              destination: manifestDir,
              report,
              project,
              parseDescriptor: (descriptor) => {
                if (descriptor.range.startsWith('exec:')) {
                  const parsed = parseSpec(descriptor.range);
                  if (!parsed || !parsed.parentLocator) return;
                  return {
                    parentLocator: parsed.parentLocator,
                    paths: [parsed.path],
                  };
                } else if (descriptor.range.startsWith('patch:')) {
                  const { parentLocator, patchPaths: paths } =
                    patchUtils.parseDescriptor(descriptor);
                  if (!parentLocator) return;
                  return { parentLocator, paths };
                }
              },
            });

            await copyCacheMarkedFiles({
              destination: manifestDir,
              project,
              cache,
              report,
            });

            await generateLockfile({
              destination: manifestDir,
              project,
              report,
            });

            if (this.copyFiles && this.copyFiles.length) {
              await copyAdditional({
                destination: manifestDir,
                files: this.copyFiles,
                dockerFilePath,
                report,
              });
            }
          });

          for (const ws of requiredWorkspaces) {
            const name = ws.manifest.name
              ? structUtils.stringifyIdent(ws.manifest.name)
              : '';

            await report.startTimerPromise(
              `Pack workspace ${name}`,
              async () => {
                await packWorkspace({
                  workspace: ws,
                  report,
                  destination: packDir,
                });
              },
            );
          }

          const buildCommand = this.buildKit ? ['buildx', 'build'] : ['build'];

          await execUtils.pipevp(
            'docker',
            [...buildCommand, ...this.args, '-f', dockerFilePath, '.'],
            {
              cwd,
              strict: true,
              stdin: this.context.stdin,
              stdout: this.context.stdout,
              stderr: this.context.stderr,
            },
          );
        });
      },
    );

    return report.exitCode();
  }
}
