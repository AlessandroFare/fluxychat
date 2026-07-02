/**
 * P22-C1: Card Element Builder
 * Adapted from Vercel Chat SDK's cards.ts for FluxyChat.
 * Updated P26-A-3: Card implements PostableObject interface.
 *
 * Provides a builder API for creating rich cards that automatically
 * convert to platform-specific formats:
 * - Web: JSON card data rendered by dashboard components
 * - Slack: Block Kit
 * - Teams: Adaptive Cards
 * - WhatsApp: Interactive message templates
 *
 * Supports both function-call and JSX syntax (JSX requires jsxImportSource).
 *
 * @example Function API
 * ```js
 * import { Card, Text, Actions, Button } from "./cards.js";
 *
 * const card = Card({
 *   title: "Order #1234",
 *   children: [
 *     Text({ content: "Total: $50.00" }),
 *     Actions({ children: [
 *       Button({ id: "approve", label: "Approve", style: "primary" }),
 *       Button({ id: "reject", label: "Reject", style: "danger" }),
 *     ]}),
 *   ],
 * });
 * ```
 */

import { POSTABLE_OBJECT } from "./postable-object.js";

// =============================================================================
// Element Types
// =============================================================================

/** @typedef {'primary' | 'danger' | 'default'} ButtonStyle */
/** @typedef {'plain' | 'bold' | 'muted'} TextStyle */
/** @typedef {'left' | 'center' | 'right'} TableAlignment */
/** @typedef {'action' | 'modal'} ActionType */

/**
 * @typedef {Object} ButtonElement
 * @property {'button'} type
 * @property {string} id - Unique action ID for callback routing
 * @property {string} label - Button label text
 * @property {ButtonStyle} [style] - Visual style
 * @property {ActionType} [actionType] - Action or modal trigger
 * @property {string} [value] - Payload sent with action callback
 * @property {string} [callbackUrl] - URL to POST action data to
 * @property {boolean} [disabled] - Whether button is inactive
 */

/**
 * @typedef {Object} LinkButtonElement
 * @property {'link-button'} type
 * @property {string} url - URL to open
 * @property {string} label - Button label text
 * @property {ButtonStyle} [style] - Visual style
 * @property {string} [id] - Optional action identifier
 */

/**
 * @typedef {Object} TextElement
 * @property {'text'} type
 * @property {string} content - Text content (supports markdown)
 * @property {TextStyle} [style] - Text style
 */

/**
 * @typedef {Object} ImageElement
 * @property {'image'} type
 * @property {string} url - Image URL
 * @property {string} [alt] - Alt text for accessibility
 */

/**
 * @typedef {Object} DividerElement
 * @property {'divider'} type
 */

/**
 * @typedef {Object} ActionsElement
 * @property {'actions'} type
 * @property {Array<ButtonElement|LinkButtonElement>} children - Action elements
 */

/**
 * @typedef {Object} SectionElement
 * @property {'section'} type
 * @property {Array<CardChild>} children - Section children
 */

/**
 * @typedef {Object} FieldElement
 * @property {'field'} type
 * @property {string} label - Field label
 * @property {string} value - Field value
 */

/**
 * @typedef {Object} FieldsElement
 * @property {'fields'} type
 * @property {FieldElement[]} children - Field elements
 */

/**
 * @typedef {Object} LinkElement
 * @property {'link'} type
 * @property {string} url - URL
 * @property {string} label - Link label
 */

/**
 * @typedef {Object} TableElement
 * @property {'table'} type
 * @property {string[]} headers - Column headers
 * @property {string[][]} rows - Data rows
 * @property {TableAlignment[]} [align] - Column alignment
 */

/**
 * @typedef {Object} CardElement
 * @property {'card'} type
 * @property {string} [title] - Card title
 * @property {string} [subtitle] - Card subtitle
 * @property {string} [imageUrl] - Header image URL
 * @property {Array<CardChild>} children - Card content
 */

/**
 * Union of all card child element types
 * @typedef {TextElement|ImageElement|DividerElement|ActionsElement|SectionElement|FieldsElement|LinkElement|TableElement} CardChild
 */

// =============================================================================
// Builder Functions
// =============================================================================

/**
 * Create a card element.
 * Implements the PostableObject interface (P26-A-3).
 * @param {Object} opts
 * @param {string} [opts.title] - Card title
 * @param {string} [opts.subtitle] - Card subtitle
 * @param {string} [opts.imageUrl] - Header image URL
 * @param {CardChild[]} opts.children - Card content
 * @returns {CardElement & PostableObject}
 */
export function Card({ title, subtitle, imageUrl, children }) {
  const card = {
    type: "card",
    title,
    subtitle,
    imageUrl,
    children: children || [],
    // PostableObject interface
    $$typeof: POSTABLE_OBJECT,
    kind: "card",
    isSupported(adapter) {
      // Cards are supported by all adapters that have postObject or Block Kit support
      if (!adapter) return true;
      const slug = adapter.slug || adapter.name || "";
      return ["web", "slack", "teams", "discord", "whatsapp", "telegram"].includes(slug);
    },
    getFallbackText() {
      return cardToFallbackText(this);
    },
    getPostData() {
      return {
        type: this.type,
        title: this.title,
        subtitle: this.subtitle,
        imageUrl: this.imageUrl,
        children: this.children,
      };
    },
    onPosted(context) {
      this.messageId = context.messageId;
      this.threadId = context.threadId;
    },
  };
  return card;
}

/**
 * Create a text element.
 * @param {Object} opts
 * @param {string} opts.content - Text content
 * @param {TextStyle} [opts.style] - Text style
 * @returns {TextElement}
 */
export function Text({ content, style }) {
  return {
    type: "text",
    content,
    style,
  };
}

/**
 * Create a button element.
 * @param {Object} opts
 * @param {string} opts.id - Unique action ID
 * @param {string} opts.label - Button label
 * @param {ButtonStyle} [opts.style] - Visual style
 * @param {ActionType} [opts.actionType] - Action type
 * @param {string} [opts.value] - Payload value
 * @param {string} [opts.callbackUrl] - Callback URL
 * @param {boolean} [opts.disabled] - Whether disabled
 * @returns {ButtonElement}
 */
export function Button({ id, label, style, actionType, value, callbackUrl, disabled }) {
  return {
    type: "button",
    id,
    label,
    style,
    actionType,
    value,
    callbackUrl,
    disabled,
  };
}

/**
 * Create a link button element.
 * @param {Object} opts
 * @param {string} opts.url - URL to open
 * @param {string} opts.label - Button label
 * @param {ButtonStyle} [opts.style] - Visual style
 * @param {string} [opts.id] - Optional ID
 * @returns {LinkButtonElement}
 */
export function LinkButton({ url, label, style, id }) {
  return {
    type: "link-button",
    url,
    label,
    style,
    id,
  };
}

/**
 * Create an image element.
 * @param {Object} opts
 * @param {string} opts.url - Image URL
 * @param {string} [opts.alt] - Alt text
 * @returns {ImageElement}
 */
export function Image({ url, alt }) {
  return {
    type: "image",
    url,
    alt,
  };
}

/**
 * Create a divider element.
 * @returns {DividerElement}
 */
export function Divider() {
  return { type: "divider" };
}

/**
 * Create an actions container.
 * @param {Object} opts
 * @param {Array<ButtonElement|LinkButtonElement>} opts.children - Action elements
 * @returns {ActionsElement}
 */
export function Actions({ children }) {
  return {
    type: "actions",
    children: children || [],
  };
}

/**
 * Create a section container.
 * @param {Object} opts
 * @param {CardChild[]} opts.children - Section children
 * @returns {SectionElement}
 */
export function Section({ children }) {
  return {
    type: "section",
    children: children || [],
  };
}

/**
 * Create a field element.
 * @param {Object} opts
 * @param {string} opts.label - Field label
 * @param {string} opts.value - Field value
 * @returns {FieldElement}
 */
export function Field({ label, value }) {
  return {
    type: "field",
    label,
    value,
  };
}

/**
 * Create a fields container.
 * @param {Object} opts
 * @param {FieldElement[]} opts.children - Field elements
 * @returns {FieldsElement}
 */
export function Fields({ children }) {
  return {
    type: "fields",
    children: children || [],
  };
}

/**
 * Create a link element.
 * @param {Object} opts
 * @param {string} opts.url - URL
 * @param {string} opts.label - Link label
 * @returns {LinkElement}
 */
export function Link({ url, label }) {
  return {
    type: "link",
    url,
    label,
  };
}

/**
 * Create a table element.
 * @param {Object} opts
 * @param {string[]} opts.headers - Column headers
 * @param {string[][]} opts.rows - Data rows
 * @param {TableAlignment[]} [opts.align] - Column alignment
 * @returns {TableElement}
 */
export function Table({ headers, rows, align }) {
  return {
    type: "table",
    headers,
    rows,
    align,
  };
}

// =============================================================================
// Rendering
// =============================================================================

/**
 * Convert a card element tree to plain text (fallback for text-only channels).
 * @param {CardElement|CardChild} element - Element to convert
 * @returns {string}
 */
export function cardToFallbackText(element) {
  if (!element) return "";

  switch (element.type) {
    case "card": {
      const parts = [];
      if (element.title) parts.push(`**${element.title}**`);
      if (element.subtitle) parts.push(element.subtitle);
      for (const child of element.children || []) {
        const text = cardToFallbackText(child);
        if (text) parts.push(text);
      }
      return parts.join("\n\n");
    }

    case "text":
      return element.content || "";

    case "button":
      return `[${element.label}]`;

    case "link-button":
      return `[${element.label}](${element.url})`;

    case "image":
      return element.alt || "[Image]";

    case "divider":
      return "---";

    case "actions": {
      const buttons = (element.children || [])
        .map((c) => cardToFallbackText(c))
        .filter(Boolean);
      return buttons.join(" | ");
    }

    case "section": {
      return (element.children || [])
        .map((c) => cardToFallbackText(c))
        .filter(Boolean)
        .join("\n");
    }

    case "fields": {
      return (element.children || [])
        .map((f) => `**${f.label}:** ${f.value}`)
        .join("\n");
    }

    case "field":
      return `**${element.label}:** ${element.value}`;

    case "link":
      return `[${element.label}](${element.url})`;

    case "table": {
      const header = `| ${element.headers.join(" | ")} |`;
      const separator = `| ${element.headers.map(() => "---").join(" | ")} |`;
      const rows = (element.rows || [])
        .map((r) => `| ${r.join(" | ")} |`)
        .join("\n");
      return `${header}\n${separator}\n${rows}`;
    }

    default:
      return "";
  }
}

/**
 * Convert a card element tree to markdown.
 * @param {CardElement|CardChild} element - Element to convert
 * @returns {string}
 */
export function cardToMarkdown(element) {
  if (!element) return "";

  switch (element.type) {
    case "card": {
      const parts = [];
      if (element.title) parts.push(`# ${element.title}`);
      if (element.subtitle) parts.push(`*${element.subtitle}*`);
      for (const child of element.children || []) {
        const text = cardToMarkdown(child);
        if (text) parts.push(text);
      }
      return parts.join("\n\n");
    }

    case "text":
      return element.content || "";

    case "button":
      return `**[${element.label}]**`;

    case "link-button":
      return `[${element.label}](${element.url})`;

    case "image":
      return `![${element.alt || "Image"}](${element.url})`;

    case "divider":
      return "---";

    case "actions": {
      const buttons = (element.children || [])
        .map((c) => cardToMarkdown(c))
        .filter(Boolean);
      return buttons.join(" | ");
    }

    case "section": {
      return (element.children || [])
        .map((c) => cardToMarkdown(c))
        .filter(Boolean)
        .join("\n");
    }

    case "fields": {
      return (element.children || [])
        .map((f) => `**${f.label}:** ${f.value}`)
        .join("\n");
    }

    case "field":
      return `**${element.label}:** ${element.value}`;

    case "link":
      return `[${element.label}](${element.url})`;

    case "table": {
      const header = `| ${element.headers.join(" | ")} |`;
      const separator = `| ${element.headers.map(() => "---").join(" | ")} |`;
      const rows = (element.rows || [])
        .map((r) => `| ${r.join(" | ")} |`)
        .join("\n");
      return `${header}\n${separator}\n${rows}`;
    }

    default:
      return "";
  }
}

/**
 * Convert a card element tree to Slack Block Kit format.
 * @param {CardElement} element - Card element
 * @returns {Array<Object>}
 */
export function cardToSlackBlocks(element) {
  if (!element || element.type !== "card") return [];

  const blocks = [];

  if (element.title) {
    blocks.push({
      type: "header",
      text: { type: "plain_text", text: element.title },
    });
  }

  if (element.subtitle) {
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: element.subtitle }],
    });
  }

  for (const child of element.children || []) {
    blocks.push(...slackChildToBlocks(child));
  }

  return blocks;
}

/**
 * Convert a single card child to Slack blocks.
 * @param {CardChild} element
 * @returns {Array<Object>}
 */
function slackChildToBlocks(element) {
  switch (element.type) {
    case "text":
      return [{ type: "section", text: { type: "mrkdwn", text: element.content } }];

    case "divider":
      return [{ type: "divider" }];

    case "image":
      return [{
        type: "image",
        image_url: element.url,
        alt_text: element.alt || "Image",
      }];

    case "actions":
      return [{
        type: "actions",
        elements: (element.children || []).map(slackActionToElement),
      }];

    case "fields":
      return [{
        type: "section",
        fields: (element.children || []).map((f) => ({
          type: "mrkdwn",
          text: `*${f.label}*\n${f.value}`,
        })),
      }];

    case "table": {
      const header = `*${element.headers.join(" | ")}*`;
      const rows = (element.rows || [])
        .map((r) => r.join(" | "))
        .join("\n");
      return [{
        type: "section",
        text: { type: "mrkdwn", text: `${header}\n${rows}` },
      }];
    }

    default:
      return [];
  }
}

/**
 * Convert an action element to Slack format.
 * @param {ButtonElement|LinkButtonElement} element
 * @returns {Object}
 */
function slackActionToElement(element) {
  if (element.type === "link-button") {
    return {
      type: "button",
      text: { type: "plain_text", text: element.label },
      url: element.url,
    };
  }

  return {
    type: "button",
    text: { type: "plain_text", text: element.label },
    action_id: element.id,
    value: element.value,
    style: element.style === "primary" ? "primary" : element.style === "danger" ? "danger" : undefined,
  };
}

/**
 * Convert a card element tree to Adaptive Card format (Teams).
 * @param {CardElement} element - Card element
 * @returns {Object}
 */
export function cardToAdaptiveCard(element) {
  if (!element || element.type !== "card") return {};

  const card = {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.4",
    body: [],
    actions: [],
  };

  if (element.title) {
    card.body.push({
      type: "TextBlock",
      text: element.title,
      size: "Large",
      weight: "Bolder",
    });
  }

  if (element.subtitle) {
    card.body.push({
      type: "TextBlock",
      text: element.subtitle,
      isSubtle: true,
    });
  }

  for (const child of element.children || []) {
    const result = adaptiveChildToCard(child);
    if (result.body) card.body.push(...result.body);
    if (result.actions) card.actions.push(...result.actions);
  }

  return card;
}

/**
 * Convert a card child to Adaptive Card format.
 * @param {CardChild} element
 * @returns {{body?: Array, actions?: Array}}
 */
function adaptiveChildToCard(element) {
  switch (element.type) {
    case "text":
      return { body: [{ type: "TextBlock", text: element.content, wrap: true }] };

    case "divider":
      return { body: [{ type: "FactSet", facts: [] }] };

    case "image":
      return { body: [{ type: "Image", url: element.url, altText: element.alt || "" }] };

    case "actions":
      return {
        actions: (element.children || []).map((c) => {
          if (c.type === "link-button") {
            return {
              type: "Action.OpenUrl",
              title: c.label,
              url: c.url,
            };
          }
          return {
            type: "Action.Submit",
            title: c.label,
            data: { actionId: c.id, value: c.value },
          };
        }),
      };

    case "fields":
      return {
        body: [{
          type: "FactSet",
          facts: (element.children || []).map((f) => ({
            title: f.label,
            value: f.value,
          })),
        }],
      };

    default:
      return {};
  }
}
