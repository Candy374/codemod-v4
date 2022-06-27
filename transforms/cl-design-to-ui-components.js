// transform Form to ui-components

const { printOptions } = require('./utils/config');
const {
  addSubmoduleImport,
  addStyleModuleImport,
  removeEmptyModuleImport,
  parseStrToArray,
} = require('./utils');
const { markDependency } = require('./utils/marker');

const deprecatedComponentNames = ['Form'];

module.exports = (file, api, options) => {
  const j = api.jscodeshift;
  const root = j(file.source);
  const clDesignPkgNames = parseStrToArray('@convertlab/cl-design');

  function hasFormCreate() {
    // has usage of Form.create()
    const functionCalls = root
      .find(j.CallExpression)
      .filter(
        path =>
          path.node.callee.object &&
          path.node.callee.object.name == 'Form' &&
          path.node.callee.property &&
          path.node.callee.property.name == 'create',
      );

    return functionCalls.length > 0;
  }
  // import deprecated components from '@ant-design/compatible'
  function importDeprecatedComponent(j, root) {
    let hasChanged = false;

    if (hasFormCreate(root)) {
      return true;
    }

    // import { Form } from 'cl-design';
    root
      .find(j.Identifier)
      .filter(
        path =>
          deprecatedComponentNames.includes(path.node.name) &&
          path.parent.node.type === 'ImportSpecifier' &&
          clDesignPkgNames.includes(path.parent.parent.node.source.value),
      )
      .forEach(path => {
        hasChanged = true;
        const importedComponentName = path.parent.node.imported.name;
        const antdPkgName = path.parent.parent.node.source.value;

        // remove old imports
        const importDeclaration = path.parent.parent.node;
        importDeclaration.specifiers = importDeclaration.specifiers.filter(
          specifier =>
            !specifier.imported ||
            specifier.imported.name !== importedComponentName,
        );

        // add new import from '@convertlab/uilib'
        const localComponentName = path.parent.node.local.name;
        addSubmoduleImport(j, root, {
          moduleName: '@prism/ui-components',
          importedName: importedComponentName,
          localName: localComponentName,
          before: antdPkgName,
        });
      });

    return hasChanged;
  }

  // step1. import deprecated components from '@ant-design/compatible'
  // step2. cleanup antd import if empty
  let hasChanged = false;
  hasChanged = importDeprecatedComponent(j, root) || hasChanged;

  if (hasChanged) {
    clDesignPkgNames.forEach(antdPkgName => {
      removeEmptyModuleImport(j, root, antdPkgName);
    });
  }

  return hasChanged
    ? root.toSource(options.printOptions || printOptions)
    : null;
};
