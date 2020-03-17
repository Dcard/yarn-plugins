import { FilterCommand } from './filter';
import { Command } from 'clipanion';
import { Configuration, Project, structUtils } from '@yarnpkg/core';
import { WorkspaceRequiredError } from '@yarnpkg/cli';

export default class ChangedForeachCommand extends FilterCommand {
  @Command.String()
  commandName!: string;

  @Command.Proxy()
  args: string[] = [];

  @Command.Boolean('-v,--verbose')
  verbose = false;

  @Command.Boolean('-p,--parallel')
  parallel = false;

  @Command.Boolean('-i,--interlaced')
  interlaced = false;

  @Command.String('-j,--jobs')
  jobs?: number;

  public static usage = Command.Usage({
    description: 'Run a command on changed workspaces and their dependents',
  });

  @Command.Path('changed', 'foreach')
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

    return this.cli.run(
      [
        'workspaces',
        'foreach',
        ...workspaces.reduce(
          (acc, ws) => [
            ...acc,
            '--include',
            structUtils.stringifyIdent(ws.locator),
          ],
          [] as string[],
        ),
        ...(this.verbose ? ['--verbose'] : []),
        ...(this.parallel ? ['--parallel'] : []),
        ...(this.interlaced ? ['--interlaced'] : []),
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
