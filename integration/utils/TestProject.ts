import tmp from 'tmp-promise';
import { emptyDir, copy, outputFile, outputJSON } from 'fs-extra';
import { join, sep, posix, basename, extname } from 'path';
import { safeDump } from 'js-yaml';
import globby from 'globby';
import execa from 'execa';

const PROJECT_DIR = join(__dirname, '../..');

export default class TestProject {
  private constructor(private readonly tmpDir: tmp.DirectoryResult) {}

  public static async setup(): Promise<TestProject> {
    const dir = await tmp.dir();
    const pluginBundles = await globby('packages/*/bundles/**/*.js', {
      cwd: PROJECT_DIR,
    });
    const plugins = pluginBundles.map((src) => ({
      src,
      name: '@yarnpkg/' + basename(src, extname(src)),
      dest: posix.join('.yarn', 'plugins', ...src.split(sep).slice(3)),
    }));

    for (const path of plugins) {
      await copy(join(PROJECT_DIR, path.src), join(dir.path, path.dest));
    }

    // Create .yarnrc.yml
    await outputFile(
      join(dir.path, '.yarnrc.yml'),
      safeDump({
        yarnPath: join(PROJECT_DIR, '.yarn', 'releases', 'yarn-rc.js'),
        plugins: plugins.map((plugin) => ({
          path: plugin.dest,
          spec: plugin.name,
        })),
      }),
    );

    // Create package.json
    await outputJSON(join(dir.path, 'package.json'), {
      private: true,
      workspaces: ['packages/*'],
    });

    return new TestProject(dir);
  }

  public get path(): string {
    return this.tmpDir.path;
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  public yarn(args?: string[], options?: execa.Options) {
    return execa('yarn', args, {
      cwd: this.tmpDir.path,
      ...options,
    });
  }

  public async cleanup(): Promise<void> {
    await emptyDir(this.tmpDir.path);
    await this.tmpDir.cleanup();
  }
}
