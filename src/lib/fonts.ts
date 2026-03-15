export function extractFontFamily(input: string): string | null {
  try {
    let url = input;
    // Extract URL from <link href="...">
    const linkMatch = input.match(/href=["']([^"']+)["']/);
    if (linkMatch) url = linkMatch[1];
    
    // Extract URL from @import url(...)
    const importMatch = input.match(/url\(["']?([^"')]+)["']?\)/);
    if (importMatch) url = importMatch[1];

    const urlObj = new URL(url);
    if (urlObj.hostname !== 'fonts.googleapis.com') {
      return null;
    }
    const familyParam = urlObj.searchParams.get('family');
    if (!familyParam) return null;
    
    // The family param might have weights, e.g. "Inter:wght@400;700" or "Open+Sans"
    // We just need the name part before the colon
    const firstFamily = familyParam.split('&')[0]; // Handle multiple families if present, though usually it's one per param or multiple family= params.
    // Actually searchParams.get('family') returns the first one.
    const namePart = firstFamily.split(':')[0];
    return namePart.replace(/\+/g, ' ');
  } catch (e) {
    return null;
  }
}

export function extractFontUrl(input: string): string | null {
  try {
    let url = input;
    // Extract URL from <link href="...">
    const linkMatch = input.match(/href=["']([^"']+)["']/);
    if (linkMatch) url = linkMatch[1];
    
    // Extract URL from @import url(...)
    const importMatch = input.match(/url\(["']?([^"')]+)["']?\)/);
    if (importMatch) url = importMatch[1];

    const urlObj = new URL(url);
    if (urlObj.hostname !== 'fonts.googleapis.com') {
      return null;
    }
    return url;
  } catch (e) {
    return null;
  }
}

export function injectGoogleFont(url: string, fontId: string = 'agent-custom-font') {
  // Remove existing custom font link if present
  const existingLink = document.getElementById(fontId);
  if (existingLink) {
    existingLink.remove();
  }

  const link = document.createElement('link');
  link.id = fontId;
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
}
