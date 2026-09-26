import { describe, expect, it } from "vitest";
import { s } from "../css";

/**
 * Plan S3.5 (EDITOR-27): `s()` turns the mockup's style strings into React
 * styles. It used to split on every ";", so a value holding one — a data URL,
 * a quoted string — came out broken with no error.
 */

describe("s", () => {
  it("turns declarations into camelCase properties, values as written", () => {
    expect(s("display:flex;align-items:center;padding:5px 11px;border-radius:999px")).toEqual({
      display: "flex",
      alignItems: "center",
      padding: "5px 11px",
      borderRadius: "999px",
    });
  });

  it("keeps custom properties as written", () => {
    expect(s("--accent-rgb:145,132,217;color:var(--accent)")).toEqual({
      "--accent-rgb": "145,132,217",
      color: "var(--accent)",
    });
  });

  it("ignores empty declarations, a trailing ';', stray whitespace and declarations with no value", () => {
    expect(s("  color : red ;; ;margin:;width:10px;")).toEqual({ color: "red", width: "10px" });
    expect(s("")).toEqual({});
    expect(s("not a declaration")).toEqual({});
  });

  it("keeps a data URL whole: its ';' is inside parentheses", () => {
    const url = "url(data:image/png;base64,iVBORw0KGgo=)";
    expect(s(`background-image:${url};background-size:cover`)).toEqual({
      backgroundImage: url,
      backgroundSize: "cover",
    });
  });

  it("keeps nested parentheses whole", () => {
    const bg = "radial-gradient(50% 50% at 50% 50%, rgba(var(--accent-rgb),.16), transparent 70%)";
    expect(s(`background:${bg};opacity:1`)).toEqual({ background: bg, opacity: "1" });
  });

  it("a ';' after an inner parenthesis closes is still inside the outer one", () => {
    const set = "image-set(url(data:image/png;base64,AA==) 1x, url(data:image/png;base64,BB==) 2x)";
    expect(s(`background-image:${set};color:red`)).toEqual({ backgroundImage: set, color: "red" });
    // A custom property may hold any balanced tokens, ';' included.
    expect(s("--pair:f(g(1);2);color:red")).toEqual({ "--pair": "f(g(1);2)", color: "red" });
  });

  it("keeps a ';' inside double or single quotes", () => {
    expect(s('content:";";color:red')).toEqual({ content: '";"', color: "red" });
    expect(s("font-family:'A;B', serif;font-size:12px")).toEqual({
      fontFamily: "'A;B', serif",
      fontSize: "12px",
    });
  });

  it("an escaped quote doesn't end the string", () => {
    expect(s('content:"a\\";b";color:red')).toEqual({ content: '"a\\";b"', color: "red" });
  });

  it("the other quote kind inside a string is just a character", () => {
    expect(s(`content:"it's; fine";color:red`)).toEqual({ content: `"it's; fine"`, color: "red" });
  });

  it("a string ends at a newline, as in CSS — and a real string after it still keeps its ';'", () => {
    expect(s('content:"abc\n;color:red')).toEqual({ content: '"abc', color: "red" });
    expect(s("content:\"abc\n;font-family:'A;B';color:red")).toEqual({
      content: '"abc',
      fontFamily: "'A;B'",
      color: "red",
    });
  });

  it("a quote never closed (a stray apostrophe) doesn't swallow the declarations after it", () => {
    expect(s("background:url(it's.png);color:red")).toEqual({ background: "url(it's.png)", color: "red" });
    expect(s("font-family:Rock n' Roll;font-size:12px")).toEqual({
      fontFamily: "Rock n' Roll",
      fontSize: "12px",
    });
  });

  it("splits after a closing parenthesis again", () => {
    expect(s("transform:translate(-50%, 0) rotate(3deg);left:50%")).toEqual({
      transform: "translate(-50%, 0) rotate(3deg)",
      left: "50%",
    });
  });

  it("keeps the first ':' as the separator, so a URL's own colons stay in the value", () => {
    expect(s("background:url(https://example.test/a.png) no-repeat")).toEqual({
      background: "url(https://example.test/a.png) no-repeat",
    });
  });

  it("names vendor prefixes as React does: Webkit…, Moz…, but ms…", () => {
    expect(s("-webkit-box-orient:vertical;-moz-appearance:none;-ms-overflow-style:none")).toEqual({
      WebkitBoxOrient: "vertical",
      MozAppearance: "none",
      msOverflowStyle: "none",
    });
  });
});
