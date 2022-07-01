/**
 * if icons are from @convertlab/c-design-icons
 * change <Icon component={Icon32ContentIconBorder} alt="cl:kehu"
 *   to
 *   import { kehu } from '@convertlab/c-design-icons'
 *   <Icon component={kehu} />
 *
 *
 */

const { addIconRelatedMsg } = require('./utils/summary');
const { markDependency } = require('./utils/marker');
const { printOptions } = require('./utils/config');
const { getClIconName } = require('./utils/icon');
const {
  parseStrToArray,
  removeEmptyModuleImport,
  addSubmoduleImport,
  addModuleDefaultImport,
} = require('./utils');

module.exports = (file, api, options) => {
  const j = api.jscodeshift;
  const root = j(file.source);
  const antdPkgNames = parseStrToArray('@prism/ui-icons');

  function rewriteToSepcificCDesignIcon(j, root, { jsxElement, svgName }) {
    const node = jsxElement.openingElement;

    // remove props `type`
    node.attributes = node.attributes
      .filter(attr => !['type', 'alt', 'component'].includes(attr.name.name))
      .concat(
        j.jsxAttribute(
          j.jsxIdentifier('component'),
          j.jsxExpressionContainer(j.jsxIdentifier(svgName)),
        ),
      );
    // add a new import for v4 icon component
    addSubmoduleImport(j, root, {
      moduleName: '@convertlab/c-design-icons',
      importedName: svgName,
      before: '@ant-design/icons',
    });

    markDependency('@convertlab/c-design-icons');
    return true;
  }

  function removeImportIconBorder() {
    root
      .find(j.Identifier)
      .filter(
        path =>
          path.node.name === 'Icon32ContentIconBorder' &&
          path.parent.node.type === 'ImportSpecifier' &&
          antdPkgNames.includes(path.parent.parent.node.source.value),
      )
      .forEach(path => {
        const importDeclaration = path.parent.parent.node;
        // remove old imports
        importDeclaration.specifiers = importDeclaration.specifiers.filter(
          specifier =>
            !specifier.imported ||
            specifier.imported.name !== 'Icon32ContentIconBorder',
        );
      });
  }

  function findPrismIcon(j, root) {
    let hasChanged = false;
    root
      .find(j.Identifier)
      .filter(
        path =>
          path.node.name === 'Icon' &&
          path.parent.node.type === 'ImportSpecifier' &&
          path.parent.parent.node.source.value == '@ant-design/icons',
      )
      .forEach(path => {
        // find icons <Icon component={Icon32ContentIconBorder} alt="cl:kehu"
        root.findJSXElements('Icon').forEach(nodePath => {
          const jsxElement = nodePath.node;

          const node = jsxElement.openingElement;
          const componentAttr = node.attributes.find(
            attr => attr.name.name === 'component',
          );
          const typeAttr = node.attributes.find(
            attr => attr.name.name === 'alt' || attr.name.name === 'type',
          );
          const svgName = getClIconName(typeAttr.value.value);

          if (
            svgName &&
            componentAttr.value.expression.name === 'Icon32ContentIconBorder'
          ) {
            hasChanged = true;

            rewriteToSepcificCDesignIcon(j, root, {
              jsxElement,
              svgName,
            });

            // remove old imports
            removeImportIconBorder();
          }
        });
      });

    return hasChanged;
  }

  // step1:  find icons <Icon component={Icon32ContentIconBorder} alt="cl:kehu"
  // of
  // * find icons <Icon component={Icon32ContentIconBorder} type="cl:kehu"
  //  step2:
  // * change it to below if possible
  // *   import { kehu } from '@convertlab/c-design-icons'
  // *   <Icon component={kehu} />
  let hasChanged = false;
  hasChanged = findPrismIcon(j, root) || hasChanged;

  if (hasChanged) {
    antdPkgNames.forEach(antdPkgName => {
      removeEmptyModuleImport(j, root, antdPkgName);
    });
  }

  return hasChanged
    ? root.toSource(options.printOptions || printOptions)
    : null;
};
