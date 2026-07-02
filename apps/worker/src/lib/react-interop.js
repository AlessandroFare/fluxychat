/**
 * P22-C4: React Element Interop
 * Adapted from Vercel Chat SDK's fromReactElement().
 *
 * Allows React components to produce CardElements for server-side rendering.
 * Converts React element trees to CardElements via a componentMap.
 *
 * Usage:
 * ```js
 * import { fromReactElement } from "./react-interop.js";
 *
 * const reactElement = (
 *   <div>
 *     <h1>Welcome</h1>
 *     <button onClick={() => console.log("clicked")}>Click me</button>
 *   </div>
 * );
 *
 * const cardElement = fromReactElement(reactElement, {
 *   div: (props) => ({ type: "section", children: props.children }),
 *   h1: (props) => ({ type: "text", content: props.children.join(""), style: "bold" }),
 *   button: (props) => ({ type: "button", id: "click", label: props.children.join("") }),
 * });
 * ```
 */

// =============================================================================
// Types
// =============================================================================

/**
 * @typedef {Object} ReactElement
 * @property {string|Function} type - Element type (string tag or component function)
 * @property {Object} [props] - Element props
 * @property {ReactElement|ReactElement[]} [children] - Child elements
 */

/**
 * @typedef {Object} ComponentMap
 * @property {Record<string, (props: Object, children: unknown[]) => unknown>} [tags] - HTML tag handlers
 * @property {Record<Function, (props: Object, children: unknown[]) => unknown>} [components] - Component handlers
 */

/**
 * @typedef {Object} FromReactElementOptions
 * @property {ComponentMap} [componentMap] - Custom component mappings
 * @property {(element: ReactElement) => unknown} [fallback] - Fallback handler for unknown elements
 */

// =============================================================================
// React Element Interop
// =============================================================================

/**
 * Check if a value is a React element.
 * @param {unknown} value
 * @returns {value is ReactElement}
 */
export function isReactElement(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    "$$typeof" in value &&
    (typeof value.$$typeof === "symbol" || typeof value.$$typeof === "function")
  );
}

/**
 * Convert React children to an array.
 * @param {unknown} children
 * @returns {unknown[]}
 */
function ReactChildrenToArray(children) {
  if (children == null) {
    return [];
  }
  if (Array.isArray(children)) {
    return children.flatMap(ReactChildrenToArray);
  }
  if (typeof children === "string" || typeof children === "number") {
    return [children];
  }
  if (isReactElement(children)) {
    return [children];
  }
  return [];
}

/**
 * Resolve a React element tree to a card element.
 * @param {ReactElement} element - React element to convert
 * @param {FromReactElementOptions} [options] - Conversion options
 * @returns {unknown} Card element or null
 */
export function fromReactElement(element, options = {}) {
  const { componentMap, fallback } = options;

  if (!isReactElement(element)) {
    // Not a React element, return as-is
    return element;
  }

  const { type, props = {} } = element;
  const children = ReactChildrenToArray(props.children);

  // Resolve children first
  const resolvedChildren = children.map((child) =>
    isReactElement(child) ? fromReactElement(child, options) : child
  );

  // Check component map for custom handlers
  if (componentMap) {
    // Check tag handlers
    if (typeof type === "string" && componentMap.tags?.[type]) {
      return componentMap.tags[type](props, resolvedChildren);
    }

    // Check component handlers
    if (typeof type === "function" && componentMap.components?.[type]) {
      return componentMap.components[type](props, resolvedChildren);
    }
  }

  // Built-in HTML tag handlers
  if (typeof type === "string") {
    return resolveHTMLTag(type, props, resolvedChildren);
  }

  // Component function - call it
  if (typeof type === "function") {
    try {
      const result = type({ ...props, children: resolvedChildren });
      if (isReactElement(result)) {
        return fromReactElement(result, options);
      }
      return result;
    } catch {
      // Component threw, use fallback
      if (fallback) {
        return fallback(element);
      }
      return null;
    }
  }

  // Unknown type, use fallback
  if (fallback) {
    return fallback(element);
  }

  return null;
}

/**
 * Resolve an HTML tag to a card element.
 * @param {string} tag - HTML tag name
 * @param {Object} props - Tag props
 * @param {unknown[]} children - Resolved children
 * @returns {unknown}
 */
function resolveHTMLTag(tag, props, children) {
  switch (tag) {
    case "div":
    case "section":
      // Convert to section element
      return {
        type: "section",
        children: children.filter(
          (c) =>
            typeof c === "object" &&
            c !== null &&
            "type" in c
        ),
      };

    case "p":
    case "span":
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      // Convert to text element
      const textContent = children
        .filter((c) => typeof c === "string" || typeof c === "number")
        .join("");
      return {
        type: "text",
        content: textContent,
        style: ["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)
          ? "bold"
          : undefined,
      };

    case "button":
      // Convert to button element
      const buttonLabel = children
        .filter((c) => typeof c === "string" || typeof c === "number")
        .join("");
      return {
        type: "button",
        id: props.id || "button",
        label: buttonLabel,
        style: props.className?.includes("primary") ? "primary" : undefined,
        disabled: props.disabled,
      };

    case "a":
      // Convert to link button element
      const linkLabel = children
        .filter((c) => typeof c === "string" || typeof c === "number")
        .join("");
      return {
        type: "link-button",
        url: props.href || "#",
        label: linkLabel,
        style: props.className?.includes("primary") ? "primary" : undefined,
      };

    case "img":
      // Convert to image element
      return {
        type: "image",
        url: props.src || "",
        alt: props.alt,
      };

    case "hr":
      // Convert to divider element
      return { type: "divider" };

    case "ul":
    case "ol":
      // Convert to text element with list
      const listText = children
        .filter((c) => typeof c === "string" || typeof c === "number")
        .join("\n");
      return {
        type: "text",
        content: listText,
      };

    case "li":
      // Convert to text element
      const liText = children
        .filter((c) => typeof c === "string" || typeof c === "number")
        .join("");
      return {
        type: "text",
        content: `• ${liText}`,
      };

    case "table":
      // Convert to table element if structured correctly
      const rows = [];
      let headers = [];
      for (const child of children) {
        if (typeof child === "object" && child !== null) {
          if (child.type === "thead") {
            // Extract headers
            const headerCells = child.children || [];
            headers = headerCells
              .filter((c) => typeof c === "string" || typeof c === "number")
              .map(String);
          } else if (child.type === "tbody") {
            // Extract rows
            const rowElements = child.children || [];
            for (const row of rowElements) {
              if (typeof row === "object" && row !== null) {
                const cells = row.children || [];
                rows.push(
                  cells
                    .filter((c) => typeof c === "string" || typeof c === "number")
                    .map(String)
                );
              }
            }
          }
        }
      }
      if (headers.length > 0 || rows.length > 0) {
        return { type: "table", headers, rows };
      }
      return null;

    default:
      // Unknown tag, return children as-is
      return children.length === 1 ? children[0] : children;
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Create a component map from a record of tag handlers.
 * @param {Record<string, (props: Object, children: unknown[]) => unknown>} tags
 * @returns {ComponentMap}
 */
export function createComponentMap(tags) {
  return { tags };
}

/**
 * Create a default component map for common HTML tags.
 * @returns {ComponentMap}
 */
export function createDefaultComponentMap() {
  return createComponentMap({
    div: (props, children) => ({
      type: "section",
      children: children.filter(
        (c) => typeof c === "object" && c !== null && "type" in c
      ),
    }),
    p: (props, children) => ({
      type: "text",
      content: children
        .filter((c) => typeof c === "string" || typeof c === "number")
        .join(""),
    }),
    button: (props, children) => ({
      type: "button",
      id: props.id || "button",
      label: children
        .filter((c) => typeof c === "string" || typeof c === "number")
        .join(""),
      disabled: props.disabled,
    }),
    a: (props, children) => ({
      type: "link-button",
      url: props.href || "#",
      label: children
        .filter((c) => typeof c === "string" || typeof c === "number")
        .join(""),
    }),
    img: (props) => ({
      type: "image",
      url: props.src || "",
      alt: props.alt,
    }),
    hr: () => ({ type: "divider" }),
  });
}
