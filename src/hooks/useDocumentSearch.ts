import { useState, useEffect } from 'react';
import { db, DocumentRecord } from '../lib/organizerDb';

export function useDocumentSearch(query: string) {
  const [results, setResults] = useState<DocumentRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function performSearch() {
      if (!query.trim()) {
        const allDocs = await db.documents.orderBy('timestamp').reverse().toArray();
        if (isMounted) {
          setResults(allDocs);
          setIsSearching(false);
        }
        return;
      }

      setIsSearching(true);
      const searchWord = query.toLowerCase().trim();

      try {
        // Find matching document IDs from the shadow index using prefix search
        const indexMatches = await db.search_index
          .where('word')
          .startsWith(searchWord)
          .toArray();

        const docIds = Array.from(new Set(indexMatches.map(match => match.documentId)));

        if (docIds.length > 0) {
          const docs = await db.documents.where('id').anyOf(docIds).toArray();
          if (isMounted) {
            setResults(docs.sort((a, b) => b.timestamp - a.timestamp));
          }
        } else {
          if (isMounted) setResults([]);
        }
      } catch (e) {
        console.error("Search failed", e);
        if (isMounted) setResults([]);
      } finally {
        if (isMounted) setIsSearching(false);
      }
    }

    performSearch();

    return () => {
      isMounted = false;
    };
  }, [query]);

  return { results, isSearching };
}
