// transform cl-design to antd
// translate Icon and compatible Form

const { printOptions } = require('./utils/config');
const {
  addSubmoduleImport,
  addStyleModuleImport,
  removeEmptyModuleImport,
  parseStrToArray,
} = require('./utils');
const { markDependency } = require('./utils/marker');

module.exports = (file, api, options) => {
  const j = api.jscodeshift;
  const root = j(file.source);
  const clDesignPkgNames = parseStrToArray('@convertlab/cl-design');

  // import deprecated components from '@ant-design/compatible'
  function importDeprecatedComponent(j, root) {
    let hasChanged = false;

    // import { Form, Mention } from 'antd';
    // import { Form, Mention } from '@forked/antd';
    root
      .find(j.Identifier)
      .filter(
        path =>
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
          moduleName: 'antd',
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
