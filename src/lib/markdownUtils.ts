import yaml from 'js-yaml';

export interface ParsedMarkdown {
  frontmatter: Record<string, any>;
  content: string;
}

export function parseMarkdown(text: string): ParsedMarkdown {
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (match) {
    try {
      const frontmatter = yaml.load(match[1]) as Record<string, any>;
      return { frontmatter: frontmatter || {}, content: match[2].trimStart() };
    } catch (e) {
      console.warn('Failed to parse YAML frontmatter', e);
      return { frontmatter: {}, content: text };
    }
  }
  return { frontmatter: {}, content: text };
}

export function stringifyMarkdown(parsed: ParsedMarkdown): string {
  if (Object.keys(parsed.frontmatter).length === 0) {
    return parsed.content;
  }
  try {
    const yamlString = yaml.dump(parsed.frontmatter);
    return `---\n${yamlString}---\n${parsed.content}`;
  } catch (e) {
    console.warn('Failed to stringify YAML frontmatter', e);
    return parsed.content;
  }
}
