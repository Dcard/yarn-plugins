/* eslint-disable @typescript-eslint/no-explicit-any */
import 'jest-extended';
import TestProject from '../../utils/TestProject';
import TestWorkspace from '../../utils/TestWorkspace';
import { outputJSON, readJSON, pathExists, remove } from 'fs-extra';
import { join } from 'path';

let project: TestProject;
let workspaces: TestWorkspace[];

beforeAll(async () => {
  project = await TestProject.setup();
  workspaces = await Promise.all([
    TestWorkspace.setup(project, 'test-a'),
    TestWorkspace.setup(project, 'test-b'),
  ]);

  await project.yarn();
});

afterAll(async () => {
  await project?.cleanup();
});

function getTsConfigPath(ws: TestWorkspace): string {
  return join(ws.path, 'tsconfig.json');
}

function readTsConfig(ws: TestWorkspace): Promise<unknown> {
  return readJSON(getTsConfigPath(ws));
}

async function writeTsConfig(ws: TestWorkspace, data: unknown): Promise<void> {
  await outputJSON(getTsConfigPath(ws), data);
}

async function deleteTsConfig(ws: TestWorkspace): Promise<void> {
  await remove(getTsConfigPath(ws));
}

async function setupTsConfig(data: unknown): Promise<void> {
  beforeAll(async () => {
    await writeTsConfig(workspaces[0], data);
  });

  afterAll(async () => {
    await deleteTsConfig(workspaces[0]);
  });
}

function testTsConfig({ references, ...options }: Record<string, any>): void {
  it('check tsconfig.json', async () => {
    const actual = await readTsConfig(workspaces[0]);
    const entries = Object.entries(options);

    if (references) {
      entries.push(['references', expect.arrayContaining(references)]);
    }

    expect(actual).toContainAllEntries(entries);
  });
}

describe('add workspace', () => {
  beforeEach(async () => {
    await workspaces[0].yarn(['add', workspaces[1].name]);
  });

  afterEach(async () => {
    await workspaces[0].yarn(['remove', workspaces[1].name]);
  });

  describe('when tsconfig.json does not exist', () => {
    it('should not create tsconfig.json', async () => {
      expect(await pathExists(getTsConfigPath(workspaces[0]))).toBeFalse();
    });
  });

  describe('when tsconfig.json exist', () => {
    describe('references does not exist', () => {
      setupTsConfig({
        compilerOptions: {},
      });

      testTsConfig({
        compilerOptions: {},
        references: [{ path: '../test-b' }],
      });
    });

    describe('references exist', () => {
      describe('references contain the workspace', () => {
        setupTsConfig({
          references: [{ path: '../test-b' }, { path: '../test-c' }],
        });

        testTsConfig({
          references: [{ path: '../test-b' }, { path: '../test-c' }],
        });
      });

      describe('references does not contain the workspace', () => {
        setupTsConfig({
          references: [{ path: '../test-c' }],
        });

        testTsConfig({
          references: [{ path: '../test-b' }, { path: '../test-c' }],
        });
      });
    });
  });
});

describe('remove workspace', () => {
  beforeAll(async () => {
    await workspaces[0].yarn(['add', workspaces[1].name]);
  });

  beforeEach(async () => {
    await workspaces[0].yarn(['remove', workspaces[1].name]);
  });

  afterEach(async () => {
    await workspaces[0].yarn(['add', workspaces[1].name]);
  });

  describe('when tsconfig.json does not exist', () => {
    it('should not create tsconfig.json', async () => {
      expect(await pathExists(getTsConfigPath(workspaces[0]))).toBeFalse();
    });
  });

  describe('when tsconfig.json exist', () => {
    describe('references does not exist', () => {
      setupTsConfig({
        compilerOptions: {},
      });

      testTsConfig({
        compilerOptions: {},
      });
    });

    describe('references exist', () => {
      describe('references contain the workspace', () => {
        setupTsConfig({
          references: [{ path: '../test-b' }, { path: '../test-c' }],
        });

        testTsConfig({
          references: [{ path: '../test-c' }],
        });
      });

      describe('references does not contain the workspace', () => {
        setupTsConfig({
          references: [{ path: '../test-c' }],
        });

        testTsConfig({
          references: [{ path: '../test-c' }],
        });
      });
    });
  });
});
