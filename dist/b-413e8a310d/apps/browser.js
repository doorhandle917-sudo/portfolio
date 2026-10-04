// Portfolio viewer: a small browser with an address bar, back/forward and
// internal portfolio:// pages rendered from content.js.
import { h, asset, inlineNodes, externalLink, mailLink, isPlaceholder, placeholderChip } from '../os/util.js';
import { uiIcon } from '../os/icons.js';
import { os } from '../os/system.js';

const SCHEME = 'portfolio://';
const NAV = [['home', 'Home'], ['about', 'About'], ['projects', 'Projects'], ['contact', 'Contact']];

export function mount(win, args = {}) {
  const { content } = os;
  const back = [];
  const forward = [];
  let current = null;

  const tool = (icon, label, onClick) =>
    h('button', { class: 'tool-btn', type: 'button', 'aria-label': label, title: label, html: uiIcon(icon), onClick });
  const backBtn = tool('back', 'Back (Alt+Left)', () => goBack());
  const forwardBtn = tool('forward', 'Forward (Alt+Right)', () => goForward());
  const reloadBtn = tool('reload', 'Reload', () => render(current, { focus: false }));
  const homeBtn = tool('home', 'Home page', () => navigate('home'));
  const address = h('input', { class: 'text-input browser-address', type: 'text', 'aria-label': 'Address', spellcheck: 'false', autocomplete: 'off', inputmode: 'url' });
  const view = h('div', { class: 'browser-view', tabindex: '-1' });

  win.body.append(h('div', { class: 'browser' },
    h('div', { class: 'app-toolbar' }, backBtn, forwardBtn, reloadBtn, homeBtn,
      h('form', { class: 'browser-form', role: 'search', onSubmit: (e) => { e.preventDefault(); navigate(address.value); } }, address)),
    view,
  ));
  win.onFocus(() => view.focus({ preventScroll: true }));
  win.reuse = (next) => { if (next.url) navigate(next.url); };

  // --- routing -------------------------------------------------------------------
  function parse(input) {
    let route = String(input || '').trim().toLowerCase();
    route = route.replace(/^portfolio:\/*/, '').replace(/^\/+|\/+$/g, '');
    return route || 'home';
  }

  function navigate(input, { push = true } = {}) {
    const route = parse(input);
    if (push && current && route !== current) { back.push(current); forward.length = 0; }
    current = route;
    render(route);
  }

  function goBack() {
    if (!back.length) return;
    forward.push(current);
    current = back.pop();
    render(current);
  }

  function goForward() {
    if (!forward.length) return;
    back.push(current);
    current = forward.pop();
    render(current);
  }

  function render(route, { focus = true } = {}) {
    const page = resolve(route);
    address.value = SCHEME + route;
    backBtn.disabled = !back.length;
    forwardBtn.disabled = !forward.length;
    win.setTitle(`${page.title} — Portfolio`);
    view.replaceChildren(h('div', { class: 'site' }, siteNav(page.section), h('main', { class: 'site-main' }, page.body), siteFooter()));
    view.scrollTop = 0;
    if (focus && win.wm.active === win && document.activeElement !== address) {
      view.querySelector('h1')?.focus({ preventScroll: true });
    }
  }

  function resolve(route) {
    if (route === 'home') return { title: content.person.name, section: 'home', body: homePage() };
    if (route === 'about') return { title: 'About', section: 'about', body: aboutPage() };
    if (route === 'projects') return { title: 'Projects', section: 'projects', body: projectsPage() };
    if (route === 'contact') return { title: 'Contact', section: 'contact', body: contactPage() };
    const m = /^projects\/([\w-]+)$/.exec(route);
    const project = m && content.projects.find((p) => p.slug === m[1]);
    if (project) return { title: project.title, section: 'projects', body: projectPage(project) };
    return { title: 'Page not found', section: null, body: notFound(route) };
  }

  // Internal links navigate inside the viewer; everything else opens a real tab.
  view.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (href.startsWith(SCHEME)) {
      e.preventDefault();
      navigate(href);
    } else if (link.dataset.file) {
      e.preventDefault();
      os.openPath(link.dataset.file);
    }
  });

  win.body.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); goBack(); }
    else if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); goForward(); }
  });
  address.addEventListener('focus', () => address.select());

  // --- page parts -------------------------------------------------------------------
  const link = (route, label, props = {}) => h('a', { href: SCHEME + route, ...props }, label);
  const heading = (text) => h('h1', { tabindex: '-1' }, text);
  const tags = (items) => h('ul', { class: 'site-tags', 'aria-label': 'Technologies' }, items.map((t) => h('li', null, t)));
  const value = (v, render = (x) => x) => (isPlaceholder(v) ? placeholderChip(v) : render(v));

  function siteNav(section) {
    return h('header', { class: 'site-header' },
      link('home', content.person.name, { class: 'site-brand' }),
      h('nav', { 'aria-label': 'Site' }, h('ul', null, NAV.map(([route, label]) =>
        h('li', null, link(route, label, section === route ? { 'aria-current': 'page' } : {}))))),
    );
  }

  function siteFooter() {
    return h('footer', { class: 'site-footer' }, h('p', null, `“${content.person.quote}”`));
  }

  function socialLinks() {
    return h('div', { class: 'site-actions' },
      h('a', { class: 'site-btn site-btn-primary', href: `mailto:${content.contact.email}` }, h('span', { html: uiIcon('mail') }), content.contact.email),
      content.contact.links
        .filter((l) => l.id !== 'oryks')
        .map((l) => externalLink(l.url, [l.label, h('span', { html: uiIcon('external') })], { class: 'site-btn' })),
    );
  }

  function projectCard(p) {
    return h('article', { class: 'site-card' },
      h('h3', null, link(`projects/${p.slug}`, p.title)),
      h('p', null, p.bullets[0]),
      tags(p.tags),
    );
  }

  function homePage() {
    const { person } = content;
    return [
      h('section', { class: 'site-hero' },
        h('img', { class: 'site-avatar', src: asset(person.avatar), alt: `Avatar of ${person.name}`, width: '112', height: '112' }),
        h('div', null,
          h('p', { class: 'site-status' }, h('span', { class: 'dot', 'aria-hidden': 'true' }), person.status),
          heading(person.name),
          h('p', { class: 'site-role' }, person.role),
          h('p', { class: 'site-muted' }, person.location),
        ),
      ),
      h('p', { class: 'site-lead' }, content.profile.text),
      socialLinks(),
      h('section', null,
        h('h2', null, 'Personal Projects'),
        h('div', { class: 'site-cards' }, content.projects.map(projectCard)),
        h('p', null, link('projects', 'All projects →')),
      ),
    ];
  }

  function aboutPage() {
    const { profile, oryks, experience, education, languages, interests } = content;
    return [
      heading('About'),
      h('section', null, h('h2', null, profile.title), h('p', null, profile.text)),
      h('section', null, h('h2', null, oryks.title), oryks.paragraphs.map((p) => h('p', null, inlineNodes(p)))),
      h('section', null,
        h('h2', null, 'Work Experience'),
        h('ol', { class: 'site-timeline' }, experience.map((job) => h('li', null,
          h('h3', null, job.title, h('span', { class: 'site-muted' }, ` · ${job.company}`)),
          h('p', { class: 'site-meta' }, job.current ? h('span', { class: 'site-badge' }, 'Present') : null, `${job.period} · ${job.location}`),
          h('ul', null, job.bullets.map((b) => h('li', null, b))),
        ))),
      ),
      h('section', null,
        h('h2', null, 'Education'),
        education.map((e) => h('div', null, h('h3', null, `${e.degree}, `, h('span', { class: 'site-muted' }, e.school)), h('p', { class: 'site-meta' }, `${e.period} · ${e.location}`))),
      ),
      h('section', null,
        h('h2', null, 'Languages'),
        h('ul', { class: 'site-plain' }, languages.map((l) => h('li', null, h('strong', null, l.name), ` — ${l.level}`))),
      ),
      h('section', null, h('h2', null, 'Interests'), tags(interests)),
    ];
  }

  function projectsPage() {
    return [heading('Personal Projects'), h('div', { class: 'site-cards' }, content.projects.map(projectCard))];
  }

  function projectPage(p) {
    const file = `${os.vfs.home}/projects/${p.slug}.md`;
    return [
      h('p', { class: 'site-crumbs' }, link('projects', '← Projects')),
      heading(p.title),
      h('ul', { class: 'site-bullets' }, p.bullets.map((b) => h('li', null, b))),
      h('dl', { class: 'site-facts' },
        h('dt', null, 'Technologies'), h('dd', null, tags(p.tags)),
        p.period ? [h('dt', null, 'Period'), h('dd', null, value(p.period))] : null,
        p.repo ? [h('dt', null, 'Repository'), h('dd', null, value(p.repo, (url) => externalLink(url)))] : null,
        h('dt', null, 'Source file'), h('dd', null, h('a', { href: '#', 'data-file': file }, os.vfs.display(file))),
      ),
    ];
  }

  function contactPage() {
    const { contact, person } = content;
    return [
      h('p', { class: 'site-eyebrow' }, contact.heading),
      heading(contact.cta),
      h('p', { class: 'site-lead' }, `${person.name} · ${person.role} · ${person.location}`),
      h('dl', { class: 'site-facts' },
        h('dt', null, 'Email'), h('dd', null, mailLink(contact.email)),
        contact.links.map((l) => [h('dt', null, l.label), h('dd', null, externalLink(l.url))]),
      ),
    ];
  }

  function notFound(route) {
    return [
      heading('404 — Page not found'),
      h('p', null, 'There is no page at ', h('code', null, SCHEME + route), '.'),
      h('p', null, 'Try one of these:'),
      h('ul', { class: 'site-plain' }, [...NAV.map(([r, label]) => h('li', null, link(r, label))),
        ...content.projects.map((p) => h('li', null, link(`projects/${p.slug}`, p.title)))]),
    ];
  }

  navigate(args.url || 'home', { push: false });
}
