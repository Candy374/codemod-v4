// update import { Form } from 'cl-design' to import { Form } from ui-components

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

  function rewriteToCompatibleIcon(jsxElement) {
    // rename name to `LegacyIcon`
    jsxElement.openingElement.name.name = 'FormItem';
    jsxElement.openingElement.name.type = 'JSXIdentifier';
    if (jsxElement.closingElement) {
      jsxElement.closingElement.name.name = 'FormItem';
      jsxElement.closingElement.name.type = 'JSXIdentifier';
    }
  }

  function updateFormItemJsx(j, root) {
    let addImportFormItem = false;

    // change <Form.Item  to <FormItem
    root
      .find(j.JSXElement)
      .filter(
        path =>
          path.value?.openingElement?.name?.object?.name == 'Form' &&
          path.value?.openingElement?.name?.property.name == 'Item',
      )
      .filter(path => {
        rewriteToCompatibleIcon(path.node);
        addImportFormItem = true;
      });

    // remove const FormItem = Form.Item
    root
      .find(j.VariableDeclaration)
      .filter(path => {
        if (path.value.declarations[0]) {
          const { init } = path.value.declarations[0];
          if (init?.object?.name === 'Form' && init.property.name === 'Item') {
            return true;
          }
        }
        return false;
      })
      .forEach(path => {
        const localName = path.value.declarations[0].id.name;

        if (localName !== 'FormItem') {
          root
            .find(j.JSXElement)
            .filter(path => path.value?.openingElement?.name?.name == localName)
            .filter(path => {
              rewriteToCompatibleIcon(path.node);
            });
        }
        addImportFormItem = true;
      })
      .replaceWith();

    // remove const { Item } = Form
    // change <Item to <FormItem
    root
      .find(j.VariableDeclaration)
      .filter(path => {
        if (path.value.declarations[0]) {
          const { init, id } = path.value.declarations[0];
          if (
            init &&
            init.name === 'Form' &&
            id.properties.find(p => p.key?.name == 'Item')
          ) {
            return true;
          }
        }
        return false;
      })
      .forEach(path => {
        addImportFormItem = true;
        const localName = path.value.declarations[0].id.properties.find(
          p => p.key.name == 'Item',
        ).value.name;

        if (localName !== 'FormItem') {
          root
            .find(j.JSXElement)
            .filter(path => path.value?.openingElement?.name?.name == localName)
            .filter(path => {
              rewriteToCompatibleIcon(path.node);
            });
        }
      })
      .replaceWith();

    if (addImportFormItem) {
      addSubmoduleImport(j, root, {
        moduleName: '@prism/ui-components',
        importedName: 'FormItem',
        before: '@prism/ui-components',
      });
    }
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

        // add new import from '@prism/ui-components'
        const localComponentName = path.parent.node.local.name;
        addSubmoduleImport(j, root, {
          moduleName: '@prism/ui-components',
          importedName: importedComponentName,
          localName: localComponentName,
          before: antdPkgName,
        });
      });

    // updateFormItemJsx(j, root);

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
