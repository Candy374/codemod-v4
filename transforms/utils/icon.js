const path = require('path');
const fs = require('fs');

const {
  withThemeSuffix,
  removeTypeTheme,
  alias,
} = require('./compatible-icon-utils');

const v4IconModulePath = path.dirname(
  require.resolve('@ant-design/icons/lib/icons'),
);

let allV4Icons = [];
function getAllV4IconNames() {
  if (allV4Icons.length) {
    return allV4Icons;
  }

  const files = fs.readdirSync(v4IconModulePath);
  // read allIcons by fs exclude index.js
  allV4Icons = files
    .filter(
      filePath =>
        path.extname(filePath) === '.js' &&
        path.basename(filePath, '.js') !== 'index',
    )
    .map(filePath => path.basename(filePath, '.js'));
  return allV4Icons;
}

let clIcons = [];
function getClIconNames() {
  if (clIcons.length) {
    return clIcons;
  }

  const pathString = path
    .dirname(require.resolve('@convertlab/c-design-icons'))
    .replace('dist', 'src/svg');

  const files = fs.readdirSync(pathString);
  // read allIcons by fs exclude index.js
  clIcons = files
    .filter(filePath => path.extname(filePath) === '.svg')
    .map(filePath => path.basename(filePath, '.svg'));
  return clIcons;
}

function getClIconName(type) {
  if (!type?.startsWith('cl:')) {
    return;
  }

  const componentName = type.replace('cl:', '');
  const clIcons = getClIconNames();

  // check if component is valid or not in v4 icons
  if (clIcons.includes(componentName)) {
    return componentName;
  }

  console.warn(
    `The icon name '${type}' cannot found, use Icon32ContentIconBorder as a placeholder`,
  );
  return '';
}

function getV4IconComponentName(type, theme) {
  const v4IconComponentName = withThemeSuffix(
    removeTypeTheme(alias(type)),
    theme || 'outlined',
  );

  const v4Icons = getAllV4IconNames();

  // check if component is valid or not in v4 icons
  if (v4Icons.includes(v4IconComponentName)) {
    return v4IconComponentName;
  }

  console.warn(
    `The icon name '${type}'${
      theme ? ` with ${theme}` : ''
    } cannot found, please check it at https://ant.design/components/icon`,
  );
  return '';
}

function createIconJSXElement(j, iconLocalName, attrs = []) {
  const openingElement = j.jsxOpeningElement(
    j.jsxIdentifier(iconLocalName),
    attrs,
  );
  openingElement.selfClosing = true;
  return j.jsxElement(openingElement);
}

module.exports = {
  getAllV4IconNames,
  getV4IconComponentName,
  createIconJSXElement,
  getClIconName,
};
