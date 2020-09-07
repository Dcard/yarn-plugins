import TestProject from './TestProject';
import { remove, outputJSON } from 'fs-extra';
import { join, posix } from 'path';
import execa from 'execa';

export default class TestWorkspace {
  private constructor(
    public readonly project: TestProject,
    public readonly name: string,
  ) {}

  public static async setup(
    project: TestProject,
    name: string,
  ): Promise<TestWorkspace> {
    const ws = new TestWorkspace(project, name);

    // Create package.json
    await outputJSON(join(ws.path, 'package.json'), {
      name,
      private: true,
    });

    return ws;
  }

  public get location(): string {
    return posix.join('packages', this.name);
  }

  public get path(): string {
    return join(this.project.path, this.location);
  }

  public async cleanup(): Promise<void> {
    await remove(this.path);
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  public yarn(args?: string[], options?: execa.Options) {
    return execa('yarn', args, {
      cwd: this.path,
      ...options,
    });
  }
}
