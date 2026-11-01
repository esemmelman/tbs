const categories = {
  websites: { title: 'Websites', icon: '◎', description: 'Stay connected to the latest news.', links: [
    { name: 'CNN', url: 'https://www.cnn.com/' },
    { name: 'C-span', url: 'https://www.c-span.org/' }
  ] },
  calendars: { title: 'Calendars', icon: '▦', description: 'Make room for what’s coming next.', links: [
    { name: 'Temple Beth David', url: 'https://www.templebethdavid.org/community/calendar/' },
    { name: 'Google Calendar', url: 'https://calendar.google.com/calendar/u/0/r/month?pli=1' }
  ] }
};
const menu = document.querySelector('#menu');
const back = document.querySelector('#back');
const main = document.querySelector('#main');
// Track in-app history so Back never sends a new visitor off the site.
history.replaceState({ menuDepth: 0 }, '');
function navigate(hash) {
  if (location.hash === hash) return;
  history.pushState({ menuDepth: (history.state?.menuDepth || 0) + 1 }, '', hash || location.pathname + location.search);
  render();
  menu.querySelector('a').focus();
}
function render() {
  const key = location.hash.slice(1);
  const category = Object.hasOwn(categories, key) ? categories[key] : null;
  main.disabled = !category;
  back.disabled = !(history.state?.menuDepth > 0);
  menu.setAttribute('aria-label', category?.title || 'Categories');
  menu.replaceChildren();
  const entries = category ? category.links : Object.entries(categories).map(([key, value]) => ({ name: value.title, url: '#' + key, icon: value.icon }));
  for (const entry of entries) {
    const link = document.createElement('a');
    link.className = 'item';
    link.href = entry.url;
    if (!category) {
      link.addEventListener('click', event => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        navigate(entry.url);
      });
    }
    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = entry.icon || category.icon;
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = entry.name;
    link.append(icon, label);
    menu.append(link);
  }
}
main.addEventListener('click', () => navigate(''));
back.addEventListener('click', () => { if (history.state?.menuDepth > 0) history.back(); });
window.addEventListener('popstate', () => { render(); menu.querySelector('a').focus(); });
window.addEventListener('hashchange', render);
render();
