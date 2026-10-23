import styles from "./landing-c.module.css";

type CodeTokenKind = "plain" | "string" | "comment" | "keyword" | "tag" | "attr";

interface CodeToken {
  text: string;
  kind: CodeTokenKind;
}

const TOKEN_RE =
  /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|\b(import|from|function|return|const|let|var|export|default|async|await|new|type|interface)\b|\b([A-Z][A-Za-z0-9_]*)\b|\b([a-zA-Z_$][\w$]*)(?=\s*=)/g;

const KIND_CLASS: Record<Exclude<CodeTokenKind, "plain">, string> = {
  string: styles.tokStr,
  comment: styles.tokCom,
  keyword: styles.tokKey,
  tag: styles.tokTag,
  attr: styles.tokAttr,
};

export function tokenizeCode(source: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  let last = 0;

  for (const match of source.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > last) tokens.push({ text: source.slice(last, index), kind: "plain" });

    const kind: CodeTokenKind = match[1]
      ? "string"
      : match[2]
        ? "comment"
        : match[3]
          ? "keyword"
          : match[4]
            ? source[index - 1] === "."
              ? "plain"
              : "tag"
            : "attr";

    tokens.push({ text: match[0], kind });
    last = index + match[0].length;
  }

  if (last < source.length) tokens.push({ text: source.slice(last), kind: "plain" });
  return tokens;
}

export function HighlightedCode({ source }: { source: string }) {
  return (
    <>
      {tokenizeCode(source).map((token, index) =>
        token.kind === "plain" ? (
          <span key={index}>{token.text}</span>
        ) : (
          <span key={index} className={KIND_CLASS[token.kind]}>
            {token.text}
          </span>
        ),
      )}
    </>
  );
}
