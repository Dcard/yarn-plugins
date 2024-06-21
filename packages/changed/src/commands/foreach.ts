import { FilterCommand } from './filter';
import { Command, Option } from 'clipanion';
import {
  Configuration,
  Project,
  structUtils,
  StreamReport,
} from '@yarnpkg/core';
import { WorkspaceRequiredError } from '@yarnpkg/cli';

export default class ChangedForeachCommand extends FilterCommand {
  commandName: string = Option.String();

  args: string[] = Option.Proxy();

  verbose = Option.Boolean('-v,--verbose', false);

  parallel = Option.Boolean('-p,--parallel', false);

  interlaced = Option.Boolean('-i,--interlaced', false);

  topological = Option.Boolean('-t,--topological', false);

  all = Option.Boolean('-A,--all', false);

  recursive = Option.Boolean('-R,--recursive', false);

  worktree = Option.Boolean('-W,--worktree', false);

  jobs?: number = Option.String('-j,--jobs');

  public static usage = Command.Usage({
    description: 'Run a command on changed workspaces and their dependents',
    details: `
      This command will run a given sub-command on changed workspaces and workspaces depends on them.

      Check the documentation for \`yarn workspace foreach\` for more details.
    `,
    examples: [
      [
        'Run build scripts on changed workspaces',
        'yarn changed foreach run build',
      ],
      [
        'Find changed files within a Git range',
        'yarn changed foreach --git-range 93a9ed8..4ef2c61 run build',
      ],
    ],
  });

  static paths = [['changed', 'foreach']];

  public async execute(): Promise<number> {
    const configuration = await Configuration.find(
      this.context.cwd,
      this.context.plugins,
    );
    const { project, workspace } = await Project.find(
      configuration,
      this.context.cwd,
    );

    if (!workspace) {
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);
    }

    const workspaces = await this.listWorkspaces(project);

    if (!workspaces.length) {
      const report = await StreamReport.start(
        {
          configuration,
          stdout: this.context.stdout,
        },
        async (report) => {
          report.reportInfo(null, 'No workspaces changed');
        },
      );

      return report.exitCode();
    }

    return this.cli.run(
      [
        'workspaces',
        'foreach',
        ...workspaces.reduce(
          (acc, ws) => [
            ...acc,
            '--include',
            structUtils.stringifyIdent(ws.anchoredLocator),
          ],
          [] as string[],
        ),
        ...(this.verbose ? ['--verbose'] : []),
        ...(this.parallel ? ['--parallel'] : []),
        ...(this.interlaced ? ['--interlaced'] : []),
        ...(this.topological ? ['--topological'] : []),
        ...(this.all ? ['--all'] : []),
        ...(this.recursive ? ['--recursive'] : []),
        ...(this.worktree ? ['--worktree'] : []),
        ...(this.jobs ? ['--jobs', `${this.jobs}`] : []),
        this.commandName,
        ...this.args,
      ],
      {
        cwd: project.cwd,
      },
    );
  }
}
