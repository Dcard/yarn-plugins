import { FilterCommand } from './filter';
import { Command } from 'clipanion';
import {
  Configuration,
  Project,
  StreamReport,
  structUtils,
} from '@yarnpkg/core';
import { WorkspaceRequiredError } from '@yarnpkg/cli';

export default class ChangedListCommand extends FilterCommand {
  @Command.Boolean('--json')
  public json = false;

  public static usage = Command.Usage({
    description: 'List changed workspaces and their dependents',
  });

  @Command.Path('changed', 'list')
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

    const report = await StreamReport.start(
      {
        configuration,
        json: this.json,
        stdout: this.context.stdout,
      },
      async report => {
        const workspaces = await this.listWorkspaces(project);

        for (const ws of workspaces) {
          report.reportInfo(null, ws.relativeCwd);
          report.reportJson({
            name: ws.manifest.name
              ? structUtils.stringifyIdent(ws.manifest.name)
              : null,
            location: ws.relativeCwd,
          });
        }
      },
    );

    return report.exitCode();
  }
}
