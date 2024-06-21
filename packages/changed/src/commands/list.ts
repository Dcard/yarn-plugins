import { FilterCommand } from './filter';
import { Command, Option } from 'clipanion';
import {
  Configuration,
  Project,
  StreamReport,
  structUtils,
} from '@yarnpkg/core';
import { WorkspaceRequiredError } from '@yarnpkg/cli';

export default class ChangedListCommand extends FilterCommand {
  public json = Option.Boolean('--json', false);

  public static usage = Command.Usage({
    description: 'List changed workspaces and their dependents',
    details: `
      If the \`--json\` flag is set the output will follow a JSON-stream output also known as NDJSON (https://github.com/ndjson/ndjson-spec).
    `,
    examples: [
      [
        'Find changed files within a Git range',
        'yarn changed list --git-range 93a9ed8..4ef2c61',
      ],
      [
        'Include or exclude workspaces',
        'yarn changed list --include @foo/a --exclude @foo/b',
      ],
    ],
  });

  static paths = [['changed', 'list']];

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
      async (report) => {
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
