(() => {
  const input = document.getElementById('handbook-search');
  const results = document.getElementById('search-results');
  const index = window.AGRO_HANDBOOK_SEARCH || [];
  if (input && results) {
    const clear = () => { results.replaceChildren(); results.hidden = true; };
    const makeResult = (guide, section, query) => {
      const link = document.createElement('a');
      link.className = 'search-result';
      link.href = `${guide.page}#${section.anchor}`;
      const heading = document.createElement('span');
      heading.className = 'search-result-title';
      heading.textContent = section.title;
      const meta = document.createElement('span');
      meta.className = 'search-result-meta';
      meta.textContent = `${guide.title} · ${guide.group}`;
      const snippet = document.createElement('span');
      snippet.className = 'search-result-snippet';
      const lower = section.text.toLocaleLowerCase();
      const at = lower.indexOf(query);
      const start = Math.max(0, at - 48);
      const end = Math.min(section.text.length, Math.max(at + query.length + 90, start + 140));
      snippet.textContent = `${start ? '…' : ''}${section.text.slice(start, end)}${end < section.text.length ? '…' : ''}`;
      link.append(heading, meta, snippet);
      return link;
    };
    input.addEventListener('input', () => {
      const query = input.value.trim().toLocaleLowerCase();
      if (query.length < 2) { clear(); return; }
      const matches = [];
      for (const guide of index) {
        for (const section of guide.sections) {
          if (`${section.title} ${section.text}`.toLocaleLowerCase().includes(query)) {
            matches.push({ guide, section });
            if (matches.length >= 12) break;
          }
        }
        if (matches.length >= 12) break;
      }
      results.replaceChildren();
      if (matches.length) {
        for (const match of matches) results.append(makeResult(match.guide, match.section, query));
      } else {
        const empty = document.createElement('p');
        empty.className = 'search-empty';
        empty.textContent = 'No matching guide sections. Try another project term.';
        results.append(empty);
      }
      results.hidden = false;
    });
    input.addEventListener('keydown', event => { if (event.key === 'Escape') { clear(); input.blur(); } });
    document.addEventListener('click', event => { if (!event.target.closest('.search-wrap')) clear(); });
  }
  for (const button of document.querySelectorAll('[data-print]')) button.addEventListener('click', () => window.print());
})();
