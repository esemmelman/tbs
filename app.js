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
function render() {
  const key = location.hash.slice(1);
  const category = Object.hasOwn(categories, key) ? categories[key] : null;
  document.querySelector('#menu-title').textContent = category?.title || 'Where to?';
  document.querySelector('#description').textContent = category?.description || 'Choose a category to find your next stop.';
  document.querySelector('#eyebrow').textContent = category ? 'PICK YOUR DESTINATION' : 'A LITTLE SHORTCUT';
  document.querySelector('#footer').textContent = category ? 'Choose a link to open the website.' : 'Your everyday destinations, in one place.';
  back.hidden = !category;
  menu.setAttribute('aria-label', category?.title || 'Categories');
  menu.replaceChildren();
  const entries = category ? category.links : Object.entries(categories).map(([key, value]) => ({ name: value.title, url: '#' + key, icon: value.icon }));
  for (const entry of entries) {
    const link = document.createElement('a');
    link.className = 'item';
    link.href = entry.url;
    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = entry.icon || category.icon;
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = entry.name;
    if (category) {
      const url = document.createElement('span');
      url.className = 'url';
      url.textContent = entry.url;
      label.append(url);
    }
    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.textContent = category ? '↗' : '→';
    arrow.setAttribute('aria-hidden', 'true');
    link.append(icon, label, arrow);
    menu.append(link);
  }
}
back.addEventListener('click', () => { location.hash = ''; });
window.addEventListener('hashchange', () => { render(); document.querySelector('#menu-title').focus(); });
render();
