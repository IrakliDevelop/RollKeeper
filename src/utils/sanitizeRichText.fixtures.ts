/**
 * Shared fixtures for `sanitizeRichText`. The Node test, the jsdom test and
 * the Chromium story all check the same inputs against the same expected
 * strings, so the three environments are held to one result.
 */

/**
 * `editor.getHTML()` from RichTextEditor's extensions (StarterKit, TextStyle,
 * Color, Underline, TableKit) holding every mark, heading level, list, quote,
 * inline code, code block, rule, link, pasted colour and a 3×3 table with a
 * header row, a merged header cell and resized columns. The jsdom test
 * rebuilds it through a real editor and fails if TipTap's output drifts.
 */
export const EDITOR_FIXTURE_HTML = [
  '<h1>Heading 1</h1>',
  '<h2>Heading 2</h2>',
  '<h3>Heading 3</h3>',
  '<h4>Heading 4</h4>',
  '<h5>Heading 5</h5>',
  '<h6>Heading 6</h6>',
  '<p><strong>Bold</strong> <em>italic</em> <u>underline</u> <s>strike</s> <code>inline &lt;code&gt;</code> ',
  '<a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com/a?b=1&amp;c=2">web</a> ',
  '<a target="_blank" rel="noopener noreferrer nofollow" href="mailto:dm@example.com">mail</a> ',
  '<a target="_blank" rel="noopener noreferrer nofollow" href="/player/characters">relative</a>',
  '<br>Fish &amp; chips at the Rusty Anchor</p>',
  '<ul><li><p>Bullet</p><ul><li><p>Nested</p></li></ul></li></ul>',
  '<ol start="3"><li><p>Third</p></li><li><p>Fourth</p></li></ol>',
  '<blockquote><p>The bridge is out.</p></blockquote>',
  '<pre><code class="language-js">const roll = d20 &lt; 10;</code></pre>',
  '<pre><code>plain block</code></pre>',
  '<hr>',
  '<p><span style="color: rgb(255, 0, 0);">red</span> <span style="color: rgb(0, 128, 0);">green</span></p>',
  '<table style="width: 360px;"><colgroup><col style="width: 120px;"><col style="width: 120px;"><col style="width: 120px;"></colgroup><tbody>',
  '<tr><th colspan="2" rowspan="1" colwidth="120,120"><p>Merged</p></th><th colspan="1" rowspan="1" colwidth="120"><p>Third</p></th></tr>',
  '<tr><td colspan="1" rowspan="1" colwidth="120"><p>a</p></td><td colspan="1" rowspan="1" colwidth="120"><p>b</p></td><td colspan="1" rowspan="1" colwidth="120"><p>c</p></td></tr>',
  '<tr><td colspan="1" rowspan="1" colwidth="120"><p>d</p></td><td colspan="1" rowspan="1" colwidth="120"><p>e</p></td><td colspan="1" rowspan="1" colwidth="120"><p>f</p></td></tr>',
  '</tbody></table>',
  '<p></p>',
].join('');

/** `editor.getHTML()` from CompactRichTextEditor (marks and lists only). */
export const COMPACT_FIXTURE_HTML =
  '<p><strong>Bold</strong> <em>italic</em> <u>underline</u></p><ul><li><p>one</p></li></ul><ol><li><p>two</p></li></ol>';

/**
 * Inputs that must come out exactly as they went in: editor output, legacy
 * plain text from before the rich-text editors, the empty paragraph an
 * untouched editor saves, and the 5etools-derived HTML that NPC inventory
 * items (`parseEntriesToHtml`) and class features (`referenceParser`,
 * `classDataLoader`) carry.
 */
export const UNCHANGED_INPUTS: readonly string[] = [
  EDITOR_FIXTURE_HTML,
  COMPACT_FIXTURE_HTML,
  'Legacy plain text with no markup',
  'Two lines\nof legacy text',
  'Legacy &amp &copy and AT&T text',
  '<p></p>',
  '',
  '<p>You learn <span class="font-medium underline decoration-dotted underline-offset-2" title="Fireball (PHB)">Fireball</span>.</p><div><strong>Variant</strong></div>',
  '<table><caption>Wand charges</caption><thead><tr><th>d6</th><th>Effect</th></tr></thead><tbody><tr><td>1</td><td>Nothing</td></tr></tbody></table>',
];

/**
 * Hostile inputs and the exact sanitised string every environment must
 * produce. Each one is also rendered and checked on the DOM.
 */
export const HOSTILE_CASES: ReadonlyArray<{
  name: string;
  input: string;
  expected: string;
}> = [
  {
    name: 'script element',
    input: '<p>Hi</p><script>alert(1)</script><p>after</p>',
    expected: '<p>Hi</p><p>after</p>',
  },
  {
    name: 'unclosed script',
    input: '<p>Hi</p><script>alert(1)',
    expected: '<p>Hi</p>',
  },
  {
    name: 'event handler attributes',
    input:
      '<p onclick="alert(1)" onmouseover=alert(2)>Hi</p><a href="https://x.test" onfocus="alert(3)">x</a>',
    expected: '<p>Hi</p><a href="https://x.test">x</a>',
  },
  {
    name: 'javascript: href, plain and encoded',
    input:
      '<a href="javascript:alert(1)">a</a><a href=" JaVaScRiPt:alert(2)">b</a><a href="java&#x09;script:alert(3)">c</a><a href="&#106;avascript:alert(4)">d</a><a href="&#106avascript:alert(5)">e</a><a href="javascript&colon;alert(6)">f</a>',
    expected: '<a>a</a><a>b</a><a>c</a><a>d</a><a>e</a><a>f</a>',
  },
  {
    name: 'data: and vbscript: hrefs',
    input:
      '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">a</a><a href="vbscript:msgbox(1)">b</a>',
    expected: '<a>a</a><a>b</a>',
  },
  {
    name: 'image with onerror',
    input: '<p>x<img src=x onerror="alert(1)">y</p>',
    expected: '<p>xy</p>',
  },
  {
    name: 'iframe with srcdoc',
    input:
      '<iframe srcdoc="<script>alert(1)</script>"></iframe><iframe src="javascript:alert(2)">fallback</iframe><p>ok</p>',
    expected: '<p>ok</p>',
  },
  {
    name: 'svg with script and handlers',
    input:
      '<svg onload="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)"><text>t</text></a></svg><p>ok</p>',
    expected: '<p>ok</p>',
  },
  {
    name: 'svg style breakout',
    input: '<svg><style></svg><img src=x onerror=alert(1)></style></svg>ok',
    expected: 'ok',
  },
  {
    name: 'math element',
    input: '<math><mtext><img src=x onerror=alert(1)></mtext></math>ok',
    expected: 'ok',
  },
  {
    name: 'style element',
    input: '<style>body{display:none}</style><p>ok</p>',
    expected: '<p>ok</p>',
  },
  {
    name: 'form and inputs',
    input:
      '<form action="https://evil.test"><input name="pw"><button formaction="javascript:alert(1)">Go</button></form>',
    expected: 'Go',
  },
  {
    name: 'style values other than colour',
    input:
      '<span style="position: fixed; inset: 0; background: url(https://evil.test/x.png)">a</span><span style="color: red; background-image: url(x)">b</span><span style="color: expression(alert(1))">c</span><p style="color: red">d</p>',
    expected:
      '<span>a</span><span style="color: red;">b</span><span>c</span><p>d</p>',
  },
  {
    name: 'class and id on editor tags',
    input:
      '<p class="fixed inset-0 z-50" id="login">x</p><code class="fixed">y</code><div class="inset">z</div><span class="fixed inset-0 font-medium underline decoration-dotted underline-offset-2">w</span>',
    expected: '<p>x</p><code>y</code><div>z</div><span>w</span>',
  },
  {
    name: 'title breakout',
    input: "<span title='\"><script>alert(1)</script>'>x</span>",
    expected:
      '<span title="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;">x</span>',
  },
  {
    name: 'non-numeric table and list attributes',
    input:
      '<ol start="1;x" type="disc"><li>a</li></ol><table><tbody><tr><td colspan="2 onmouseover=alert(1)" colwidth="x">b</td></tr></tbody></table>',
    expected:
      '<ol><li>a</li></ol><table><tbody><tr><td>b</td></tr></tbody></table>',
  },
  {
    name: 'link target other than _blank',
    input: '<a href="/x" target="_top" rel="opener">x</a>',
    expected: '<a href="/x">x</a>',
  },
  {
    name: 'comments, doctype and processing instructions',
    input: '<!-- <script>alert(1)</script> --><!DOCTYPE html><?xml x?>ok',
    expected: 'ok',
  },
  {
    name: 'stray angle brackets in text',
    input: 'a < b && c > d <3 </ >',
    expected: 'a &lt; b && c &gt; d &lt;3 ',
  },
  {
    name: 'attribute quote breakout',
    input: '<a href=\'/x" onclick="alert(1)\'>x</a>',
    expected: '<a href="/x&quot; onclick=&quot;alert(1)">x</a>',
  },
  {
    name: 'unterminated tag swallows the rest',
    input: '<p>ok</p><img src=x onerror=alert(1)',
    expected: '<p>ok</p>',
  },
  {
    name: 'upper and mixed case tags',
    input:
      '<SCRIPT>alert(1)</SCRIPT ><ScRiPt>alert(2)</sCrIpT><P ONCLICK="alert(3)">ok</P><A HREF="HTTPS://x.test">x</A>',
    expected: '<p>ok</p><a href="HTTPS://x.test">x</a>',
  },
  {
    name: 'noscript attribute breakout',
    input: '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
    expected: '"&gt;',
  },
  {
    name: 'prototype property names',
    input:
      '<constructor>a</constructor><p constructor="x" __proto__="y">b</p><span style="constructor: red; __proto__: red">c</span><a href="&constructor;">d</a>',
    expected: 'a<p>b</p><span>c</span><a href="&amp;constructor;">d</a>',
  },
  {
    name: 'closing tags that would escape the wrapper',
    input:
      '</div></div></p></td></table><div><h1>Session expired <a href="https://evil.test/login">sign in</a></h1>',
    expected:
      '<div><h1>Session expired <a href="https://evil.test/login">sign in</a></h1></div>',
  },
  {
    name: 'mismatched closing tags',
    input: '<p><strong>bold<em>both</strong> after</p></em>',
    expected: '<p><strong>bold<em>both</em></strong> after</p>',
  },
  {
    name: 'base, meta, link and object',
    input:
      '<base href="https://evil.test/"><meta http-equiv="refresh" content="0;url=https://evil.test"><link rel="stylesheet" href="https://evil.test/x.css"><object data="https://evil.test/x.swf"><param name="x"></object>ok',
    expected: 'ok',
  },
];
