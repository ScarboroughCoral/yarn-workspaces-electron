// Setup needed for yarn workspaces
const rewireYarnWorkspaces = require('react-app-rewire-yarn-workspaces');

module.exports = function override(config, env) {
  config.target='electron-renderer'
  return rewireYarnWorkspaces(config, env);
};
