// Renders portfolio content into the text files that live in the virtual
// filesystem (~/about.txt, ~/projects/<slug>.md, …).
const heading = (text, ch = '=') => `${text}\n${ch.repeat([...text].length)}`;
const optional = (label, value) => (value ? `${label}: ${value}` : null);
const join = (...parts) => parts.flat().filter((p) => p != null).join('\n') + '\n';

export function aboutTxt({ person, profile }) {
  return join(
    person.name,
    `${person.role} — ${person.location}`,
    person.status,
    '',
    heading(profile.title),
    profile.text,
    '',
    `"${person.quote}"`,
  );
}

export function contactTxt({ contact }) {
  const width = Math.max('Email'.length, ...contact.links.map((l) => l.label.length)) + 2;
  return join(
    heading(contact.heading),
    contact.cta,
    '',
    `${'Email'.padEnd(width)}${contact.email}`,
    contact.links.map((l) => `${l.label.padEnd(width)}${l.url}`),
  );
}

export function skillsTxt({ skills }) {
  const width = Math.max(...skills.map((s) => s.group.length)) + 3;
  return join(heading('Skills'), skills.map((s) => `${s.group.padEnd(width)}${s.items.join(', ')}`));
}

export function educationTxt({ education, languages }) {
  return join(
    heading('Education'),
    education.map((e) => [`${e.degree}, ${e.school}`, `${e.period} · ${e.location}`, '']),
    heading('Languages', '-'),
    languages.map((l) => `${l.name} — ${l.level}`),
  );
}

export function interestsTxt({ interests }) {
  return join(heading('Interests'), interests.map((i) => `- ${i}`));
}

export function experienceMd(job) {
  return join(
    `# ${job.title} — ${job.company}`,
    '',
    `${job.period} · ${job.location}`,
    '',
    job.bullets.map((b) => `- ${b}`),
  );
}

export function projectMd(project) {
  return join(
    `# ${project.title}`,
    '',
    project.bullets.map((b) => `- ${b}`),
    '',
    `Tags: ${project.tags.join(', ')}`,
    optional('Period', project.period),
    optional('Repository', project.repo),
  );
}

export function oryksMd({ oryks }) {
  return join(`# ${oryks.title}`, '', oryks.paragraphs.flatMap((p) => [p, '']).slice(0, -1));
}

export function motd({ person }) {
  return join(
    `Welcome to the machine of ${person.name} — ${person.role}.`,
    'Type `help` for commands, or try `about`, `projects`, `skills` and `contact`.',
  );
}
