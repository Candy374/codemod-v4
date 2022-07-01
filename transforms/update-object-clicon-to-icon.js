/**
 *   change icon: cl:kehu
 *   to
 *   import { kehu } from '@convertlab/c-design-icons'
 *   <Icon component={kehu} />
 *
 *    or
 *   <Icon component={Icon32ContentIconBorder} alt="cl:kehu"
 *
 */
/**
 *   change <LegacyIcon type="cl:kehu"
 *   to
 *   import { kehu } from '@convertlab/c-design-icons'
 *   <Icon component={kehu} />
 *
 *    or
 *   <Icon component={Icon32ContentIconBorder} alt="cl:kehu"
 *
 */

const { addIconRelatedMsg } = require('./utils/summary');
const { markDependency } = require('./utils/marker');
const { printOptions } = require('./utils/config');
const {
  getV4IconComponentName,
  createIconJSXElement,
  getClIconName,
} = require('./utils/icon');
const {
  parseStrToArray,
  removeEmptyModuleImport,
  addSubmoduleImport,
  addModuleDefaultImport,
} = require('./utils');

function addImportFromAntIcon(j, root, { before }) {
  // add @ant-design/icons imports
  addModuleDefaultImport(j, root, {
    moduleName: '@ant-design/icons',
    localName: 'Icon',
    before,
  });
}

module.exports = (file, api, options) => {
  const j = api.jscodeshift;
  const root = j(file.source);
  const antdPkgNames = parseStrToArray('@ant-design/compatible');

  // find icon: 'cl:xx'
  function replaceObjectIcon(j, root) {
    let hasChanged = false;
    let foundAnImport = false;
    root
      .find(j.Identifier)
      .filter(path => path.parent.node.type === 'ImportSpecifier')
      .forEach(path => {
        if (foundAnImport) {
          return;
        }

        const before = path.parent.parent.node.source.value;
        root
          .find(j.StringLiteral)
          .filter(path => {
            if (path.parent.value.type === 'ObjectProperty') {
              return path.parent.value.key.name === 'icon';
            }
          })
          .forEach(path => {
            const typeStr = path.parent.value.value.value;
            const svgName = getClIconName(typeStr);
            const v4IconComponentName = getV4IconComponentName(typeStr);

            if (svgName) {
              hasChanged = true;
              const iconJSXElement = createIconJSXElement(j, 'Icon');
              const node = iconJSXElement.openingElement;
              node.attributes = [
                j.jsxAttribute(
                  j.jsxIdentifier('component'),
                  j.jsxExpressionContainer(j.jsxIdentifier(svgName)),
                ),
              ];
              // we need a brace to wrap a jsxElement to pass Icon prop
              path.parent.value.value = iconJSXElement;

              addImportFromAntIcon(j, root, { before });
              addSubmoduleImport(j, root, {
                moduleName: '@convertlab/c-design-icons',
                importedName: svgName,
                before,
              });
            } else if (v4IconComponentName) {
              hasChanged = true;
              const iconJSXElement = createIconJSXElement(
                j,
                v4IconComponentName,
              );
              // we need a brace to wrap a jsxElement to pass Icon prop
              path.parent.value.value = iconJSXElement;

              addSubmoduleImport(j, root, {
                moduleName: '@ant-design/icons',
                importedName: v4IconComponentName,
                before,
              });
            } else if (typeStr) {
              hasChanged = true;
              const iconJSXElement = createIconJSXElement(j, 'Icon');
              const iconName = 'Icon32ContentIconBorder';
              const node = iconJSXElement.openingElement;
              node.attributes = [
                j.jsxAttribute(
                  j.jsxIdentifier('component'),
                  j.jsxExpressionContainer(j.jsxIdentifier(iconName)),
                ),
                j.jsxAttribute(
                  j.jsxIdentifier('alt'),
                  j.jsxExpressionContainer(j.jsxIdentifier(typeStr)),
                ),
              ];

              // we need a brace to wrap a jsxElement to pass Icon prop
              path.parent.value.value = iconJSXElement;

              addSubmoduleImport(j, root, {
                moduleName: '@prism/ui-icons',
                importedName: iconName,
                before,
              });

              markDependency('@prism/ui-icons');

              addImportFromAntIcon(j, root, { before });
            }
          });
      });

    return hasChanged;
  }

  let hasChanged = false;
  hasChanged = replaceObjectIcon(j, root) || hasChanged;

  if (hasChanged) {
    antdPkgNames.forEach(antdPkgName => {
      removeEmptyModuleImport(j, root, antdPkgName);
    });
  }

  return hasChanged
    ? root.toSource(options.printOptions || printOptions)
    : null;
};
