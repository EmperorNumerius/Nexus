import { useState, useCallback, useRef } from 'react';
import axios from 'axios';

const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const WIKI_REST = 'https://en.wikipedia.org/api/rest_v1';
const TWO_YEARS_MS = 1000 * 60 * 60 * 24 * 365 * 2;
const PREFIX_MATCH_SNIPPET = 'Wikipedia prefix match result';
const MIN_RESULTS_BEFORE_PREFIX_FALLBACK = 6;

export interface SearchResult {
  pageid: number;
  title: string;
  snippet: string;
  wordcount: number;
  timestamp: string;
  score?: number;
}

export interface ArticleSummary {
  title: string;
  description?: string;
  extract: string;
  thumbnail?: { source: string; width: number; height: number };
  content_urls?: { desktop: { page: string } };
}

const sanitizeSnippet = (html: string) => {
  if (typeof window === 'undefined') return '';
  const parsed = new window.DOMParser().parseFromString(html, 'text/html');
  return (parsed.body.textContent ?? '').replace(/\s+/g, ' ').trim();
};

const scoreResult = (term: string, result: SearchResult) => {
  const q = term.toLowerCase().trim();
  const tokens = q.split(/\s+/).filter(Boolean);
  const title = result.title.toLowerCase();
  const snippet = sanitizeSnippet(result.snippet).toLowerCase();

  let score = 0;
  if (title === q) score += 100;
  if (title.startsWith(q)) score += 40;
  if (title.includes(q)) score += 20;
  tokens.forEach(token => {
    if (title.includes(token)) score += 15;
    if (snippet.includes(token)) score += 6;
  });
  if (result.wordcount >= 300 && result.wordcount <= 4000) score += 5;
  if (result.timestamp && Date.now() - new Date(result.timestamp).getTime() < TWO_YEARS_MS) score += 3;

  return score;
};

export const useWikipedia = () => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [article, setArticle] = useState<ArticleSummary | null>(null);
  const [featuredArticle, setFeaturedArticle] = useState<ArticleSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [articleLoading, setArticleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [didYouMean, setDidYouMean] = useState<string | null>(null);

  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchFeaturedArticle = useCallback(async () => {
    try {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const res = await axios.get(`${WIKI_REST}/feed/featured/${y}/${m}/${d}`);
      if (res.data.tfa) setFeaturedArticle(res.data.tfa);
    } catch {
      // Non-critical
    }
  }, []);

  const fetchSuggestions = useCallback((term: string) => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (!term || term.length < 2) { setSuggestions([]); return; }
    suggestTimer.current = setTimeout(async () => {
      try {
        const res = await axios.get(WIKI_API, {
          params: { action: 'opensearch', search: term, limit: 6, namespace: 0, format: 'json', origin: '*' },
        });
        setSuggestions(res.data[1] ?? []);
      } catch {
        setSuggestions([]);
      }
    }, 220);
  }, []);

  const searchWikipedia = useCallback(async (term: string) => {
    if (!term.trim()) return;
    setLoading(true);
    setError(null);
    setDidYouMean(null);
    setSuggestions([]);
    try {
      const res = await axios.get(WIKI_API, {
        params: {
          action: 'query',
          list: 'search',
          srsearch: term,
          srlimit: 20,
          srprop: 'snippet|wordcount|timestamp',
          srinfo: 'totalhits|suggestion',
          format: 'json',
          origin: '*',
        },
      });
      const raw: SearchResult[] = res.data.query.search.map(
        (r: any) => ({
          pageid: r.pageid,
          title: r.title,
          snippet: sanitizeSnippet(r.snippet),
          wordcount: r.wordcount ?? 0,
          timestamp: r.timestamp ?? '',
        })
      );
      let merged = raw;
      if (raw.length < MIN_RESULTS_BEFORE_PREFIX_FALLBACK) {
        const prefixRes = await axios.get(WIKI_API, {
          params: {
            action: 'query',
            list: 'prefixsearch',
            pssearch: term,
            pslimit: 8,
            format: 'json',
            origin: '*',
          },
        });
        const prefixMapped: SearchResult[] = (prefixRes.data.query?.prefixsearch ?? []).map(
          (r: any) => ({
            pageid: r.pageid,
            title: r.title,
            snippet: PREFIX_MATCH_SNIPPET,
            wordcount: 0,
            timestamp: '',
          })
        );
        const byId = new Map<number, SearchResult>();
        [...prefixMapped, ...raw].forEach(r => byId.set(r.pageid, r));
        merged = Array.from(byId.values());
      }
      const ranked = merged
        .map(r => ({ ...r, score: scoreResult(term, r) }))
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      setResults(ranked);
      setTotalHits(res.data.query.searchinfo?.totalhits ?? 0);
      if (res.data.query.searchinfo?.suggestion) setDidYouMean(res.data.query.searchinfo.suggestion);
    } catch {
      setError('Failed to search Wikipedia. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchArticle = useCallback(async (title: string) => {
    setArticleLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${WIKI_REST}/page/summary/${encodeURIComponent(title)}`);
      setArticle(res.data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError('Failed to load article. Please try again.');
    } finally {
      setArticleLoading(false);
    }
  }, []);

  const fetchRandomArticle = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(WIKI_API, {
        params: { action: 'query', list: 'random', rnlimit: 1, rnnamespace: 0, format: 'json', origin: '*' },
      });
      const title: string = res.data.query.random[0].title;
      setLoading(false);
      await fetchArticle(title);
    } catch {
      setError('Failed to fetch a random article.');
      setLoading(false);
    }
  }, [fetchArticle]);

  return {
    results,
    setResults,
    totalHits,
    article,
    setArticle,
    featuredArticle,
    fetchFeaturedArticle,
    loading,
    articleLoading,
    error,
    suggestions,
    setSuggestions,
    didYouMean,
    fetchSuggestions,
    searchWikipedia,
    fetchArticle,
    fetchRandomArticle
  };
};
