const _ = require('lodash');

class BasePlugin {
  /**
   * Base Plugin Constructor
   *
   * @param {object} serverless Serverless instance
   * @param {object} options object
   * @param {string} logPreffix console log preffixer
   * @param {string} useConfigPreffix Serverless yml root key user config
   */
  constructor(serverless, options, logPreffix, useConfigPreffix = '') {
    this.options = options;
    this.serverless = serverless;
    this.logPreffix = logPreffix;
    this.useConfigPreffix = useConfigPreffix;
    this.aws = this.serverless.getProvider('aws');
  }

  /**
   * Check plugin for disabled state
   *
   * @returns {boolean} if plugin is disabled based on user config
   */
  isPluginDisabled() {
    const disabled = this.getConf('disabled', false);
    return (_.isBoolean(disabled) && disabled) || disabled === 'true';
  }

  /**
   * Get Current Cloud Formation Stack Name
   *
   * @returns {string} Cloud Formation Stack Name
   */
  getStackName() {
    return this.serverless.getProvider('aws').naming.getStackName();
  }

  /**
   * Get current serverless aws Region
   *
   * @returns {string} aws region
   */
  getRegion() {
    return this.serverless.getProvider('aws').getRegion();
  }

  /**
   * Get Serverless Service Name
   *
   * @returns {string} service name
   */
  getServiceName() {
    return this.serverless.service.getServiceName();
  }

  /**
   * Get current serverless stage
   *
   * @returns {string} stage (ex. develop, testing, production)
   */
  getStage() {
    return this.serverless.getProvider('aws').getStage();
  }

  /**
   * Get CloudFormation compilated template
   *
   * @returns {object} js config cloudformation
   */
  getCompiledTemplate() {
    return this.serverless.service.provider.compiledCloudFormationTemplate;
  }

  /**
   * Dispatch any plugin hook.
   *
   * @param {string} hook plugin hook ex. before:some:create
   * @returns {any}
   */
  async dispatchHook(hook) {
    return this.serverless.pluginManager.spawn(hook);
  }

  /**
   * Log to console
   *
   * @param {string} entity to log
   * @param {number} indent=0 indent to JSON stringify
   */
  log(entity, indent = 0) {
    if (!_.isEmpty(entity)) {
      const str = _.isObject(entity)
        ? JSON.stringify(entity, null, indent)
        : entity;

      this.serverless.cli.log(`${this.logPreffix} ${str}`);
    }
  }

  /**
   * Add Serverless Plugins to LifeCycle
   *
   * @param {object | array} oneOrMorePlugins one o more plugins
   * @param {boolean} afterMe = true add plugins after me
   */
  addPlugins(oneOrMorePlugins, afterMe = true) {
    const plugs = [].concat(oneOrMorePlugins);
    _.each(plugs, (p) => {
      this.serverless.pluginManager.addPlugin(p);

      // only when it is true
      if (afterMe === true) {
        const { plugins } = this.serverless.pluginManager;
        const lastIndex = plugins.length - 1;
        if (_.isFunction(plugins[lastIndex].asyncInit)) {
          plugins[lastIndex].asyncInit();
        }
      }
    });
  }

  /**
   * Get user config value.. from env,cmd-arg or serverless.yml value
   *
   * @param {string} field config field
   * @param {object} defaultValue=undefined value by default to return
   * @returns {object} return value
   */
  getConf(field, defaultValue = undefined) {
    /* eslint no-underscore-dangle: ["error", { "allow": ["__"] }] */
    const replaceDot = (char, key) => key.replace(/\./g, char);
    const fromEnv = (k) => process.env[k];
    const fromCmdArg = (k) => this.options[k];
    const fromYaml = (k) => _.get(this.serverless, `service.custom.${k}`);
    const checkVal = (v) => v !== undefined && v !== '';
    const fixVal = (v) => {
      if (v === 'false') return false;
      if (v === 'true') return true;
      return v;
    };

    let key = '';
    if (!_.isEmpty(this.useConfigPreffix)) {
      key = `${this.useConfigPreffix}.`;
    }
    key += field;

    let k = replaceDot('-', key);
    let val = fromCmdArg(k);
    if (checkVal(val)) return fixVal(val);

    k = replaceDot('_', key);
    val = fromEnv(k.toUpperCase());
    if (checkVal(val)) return fixVal(val);

    k = key;
    val = fromYaml(k);
    if (checkVal(val)) return fixVal(val);

    // if the caller function send one argument the field is required
    // if ... send two argument send default value when value is missing
    if (arguments.length === 1) {
      throw new Error(
        `Property value for '${key}' is missing. Please, check your serverless.yml'`
      );
    }

    return defaultValue;
  }

  /**
   * Inject default config to serverless custom config (util for inject pre-configured plugins)
   *
   * @param {object} config defaults config
   */
  addDefaultCustomConfig(config) {
    _.defaultsDeep(this.serverless.service, { custom: config });
  }

  /**
   * Inject default config to serverless provider config
   *
   * @param {object} config defaults config
   */
  addDefaultProviderConfig(config) {
    _.defaultsDeep(this.serverless.service, { provider: config });
  }

  /**
   * Merge resources to Cloud Formation Resources
   *
   * @param {array|object} resource resources to add
   */
  mergeCFormationResources(resource) {
    const resources = [].concat(resource);
    const cf = this.serverless.service.provider.compiledCloudFormationTemplate;
    const allUsrRes = _.get(this.serverless, 'service.resources.Resources', {});

    resources.forEach((res) => {
      // extends template base support
      if (!_.isEmpty(res.Resources)) {
        // iteration object resources keys
        _.forEach(res.Resources, (val, key) => {
          const baseRes = res.Resources[key];
          const usrRes = allUsrRes[key];
          // user can override all templates properties
          if (!_.isEmpty(usrRes)) {
            _.merge(baseRes, usrRes);
          }
        });

        _.merge(cf.Resources, res.Resources);
      }

      if (!_.isEmpty(res.Outputs)) {
        _.merge(cf.Outputs, res.Outputs);
      }
    });
  }
}

module.exports = BasePlugin;
