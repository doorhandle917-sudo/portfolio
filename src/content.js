// ===========================================================================
//  PORTFOLIO CONTENT — the only file you need to edit.
//
//  Every app (terminal, file manager, editor files, portfolio viewer, boot
//  screen, neofetch) reads from this object, so a change here shows up
//  everywhere after a reload.
//
//  Conventions
//  - Any string starting with "PLACEHOLDER" is shown on the site as a clearly
//    marked placeholder. Replace it with real data, or set it to null to hide
//    the field entirely.
//  - Inline links use Markdown syntax: [label](https://example.com)
//  - Everything under `system` is configuration for the fake OS, not a
//    portfolio fact.
// ===========================================================================

export default {
  system: {
    user: 'dusan', // login name shown in the prompt: dusan@gentoo
    hostname: 'gentoo',
    timezone: 'Europe/Bratislava', // used by the panel clock and `date`
  },

  person: {
    name: 'Dušan Hlavatý',
    initials: 'DH',
    role: 'DevOps & Backend Engineer',
    tagline: 'DevOps and Backend Engineer based in Slovakia.',
    location: 'Bratislava, Slovakia',
    status: 'Currently DevOps Intern @ NDS',
    avatar: 'assets/avatar.jpg', // relative to src/
    quote: 'Smart enough to know better, dumb enough to still do it.',
  },

  contact: {
    heading: 'Get in touch',
    cta: "Let's build something reliable.",
    email: 'dusan.hlavaty@proton.me',
    links: [
      { id: 'linkedin', label: 'LinkedIn', url: 'https://linkedin.com/in/dušan-hlavatý' },
      { id: 'github', label: 'GitHub', url: 'https://github.com/seojiaf' },
      { id: 'oryks', label: 'Oryks', url: 'https://www.oryks.org/' },
    ],
  },

  profile: {
    title: 'Professional Profile',
    text:
      'DevOps and Backend Engineer with practical experience in server administration, automation, and web application development. ' +
      'Currently a Computer Engineering student at Skyro and a DevOps Intern at Národná diaľničná spoločnosť. ' +
      'Passionate about Linux, self-hosting, and building scalable infrastructure, with a strong background in Go, SQL, backend development, and modern frontend technologies.',
  },

  oryks: {
    title: 'Oryks Collective',
    url: 'https://www.oryks.org/',
    paragraphs: [
      'Oryks is a group of classmates who love building our own IT projects, experimenting with new technologies, and learning while doing what we enjoy.',
      "We focus primarily on backend development, DevOps, Linux environments, self-hosted solutions, automation, and reverse engineering private APIs in apps and on the web. We also participate in hackathons and enjoy trying things we haven't done before.",
      'You can check out some of our public projects on our website at [oryks.org](https://www.oryks.org/) or on our GitHub profiles.',
    ],
  },

  experience: [
    {
      slug: 'nds-devops-intern',
      title: 'DevOps Intern',
      company: 'Národná diaľničná spoločnosť',
      period: 'Jul 2026 – Present',
      current: true,
      location: 'Bratislava, Slovakia',
      bullets: [
        'Management and maintenance of production servers and infrastructure',
        'Implementation of DevOps practices for deployment and monitoring',
        'Migration of legacy source codes to newer technologies and versions',
        'Collaboration with a hybrid team on infrastructure projects',
      ],
    },
    {
      slug: 'wezeo-backend-intern',
      title: 'Backend Intern',
      company: 'WEZEO',
      period: 'Jan 2026 – Jul 2026 (7 months)',
      current: false,
      location: 'Bratislava, Slovakia',
      bullets: [
        'Development of backend services and APIs using modern frameworks',
        'Working with databases and data modeling',
      ],
    },
    {
      slug: 'hemisfera-activities-coordinator',
      title: 'Activities Coordinator (Intern)',
      company: 'Hemisféra',
      period: 'Aug 2026',
      current: false,
      location: 'Bratislava, Slovakia',
      bullets: [
        'Coordination of youth activities and educational programs',
        'Mentoring young participants in technical and creative projects',
        'Development of educational materials and leading workshops',
      ],
    },
  ],

  projects: [
    {
      slug: 'custom-search-engine',
      title: 'Custom Search Engine',
      bullets: [
        'Creation of a search engine implementing the BM25 scoring algorithm.',
        'Backend development with Node.js and the Elysia framework.',
      ],
      tags: ['Node.js', 'Elysia', 'BM25'],
      period: 'PLACEHOLDER: project dates',
      repo: 'PLACEHOLDER: repository or demo URL',
    },
    {
      slug: 'self-hosted-infrastructure',
      title: 'Self-Hosted Infrastructure',
      bullets: [
        'Configuration and maintenance of personal VPS with Docker containers.',
        'Deployment of services including Gitea, SearXNG, Dozzle, and Caddy reverse proxy.',
        'Automation of server setup and kiosk configuration using Ansible and shell scripts.',
      ],
      tags: ['Linux', 'Docker', 'Caddy', 'Ansible', 'Bash'],
      period: 'PLACEHOLDER: project dates',
      repo: 'PLACEHOLDER: repository or demo URL',
    },
    {
      slug: 'web-applications',
      title: 'Web Applications',
      bullets: [
        'Node.js/Vue.js applications with APIs over PostgreSQL/MySQL.',
        'Games and exercises developed in Python and C.',
      ],
      tags: ['Node.js', 'Vue.js', 'PostgreSQL', 'MySQL', 'Python', 'C'],
      period: 'PLACEHOLDER: project dates',
      repo: 'PLACEHOLDER: repository or demo URL',
    },
  ],

  skills: [
    { group: 'Languages', items: ['Go', 'Python', 'JS/TS', 'SQL', 'C', 'Bash'] },
    { group: 'Backend', items: ['Node.js', 'Elysia', 'REST', 'GraphQL'] },
    { group: 'Frontend', items: ['Vue.js', 'Ionic', 'HTML5', 'CSS3'] },
    { group: 'DevOps & Infrastructure', items: ['Docker', 'Ansible', 'Caddy', 'Linux administration'] },
    { group: 'Databases', items: ['PostgreSQL', 'MySQL', 'SQLite'] },
  ],

  education: [
    {
      degree: 'Computer Engineering',
      school: 'Skyro',
      period: 'Sep 2025 – Jun 2030 (Expected)',
      location: 'Bratislava',
    },
  ],

  languages: [
    { name: 'Slovak', level: 'Native' },
    { name: 'English', level: 'Professional working proficiency' },
  ],

  interests: [
    'Linux administration',
    'Self-hosting',
    'DevOps automation',
    'AI-assisted development',
    'Computer hardware',
    'Web application architecture',
    'Open-source software',
  ],
};
