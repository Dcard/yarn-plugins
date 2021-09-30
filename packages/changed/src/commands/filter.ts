import { BaseCommand } from '@yarnpkg/cli';
import { Command } from 'clipanion';
import { execUtils, Project, Workspace, structUtils } from '@yarnpkg/core';
import listChangedWorkspaces from '../utils/listChangedWorkspaces';

export abstract class FilterCommand extends BaseCommand {
  @Command.String('--git-range')
  public gitRange?: string;

  @Command.Array('--include')
  public include?: string[];

  @Command.Array('--exclude')
  public exclude?: string[];

  @Command.Boolean('--exclude-dependents')
  public excludeDependents?: boolean;

  @Command.Boolean('--public-only')
  public publicOnly?: boolean;

  protected async listWorkspaces(
    project: Project,
  ): Promise<readonly Workspace[]> {
    const { stdout } = await execUtils.execvp(
      'git',
      ['diff', '--name-only', ...(this.gitRange ? [this.gitRange] : [])],
      {
        cwd: project.cwd,
        strict: true,
      },
    );
    const files = stdout.split(/\r?\n/);

    const workspaces = listChangedWorkspaces(
      project,
      files,
      this.excludeDependents ?? false,
    );
    const include = this.include || [];
    const exclude = this.exclude || [];

    return workspaces.filter((ws) => {
      const name = structUtils.stringifyIdent(ws.locator);

      if (name) {
        if (include.length && !include.includes(name)) {
          return false;
        }

        if (exclude.length && exclude.includes(name)) {
          return false;
        }
      }

      if (this.publicOnly) {
        if (ws.manifest.private === true) {
          return false;
        }
      }

      return true;
    });
  }
}
