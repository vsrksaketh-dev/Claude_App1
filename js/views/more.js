// "More" hosts optional and less-frequent sections (Focus, Money, Career, Settings).
import { app, register, ui } from '../core.js';
import { tabs, subOf } from '../ui.js';

function render() {
  const items = Object.values(app.sections).filter(s => !s.enabled || s.enabled()).sort((a, b) => a.order - b.order).map(s => [s.id, s.label]);
  const cur = subOf('more', items);
  return `<h1>More</h1>${tabs('more', items)}${(app.sections[cur] || app.sections[items[0][0]]).render()}`;
}
register({ id: 'more', label: 'More', render });
