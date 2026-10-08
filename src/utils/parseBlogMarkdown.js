/**
 * Parse frontmatter and content from raw markdown string
 */
export function parseBlogMarkdown(rawContent = '', filePath = '', imageMap = {}) {
  // Extract slug from filePath: e.g. "../data/blogs/learning-god.md" -> "learning-god"
  const m = filePath.match(/(?:^|\/)([^/]+)\.md$/i);
  const slug = m ? m[1] : filePath;

  let title = '';
  let date = '';
  let category = '';
  let summary = '';
  let cover = '';
  let body = typeof rawContent === 'string' ? rawContent : '';

  // Extract frontmatter if present
  if (body.startsWith('---')) {
    const endIdx = body.indexOf('\n---', 3);
    if (endIdx !== -1) {
      const frontmatterStr = body.slice(3, endIdx).trim();
      body = body.slice(endIdx + 4).trim();

      const lines = frontmatterStr.split('\n');
      for (const line of lines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
          const key = line.slice(0, colonIdx).trim().toLowerCase();
          const val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
          if (key === 'title') title = val;
          else if (key === 'date') date = val;
          else if (key === 'category' || key === 'tag' || key === 'label') category = val;
          else if (key === 'summary' || key === 'brief' || key === 'description' || key === 'brief_introduction') summary = val;
          else if (key === 'cover' || key === 'image' || key === 'photo') cover = val;
        }
      }
    }
  }

  // Fallback title (if not specified in frontmatter)
  if (!title) {
    const headingMatch = body.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      title = headingMatch[1].trim();
    } else {
      title = slug.replace(/[_-]/g, ' ') || slug;
    }
  }

  // Parse date strictly from frontmatter into timestamp for sorting
  let timestamp = 0;
  if (date) {
    const parsed = new Date(date.replace(/\//g, '-'));
    if (!isNaN(parsed.getTime())) {
      timestamp = parsed.getTime();
    }
  }

  // Fallback summary (first non-heading text paragraph)
  if (!summary) {
    const textWithoutHeadings = body
      .replace(/^#+.*$/gm, '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .trim();
    const firstPara = textWithoutHeadings.split(/\n\s*\n/)[0] || '';
    summary = firstPara.replace(/\s+/g, ' ').slice(0, 150).trim();
  }

  // Resolve cover image from imageMap if not directly an URL
  if (cover && imageMap) {
    const foundKey = Object.keys(imageMap).find((k) => k.endsWith(`/${cover}`) || k.includes(cover));
    if (foundKey) {
      cover = imageMap[foundKey];
    }
  }

  if (!cover && imageMap) {
    // Try matching image by slug name (e.g. slug.jpg, slug.png)
    const matchedKey = Object.keys(imageMap).find((k) => {
      const imgFile = k.split('/').pop() || '';
      const imgBase = imgFile.replace(/\.[^.]+$/, '');
      return imgBase === slug;
    });
    if (matchedKey) {
      cover = imageMap[matchedKey];
    }
  }

  return {
    slug,
    title,
    date: date || '',
    timestamp,
    category: category || '隨筆',
    summary,
    description: summary,
    cover,
    body,
    filePath,
  };
}

export default parseBlogMarkdown;
