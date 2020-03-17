import { Plugin } from '@yarnpkg/core';

import list from './commands/list';
import foreach from './commands/foreach';

const plugin: Plugin = {
  commands: [list, foreach],
};

export default plugin;
