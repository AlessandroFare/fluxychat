/**
 * P22-C2: Card JSX Runtime
 * Adapted from Vercel Chat SDK's jsx-runtime.ts.
 *
 * Custom JSX runtime for chat cards that allows using JSX syntax without React.
 * Configure your bundler:
 *
 * tsconfig.json:
 * {
 *   "compilerOptions": {
 *     "jsx": "react-jsx",
 *     "jsxImportSource": "@fluxychat/worker"
 *   }
 * }
 *
 * Or per-file:
 * /** @jsxImportSource @fluxychat/worker *\/
 *
 * Usage:
 * ```jsx
 * import { Card, Text, Button, Actions } from "@fluxychat/worker/lib/jsx-runtime.js";
 *
 * const card = (
 *   <Card title="Order #1234">
 *     <Text>Your order is ready!</Text>
 *     <Actions>
 *       <Button id="pickup" style="primary">Schedule Pickup</Button>
 *     </Actions>
 *   </Card>
 * );
 * ```
 */

import {
  Card as CardFn,
  Text as TextFn,
  Button as ButtonFn,
  LinkButton as LinkButtonFn,
  Image as ImageFn,
  Divider as DividerFn,
  Actions as ActionsFn,
  Section as SectionFn,
  Field as FieldFn,
  Fields as FieldsFn,
  Table as TableFn,
} from "./cards.js";

// Symbol to identify our JSX elements before they're processed
const JSX_ELEMENT = Symbol.for("chat.jsx.element");

// ============================================================================
// JSX Props Types
// ============================================================================

/** @typedef {import('./cards.js').ButtonStyle} ButtonStyle */
/** @typedef {import('./cards.js').TextStyle} TextStyle */

/** @typedef {Object} CardProps
 * @property {unknown} [children]
 * @property {string} [title]
 * @property {string} [subtitle]
 * @property {string} [imageUrl]
 */

/** @typedef {Object} TextProps
 * @property {string|number|Array<string|number|undefined>} [children]
 * @property {TextStyle} [style]
 */

/** @typedef {Object} ButtonProps
 * @property {string} id
 * @property {string} [label]
 * @property {string|number|Array<string|number|undefined>} [children]
 * @property {ButtonStyle} [style]
 * @property {'action'|'modal'} [actionType]
 * @property {string} [value]
 * @property {string} [callbackUrl]
 * @property {boolean} [disabled]
 */

/** @typedef {Object} LinkButtonProps
 * @property {string} url
 * @property {string} [label]
 * @property {string|number|Array<string|number|undefined>} [children]
 * @property {ButtonStyle} [style]
 * @property {string} [id]
 */

/** @typedef {Object} ImageProps
 * @property {string} url
 * @property {string} [alt]
 */

/** @typedef {Object} FieldProps
 * @property {string} label
 * @property {string} value
 */

/** @typedef {Object} ContainerProps
 * @property {unknown} [children]
 */

/** @typedef {Object} TableProps
 * @property {string[]} headers
 * @property {string[][]} rows
 */

/** @typedef {CardProps|TextProps|ButtonProps|LinkButtonProps|ImageProps|FieldProps|ContainerProps|TableProps} CardJSXProps */

// ============================================================================
// JSX Element Type
// ============================================================================

/**
 * Represents a JSX element from the chat JSX runtime.
 * @typedef {Object} CardJSXElement
 * @property {typeof JSX_ELEMENT} $$typeof
 * @property {unknown[]} children
 * @property {CardJSXProps} props
 * @property {Function} type
 */

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a value is a JSX element from our runtime.
 * @param {unknown} value
 * @returns {value is CardJSXElement}
 */
function isJSXElement(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    value.$$typeof === JSX_ELEMENT
  );
}

/**
 * Process children, converting JSX elements to card elements.
 * @param {unknown} children
 * @returns {unknown[]}
 */
function processChildren(children) {
  if (children == null) {
    return [];
  }

  if (Array.isArray(children)) {
    return children.flatMap(processChildren);
  }

  // If it's a JSX element, resolve it
  if (isJSXElement(children)) {
    const resolved = resolveJSXElement(children);
    if (resolved) {
      return [resolved];
    }
    return [];
  }

  // If it's already a card element, return it
  if (typeof children === "object" && "type" in children) {
    return [children];
  }

  // If it's a string or number, it might be text content for a Button or Text
  if (typeof children === "string" || typeof children === "number") {
    return [String(children)];
  }

  return [];
}

/**
 * Resolve a JSX element by calling its component function.
 * @param {CardJSXElement} element
 * @returns {unknown}
 */
function resolveJSXElement(element) {
  const { type, props, children } = element;

  // Process children first
  const processedChildren = processChildren(children);

  // Use identity comparison to determine which builder function this is
  if (type === TextFn) {
    // Text(content: string, options?: { style })
    const content =
      processedChildren.length > 0
        ? processedChildren.map(String).join("")
        : String(props.children ?? "");
    return TextFn({ content, style: props.style });
  }

  if (type === SectionFn) {
    // Section takes array as first argument
    return SectionFn({ children: processedChildren });
  }

  if (type === ActionsFn) {
    // Actions takes array of button/link-button elements
    return ActionsFn({ children: processedChildren });
  }

  if (type === FieldsFn) {
    // Fields takes array of field elements
    return FieldsFn({ children: processedChildren });
  }

  if (type === ButtonFn) {
    // Button(options)
    const label =
      props.label ||
      (processedChildren.length > 0
        ? processedChildren.map(String).join("")
        : String(props.children ?? ""));
    return ButtonFn({
      id: props.id,
      label,
      style: props.style,
      actionType: props.actionType,
      value: props.value,
      callbackUrl: props.callbackUrl,
      disabled: props.disabled,
    });
  }

  if (type === LinkButtonFn) {
    // LinkButton(options)
    const label =
      props.label ||
      (processedChildren.length > 0
        ? processedChildren.map(String).join("")
        : String(props.children ?? ""));
    return LinkButtonFn({
      url: props.url,
      label,
      style: props.style,
      id: props.id,
    });
  }

  if (type === CardFn) {
    // Card(options)
    return CardFn({
      title: props.title,
      subtitle: props.subtitle,
      imageUrl: props.imageUrl,
      children: processedChildren,
    });
  }

  if (type === ImageFn) {
    // Image(options)
    return ImageFn({ url: props.url, alt: props.alt });
  }

  if (type === DividerFn) {
    // Divider()
    return DividerFn();
  }

  if (type === FieldFn) {
    // Field(options)
    return FieldFn({ label: props.label, value: props.value });
  }

  if (type === TableFn) {
    // Table(options)
    return TableFn({ headers: props.headers, rows: props.rows });
  }

  // Unknown component - return null
  return null;
}

// ============================================================================
// JSX Factory Functions
// ============================================================================

/**
 * JSX element factory (jsxs) - for elements with multiple children.
 * @param {Function} type - Component function
 * @param {CardJSXProps} props - Component props
 * @param {...unknown} children - Child elements
 * @returns {CardJSXElement}
 */
export function jsxs(type, props, ...children) {
  return {
    $$typeof: JSX_ELEMENT,
    type,
    props,
    children: children.flat(),
  };
}

/**
 * JSX element factory (jsx) - for elements with single child.
 * @param {Function} type - Component function
 * @param {CardJSXProps} props - Component props
 * @returns {CardJSXElement}
 */
export function jsx(type, props) {
  return {
    $$typeof: JSX_ELEMENT,
    type,
    props,
    children: props.children != null ? [props.children].flat() : [],
  };
}

/**
 * Fragment component - groups children without adding a wrapper element.
 * @param {Object} props
 * @param {unknown} props.children
 * @returns {unknown[]}
 */
export function Fragment({ children }) {
  return processChildren(children);
}

// ============================================================================
// Component Exports (for JSX import)
// ============================================================================

export { CardFn as Card };
export { TextFn as Text };
export { ButtonFn as Button };
export { LinkButtonFn as LinkButton };
export { ImageFn as Image };
export { DividerFn as Divider };
export { ActionsFn as Actions };
export { SectionFn as Section };
export { FieldFn as Field };
export { FieldsFn as Fields };
export { TableFn as Table };

// Re-export resolveJSXElement for external use
export { resolveJSXElement };
