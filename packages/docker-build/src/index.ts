import { Plugin } from '@yarnpkg/core';

import build from './commands/build';

const plugin: Plugin = {
  commands: [build],
};

export default plugin;
