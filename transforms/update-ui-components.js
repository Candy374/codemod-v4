// transform  antd to ui-components

// Tabs : Tabs.TabPane -> TabPane
// Menu : Menu.Item -> MenuItem
// Select : Select.Option -> SelectOption
// Input: Input.TextArea -> TextArea
// Radio: Radio.Group -> RadioGroup
// Form: Form.Item
// Dropdown: Dropdown.Button -> DropdownButton
// Checkbox: Checkbox.Group -> CheckboxGroup
// DatePicker: DatePicker.RangePicker -> RangePicker
// Descriptions
// AutoComplete
// Upload
// Timeline
// Collapse
// Tag
// Card  Card.Grid => CardGrid

const { printOptions } = require('./utils/config');
const {
  addSubmoduleImport,
  addStyleModuleImport,
  removeEmptyModuleImport,
  parseStrToArray,
} = require('./utils');
const { markDependency } = require('./utils/marker');

// parentName, childName, newName
const deprecatedComponentNameMap = [
  ['Tabs', 'TabPane', 'TabPane'],
  ['Menu', 'Item', 'MenuItem'],
  ['Select', 'Option', 'SelectOption'],
  ['Input', 'TextArea', 'TextArea'],
  ['Input', 'Group', 'InputGroup'],
  ['Input', 'Search', 'InputSearch'],
  ['Radio', 'Group', 'RadioGroup'],
  ['Radio', 'Button', 'RadioButton'],
  ['Form', 'Item', 'FormItem'],
  ['Dropdown', 'Button', 'DropdownButton'],
  ['Checkbox', 'Group', 'CheckboxGroup'],
  ['DatePicker', 'RangePicker', 'RangePicker'],
  ['Descriptions', 'Item', 'DescriptionsItem'],
  ['Upload', 'Dragger', 'UploadDragger'],
  ['Timeline', 'Item', 'TimelineItem'],
  ['Collapse', 'Panel', 'CollapsePanel'],
  ['Tag', 'CheckedTag', 'CheckedTag'],
  ['Card', 'Grid', 'CardGrid'],
  ['Form', 'Item', 'FormItem'],
];

const parentNames = deprecatedComponentNameMap.map(names => names[0]);

function updateFormItemJsx(
  j,
  root,
  parentCompName,
  childCompName,
  newCompName,
) {
  function replaceJsxName(jsxElement) {
    // rename name to `LegacyIcon`
    jsxElement.openingElement.name.name = newCompName;
    jsxElement.openingElement.name.type = 'JSXIdentifier';
    if (jsxElement.closingElement) {
      jsxElement.closingElement.name.name = newCompName;
      jsxElement.closingElement.name.type = 'JSXIdentifier';
    }
  }

  let addImportFormItem = false;

  // change <Form.Item  to <FormItem
  root
    .find(j.JSXElement)
    .filter(
      path =>
        path.value?.openingElement?.name?.object?.name == parentCompName &&
        path.value?.openingElement?.name?.property.name == childCompName,
    )
    .filter(path => {
      replaceJsxName(path.node);
      addImportFormItem = true;
    });

  // remove const FormItem = Form.Item
  root
    .find(j.VariableDeclaration)
    .filter(path => {
      if (path.value.declarations[0]) {
        const { init } = path.value.declarations[0];
        if (
          init?.object?.name === parentCompName &&
          init.property.name === childCompName
        ) {
          return true;
        }
      }
      return false;
    })
    .forEach(path => {
      const localName = path.value.declarations[0].id.name;

      if (localName !== newCompName) {
        root
          .find(j.JSXElement)
          .filter(path => path.value?.openingElement?.name?.name == localName)
          .filter(path => {
            replaceJsxName(path.node);
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
          init.name === parentCompName &&
          id.properties.find(p => p.key?.name == childCompName)
        ) {
          return true;
        }
      }
      return false;
    })
    .forEach(path => {
      addImportFormItem = true;
      const localName = path.value.declarations[0].id.properties.find(
        p => p.key.name == childCompName,
      ).value.name;

      if (localName !== newCompName) {
        root
          .find(j.JSXElement)
          .filter(path => path.value?.openingElement?.name?.name == localName)
          .filter(path => {
            replaceJsxName(path.node);
          });
      }
    })
    .replaceWith();

  if (addImportFormItem) {
    addSubmoduleImport(j, root, {
      moduleName: '@prism/ui-components',
      importedName: newCompName,
      before: '@prism/ui-components',
    });
  }
}

module.exports = (file, api, options) => {
  const j = api.jscodeshift;
  const root = j(file.source);
  const uiCompsPkgNames = parseStrToArray('@prism/ui-components');

  // import deprecated components from '@ant-design/compatible'
  function importDeprecatedComponent(j, root) {
    let hasChanged = false;

    // import { Form } from 'cl-design';
    root
      .find(j.Identifier)
      .filter(
        path =>
          parentNames.find(name => name == path.node.name) &&
          path.parent.node.type === 'ImportSpecifier' &&
          uiCompsPkgNames.includes(path.parent.parent.node.source.value),
      )
      .forEach(path => {
        hasChanged = true;
        const importedComponentName = path.parent.node.imported.name;
        const [
          parentCompName,
          childCompName,
          newCompName,
        ] = deprecatedComponentNameMap.find(
          names => names[0] == importedComponentName,
        );
        updateFormItemJsx(j, root, parentCompName, childCompName, newCompName);
      });

    return hasChanged;
  }

  // step1. import deprecated components from '@ant-design/compatible'
  // step2. cleanup antd import if empty
  let hasChanged = false;
  hasChanged = importDeprecatedComponent(j, root) || hasChanged;

  if (hasChanged) {
    uiCompsPkgNames.forEach(antdPkgName => {
      removeEmptyModuleImport(j, root, antdPkgName);
    });
  }

  return hasChanged
    ? root.toSource(options.printOptions || printOptions)
    : null;
};
