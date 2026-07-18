const REFERENCE_PATTERN = /\{\{([a-z]+(?:\.[A-Za-z0-9_]+)+)\}\}/g;

export function resolveTextReferences(value, entities, locale) {
  if (typeof value !== "string") return value;
  return value.replace(REFERENCE_PATTERN, (match, id) => entities.get(id)?.name?.[locale] || entities.get(id)?.name?.en || match);
}

export function textReferenceParts(value, entities, locale) {
  if (typeof value !== "string") return [];
  const parts = [];
  let cursor = 0;
  for (const match of value.matchAll(REFERENCE_PATTERN)) {
    if (match.index > cursor) parts.push({ text: value.slice(cursor, match.index) });
    const id = match[1];
    parts.push({ entity: id, label: entities.get(id)?.name?.[locale] || entities.get(id)?.name?.en || match[0] });
    cursor = match.index + match[0].length;
  }
  if (cursor < value.length || parts.length === 0) parts.push({ text: value.slice(cursor) });
  return parts;
}

export function referencesInText(value) {
  if (typeof value !== "string") return [];
  return [...value.matchAll(REFERENCE_PATTERN)].map((match) => match[1]);
}

export function hasMalformedTextReference(value) {
  if (typeof value !== "string") return false;
  const openingDelimiters = value.match(/\{\{/g)?.length || 0;
  const closingDelimiters = value.match(/\}\}/g)?.length || 0;
  return openingDelimiters !== closingDelimiters || /\{\{[^}]*\{\{/.test(value);
}

export function entityMentions(value, entities, locale) {
  if (typeof value !== "string") return [];
  const names = entityNames(entities, locale);
  const mentions = [];
  for (const [name, ids] of names) {
    if (ids.length !== 1) continue;
    let index = value.indexOf(name);
    while (index >= 0) {
      if (!insideReference(value, index)) mentions.push({ id: ids[0], name, index });
      index = value.indexOf(name, index + name.length);
    }
  }
  return mentions.sort((left, right) => left.index - right.index || right.name.length - left.name.length);
}

export function ambiguousEntityMentions(value, entities, locale) {
  if (typeof value !== "string") return [];
  const mentions = [];
  for (const [name, ids] of entityNames(entities, locale)) {
    if (ids.length < 2) continue;
    let index = value.indexOf(name);
    while (index >= 0) {
      if (!insideReference(value, index)) mentions.push({ ids, name, index });
      index = value.indexOf(name, index + name.length);
    }
  }
  return mentions.sort((left, right) => left.index - right.index || right.name.length - left.name.length);
}

function entityNames(entities, locale) {
  const names = new Map();
  for (const entity of entities.values()) {
    const name = entity.name?.[locale] || entity.name?.en;
    if (!name || name.length < 2) continue;
    const matches = names.get(name) || [];
    matches.push(entity.id);
    names.set(name, matches);
  }
  return names;
}

function insideReference(value, index) {
  const open = value.lastIndexOf("{{", index);
  if (open < 0) return false;
  const close = value.lastIndexOf("}}", index);
  return close < open;
}
