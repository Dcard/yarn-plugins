import { BaseCommand } from '@yarnpkg/cli';
import { Command } from 'clipanion';
import {
  Configuration,
  Project,
  Cache,
  structUtils,
  StreamReport,
  execUtils,
} from '@yarnpkg/core';
import getDockerFilePath from '../utils/getDockerFilePath';
import getRequiredWorkspaces from '../utils/getRequiredWorkspaces';
import copyRcFile from '../utils/copyRcFile';
import { toFilename, ppath, xfs } from '@yarnpkg/fslib';
import copyPlugins from '../utils/copyPlugins';
import copyYarnRelease from '../utils/copyYarnRelease';
import copyManifests from '../utils/copyManifests';
import copyCacheMarkedFiles from '../utils/copyCacheMarkedFiles';
import generateLockfile from '../utils/generateLockfile';
import packWorkspace from '../utils/packWorkspace';

export default class DockerBuildCommand extends BaseCommand {
  @Command.String()
  public workspaceName!: string;

  @Command.Proxy()
  public args: string[] = [];

  @Command.String('-f,--file')
  public dockerFilePath?: string;

  public static usage = Command.Usage({
    category: 'Docker-related commands',
    description: 'Build a Docker image for a workspace',
    details: `
      This command will build a efficient Docker image which only contains production dependencies for the specified workspace.

      You have to create a Dockerfile in your workspace or your project. You can also specify the path to Dockerfile using the "-f, --file" option.

      Additional arguments can be passed to "docker build" directly, please check the Docker docs for more info: https://docs.docker.com/engine/reference/commandline/build/
    `,
    examples: [
      ['Build a Docker image for a workspace', 'yarn docker build @foo/bar'],
      [
        'Pass additional arguments to docker build command',
        'yarn docker build @foo/bar -t image-tag',
      ],
    ],
  });

  @Command.Path('docker', 'build')
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
      production: true,
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
          const manifestDir = ppath.join(cwd, toFilename('manifests'));
          const packDir = ppath.join(cwd, toFilename('packs'));

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

          await execUtils.pipevp(
            'docker',
            ['build', ...this.args, '-f', dockerFilePath, '.'],
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
