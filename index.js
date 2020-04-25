const _ = require('lodash');
const R = require('ramda');

class BasePlugin {
  /**
   * Base Plugin Constructor
   *
   * @param {object} serverless Serverless instance
   * @param {object} options object
   * @param {string} logPreffix console log preffixer
   * @param {string} usrCustomConfig Serverless yml root key user config
   */
  constructor(serverless, options, logPreffix, usrCustomConfig) {
    this.options = options;
    this.serverless = serverless;
    this.logPreffix = logPreffix;
    this.usrCustomConfig = usrCustomConfig;
  }

  /**
   * Check plugin for disabled state
   *
   * @returns {boolean} if plugin is disabled based on user config
   */
  isPluginDisabled() {
    const disabled = this.getConf('disabled', false, false);
    return (_.isBoolean(disabled) && disabled) || disabled === 'true';
  }

  /**
   * Log to console
   * @param {string} entity to log
   */
  log(entity) {
    const str = R.when(R.is(Object), JSON.stringify, entity);
    this.serverless.cli.log(`${this.logPreffix} ${str}`);
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
    const replaceDotPath = R.replace(/\./g, R.__);
    const fromEnv = (k) => process.env[k];
    const fromCmdArg = (k) => this.options[k];
    const fromYaml = (k) => _.get(this.serverless, `service.custom.${k}`);
    const checkVal = (v) => v !== undefined && v !== '';
    const fixVal = (v) => {
      if (v === 'false') return false;
      if (v === 'true') return true;
      return v;
    };

    const key = `${this.usrCustomConfig}.${field}`;

    let k = replaceDotPath('-')(key);
    let val = fromCmdArg(k);
    if (checkVal(val)) return fixVal(val);

    k = replaceDotPath('_')(key);
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
}

module.exports = BasePlugin;
