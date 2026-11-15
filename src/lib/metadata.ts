export function pageHead(title: string, description: string) {
  return { meta: [{ title: `${title} · SOCHI Slots` }, { name: 'description', content: description }, { property: 'og:title', content: `${title} · SOCHI Slots` }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] };
}

export function adminHead(title: string, description: string) {
  const base = pageHead(`${title} · Admin`, description);
  return { meta: [...base.meta, { name: 'robots', content: 'noindex,nofollow' }] };
}
