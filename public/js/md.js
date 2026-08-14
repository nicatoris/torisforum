/* Minimal safe Markdown renderer for post bodies.
   All input is HTML-escaped before any formatting is applied, so user
   content can never inject markup. Supported: # ## ### headings, **bold**,
   *italic*, ~~strikethrough~~, `code`, ``` code blocks, [links](url),
   ![images](url), > quotes, - and 1. lists, --- rules. */

(function () {
  // Placeholder sentinels from the Unicode private-use area; stripped from
  // input up front so user text can never collide with them.
  var S1 = '';
  var S2 = '';

  function escapeHtml(s) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function safeUrl(url) {
    return /^(https?:\/\/|\/uploads\/)/i.test(url);
  }

  function inline(text) {
    let s = escapeHtml(text);
    const codes = [];
    s = s.replace(/`([^`]+)`/g, (m, c) => {
      codes.push('<code>' + c + '</code>');
      return S1 + (codes.length - 1) + S1;
    });
    s = s.replace(/!\[([^\]]*)\]\(([^()\s]+)\)/g, (m, alt, url) =>
      safeUrl(url) ? `<img src="${url}" alt="${alt}" loading="lazy">` : m
    );
    s = s.replace(/\[([^\]]+)\]\(([^()\s]+)\)/g, (m, txt, url) =>
      safeUrl(url) ? `<a href="${url}" target="_blank" rel="noopener nofollow">${txt}</a>` : m
    );
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    s = s.replace(/(\d+)/g, (m, i) => codes[+i]);
    return s;
  }

  function renderMarkdown(src) {
    src = String(src || '')
      .replace(/\r\n?/g, '\n')
      .replace(/[]/g, '');

    const blocks = [];
    src = src.replace(/```[^\n`]*\n?([\s\S]*?)```/g, (m, code) => {
      blocks.push('<pre><code>' + escapeHtml(code.replace(/\n$/, '')) + '</code></pre>');
      return S2 + (blocks.length - 1) + S2;
    });

    const lines = src.split('\n');
    const out = [];
    let list = null;
    let para = [];
    let quote = [];

    const flushPara = () => {
      if (para.length) {
        out.push('<p>' + para.join('<br>') + '</p>');
        para = [];
      }
    };
    const flushList = () => {
      if (list) {
        out.push('</' + list + '>');
        list = null;
      }
    };
    const flushQuote = () => {
      if (quote.length) {
        out.push('<blockquote>' + quote.join('<br>') + '</blockquote>');
        quote = [];
      }
    };
    const flushAll = () => {
      flushPara();
      flushList();
      flushQuote();
    };

    for (const line of lines) {
      const blockRef = /^(\d+)$/.exec(line.trim());
      if (blockRef) {
        flushAll();
        out.push(blocks[+blockRef[1]]);
        continue;
      }
      if (!line.trim()) {
        flushAll();
        continue;
      }
      const h = /^(#{1,3})\s+(.*)$/.exec(line);
      if (h) {
        flushAll();
        const level = h[1].length + 1; // h2..h4 so post titles stay the only h1
        out.push(`<h${level}>` + inline(h[2]) + `</h${level}>`);
        continue;
      }
      if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
        flushAll();
        out.push('<hr>');
        continue;
      }
      const q = /^>\s?(.*)$/.exec(line);
      if (q) {
        flushPara();
        flushList();
        quote.push(inline(q[1]));
        continue;
      }
      const ul = /^[-*]\s+(.*)$/.exec(line);
      const ol = /^\d+[.)]\s+(.*)$/.exec(line);
      if (ul || ol) {
        flushPara();
        flushQuote();
        const want = ul ? 'ul' : 'ol';
        if (list !== want) {
          flushList();
          out.push('<' + want + '>');
          list = want;
        }
        out.push('<li>' + inline((ul || ol)[1]) + '</li>');
        continue;
      }
      flushList();
      flushQuote();
      para.push(inline(line));
    }
    flushAll();
    return out.join('\n');
  }

  /* Plain-text version of a markdown string, for card snippets. */
  function stripMarkdown(src) {
    return String(src || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/^#{1,3}\s+/gm, '')
      .replace(/^>\s?/gm, '')
      .replace(/^[-*]\s+/gm, '')
      .replace(/^\d+[.)]\s+/gm, '')
      .replace(/^(-{3,}|\*{3,})\s*$/gm, ' ')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/~~([^~]+)~~/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  window.renderMarkdown = renderMarkdown;
  window.stripMarkdown = stripMarkdown;
})();
