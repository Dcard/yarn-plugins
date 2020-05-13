import { BaseCommand } from '@yarnpkg/cli';
import { Command } from 'clipanion';
import { execUtils, Project, Workspace, structUtils } from '@yarnpkg/core';
import listChangedWorkspaces from '../utils/listChangedWorkspaces';

export abstract class FilterCommand extends BaseCommand {
  @Command.String('--git-range')
  public gitRange = '';

  @Command.Array('--include')
  public include: string[] = [];

  @Command.Array('--exclude')
  public exclude: string[] = [];

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
    const workspaces = listChangedWorkspaces(project, files);

    return workspaces.filter((ws) => {
      const name = structUtils.stringifyIdent(ws.locator);

      if (name) {
        if (this.include.length && !this.include.includes(name)) {
          return false;
        }

        if (this.exclude.length && this.exclude.includes(name)) {
          return false;
        }
      }

      return true;
    });
  }
}
