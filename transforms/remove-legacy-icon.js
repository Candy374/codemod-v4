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

  function rewriteToSepcificCDesignIcon(
    j,
    root,
    { jsxElement, before, svgName },
  ) {
    const node = jsxElement.openingElement;

    node.name.name = 'Icon';
    if (jsxElement.closingElement) {
      jsxElement.closingElement.name.name = 'Icon';
    }

    // remove props `type`
    node.attributes = node.attributes
      .filter(attr => !['type'].includes(attr.name.name))
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
      before,
    });

    markDependency('@convertlab/c-design-icons');
    return true;
  }

  function rewriteToPrismIcon(j, root, { jsxElement, before }) {
    const node = jsxElement.openingElement;

    node.name.name = 'Icon';
    if (jsxElement.closingElement) {
      jsxElement.closingElement.name.name = 'Icon';
    }

    const iconName = 'Icon32ContentIconBorder';
    // remove props `type`
    node.attributes = node.attributes
      .map(attr => {
        if (attr.name.name === 'type') {
          attr.name.name = 'alt';
        }

        return attr;
      })
      .concat(
        j.jsxAttribute(
          j.jsxIdentifier('component'),
          j.jsxExpressionContainer(j.jsxIdentifier(iconName)),
        ),
      );

    // add a new import for v4 icon component
    addSubmoduleImport(j, root, {
      moduleName: '@prism/ui-icons',
      importedName: iconName,
      before,
    });

    markDependency('@prism/ui-icons');
    return true;
  }

  function rewriteToV4Icon(
    j,
    root,
    { v4IconComponentName, jsxElement, before },
  ) {
    const node = jsxElement.openingElement;

    node.name.name = v4IconComponentName;
    if (jsxElement.closingElement) {
      jsxElement.closingElement.name.name = v4IconComponentName;
    }

    // remove props `type`
    node.attributes = node.attributes.filter(attr => attr.name.name !== 'type');

    // add a new import for v4 icon component
    addSubmoduleImport(j, root, {
      moduleName: '@ant-design/icons',
      importedName: v4IconComponentName,
      before,
    });
    return true;
  }

  function rewriteOldIconImport(j, root, { localName, before }) {
    // 1. 找到   import { Icon as LegacyIcon } from '@ant-design/compatible' <Icon type="cl:xx" />
    // 改写为
    // import Icon from '@convertlab/c-design-icons'
    // import Icon from '@ant-design/icons';  <Icon component={xx} />

    let hasChanged = false;
    root.findJSXElements(localName).forEach(nodePath => {
      const jsxElement = nodePath.node;

      const node = jsxElement.openingElement;
      const typeAttr = node.attributes.find(attr => attr.name.name === 'type');

      if (typeAttr.value.type !== 'StringLiteral') {
        return;
      }

      const componentAttr = node.attributes.find(
        attr => attr.name.name === 'component',
      );
      const svgName = getClIconName(typeAttr.value.value);
      const v4IconComponentName = getV4IconComponentName(typeAttr.value.value);

      if (svgName) {
        rewriteToSepcificCDesignIcon(j, root, {
          jsxElement,
          svgName,
          before,
        });
        hasChanged = true;
      } else if (v4IconComponentName) {
        rewriteToV4Icon(j, root, {
          jsxElement,
          v4IconComponentName,
          before,
        });
        hasChanged = true;
      } else if (
        componentAttr?.value.expression?.name !== 'Icon32ContentIconBorder'
      ) {
        rewriteToPrismIcon(j, root, { jsxElement, before });
        hasChanged = true;
      }
    });
    return hasChanged;
  }

  // remove Icon import from @ant-design/compatible
  function removeAntdIconImport(j, root) {
    let hasChanged = false;

    // import { Icon } from '@ant-design/compatible';
    // import { Icon as Legacy } from '@ant-design/compatible';
    root
      .find(j.Identifier)
      .filter(
        path =>
          path.node.name === 'Icon' &&
          path.parent.node.type === 'ImportSpecifier' &&
          antdPkgNames.includes(path.parent.parent.node.source.value),
      )
      .forEach(path => {
        const localComponentName = path.parent.node.local.name;
        const antdPkgName = path.parent.parent.node.source.value;

        hasChanged = rewriteOldIconImport(j, root, {
          localName: localComponentName,
          before: antdPkgName,
        });

        if (hasChanged) {
          const importDeclaration = path.parent.parent.node;
          // remove old imports
          importDeclaration.specifiers = importDeclaration.specifiers.filter(
            specifier =>
              !specifier.imported || specifier.imported.name !== 'Icon',
          );

          addImportFromAntIcon(j, root, { before: antdPkgName });
        }
      });

    return hasChanged;
  }

  // step1. remove Icon import from @ant-design/compatible
  // step2. determine whether use @prism/ui-icons or '@convertlab/c-design-icons'
  // step3.1 add Icon import from @ant-design/icons
  // step3.2 add specific icon component import from  @prism/ui-icons or '@convertlab/c-design-icons'
  // step4. cleanup antd import if empty
  let hasChanged = false;
  hasChanged = removeAntdIconImport(j, root) || hasChanged;

  if (hasChanged) {
    antdPkgNames.forEach(antdPkgName => {
      removeEmptyModuleImport(j, root, antdPkgName);
    });
  }

  return hasChanged
    ? root.toSource(options.printOptions || printOptions)
    : null;
};
