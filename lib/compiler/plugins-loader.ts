import { existsSync } from 'fs';
import { resolve } from 'path';
import * as ts from 'typescript';
import { isObject } from 'util';
import { CLI_ERRORS } from '../ui';

type Transformer = ts.TransformerFactory<any> | ts.CustomTransformerFactory;
type PluginEntry = string | PluginAndOptions;

interface PluginAndOptions {
  name: 'string';
  options: Record<string, any>;
}

export interface NestCompilerPlugin {
  before?: (options?: Record<string, any>, program?: ts.Program) => Transformer;
  after?: (options?: Record<string, any>, program?: ts.Program) => Transformer;
}

export interface MultiNestCompilerPlugins {
  beforeHooks: Array<(program?: ts.Program) => Transformer>;
  afterHooks: Array<(program?: ts.Program) => Transformer>;
}

export class PluginsLoader {
  public load(plugins: PluginEntry[] = []): MultiNestCompilerPlugins {
    const pluginNames = plugins.map(entry =>
      isObject(entry) ? (entry as PluginAndOptions).name : (entry as string),
    );
    const pluginRefs: NestCompilerPlugin[] = pluginNames.map(item => {
      for (const path of module.paths) {
        const binaryPath = resolve(path, item);
        if (existsSync(binaryPath + '.js')) {
          return require(binaryPath);
        }
      }
      throw new Error(`"${item}" plugin could not be found!`);
    });
    const beforeHooks: MultiNestCompilerPlugins['afterHooks'] = [];
    const afterHooks: MultiNestCompilerPlugins['beforeHooks'] = [];
    pluginRefs.forEach((plugin, index) => {
      if (!plugin.before && !plugin.after) {
        throw new Error(CLI_ERRORS.WRONG_PLUGIN(pluginNames[index]));
      }
      const options = isObject(plugins[index])
        ? (plugins[index] as PluginAndOptions).options || {}
        : {};
      plugin.before &&
        beforeHooks.push(plugin.before.bind(plugin.before, options));
      plugin.after && afterHooks.push(plugin.after.bind(plugin.after, options));
    });
    return {
      beforeHooks,
      afterHooks,
    };
  }
}
