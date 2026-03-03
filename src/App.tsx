import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import styled from 'styled-components';
import './App.css';
import { CircularProgress, Alert } from '@mui/material';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchResult {
  pageid: number;
  title: string;
  snippet: string;
  wordcount: number;
  timestamp: string;
  score?: number;
}

interface ArticleSummary {
  title: string;
  description?: string;
  extract: string;
  thumbnail?: { source: string; width: number; height: number };
  content_urls?: { desktop: { page: string } };
}

type View = 'home' | 'results' | 'article';

// ─── Constants ──────────────────────────────────────────────────────────────

const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const WIKI_REST = 'https://en.wikipedia.org/api/rest_v1';
const HISTORY_KEY = 'nexus-search-history';
const THEME_KEY = 'nexus-dark-mode';
const TWO_YEARS_MS = 1000 * 60 * 60 * 24 * 365 * 2;
const PREFIX_MATCH_SNIPPET = 'Wikipedia prefix match result';
const MIN_RESULTS_BEFORE_PREFIX_FALLBACK = 6;

// Rotating Google-style colors for logo letters
const LOGO_COLORS = ['#4285f4', '#ea4335', '#fbbc05', '#34a853'];

const sanitizeSnippet = (html: string) =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

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

// ─── App ─────────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [article, setArticle] = useState<ArticleSummary | null>(null);
  const [featuredArticle, setFeaturedArticle] = useState<ArticleSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [articleLoading, setArticleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('home');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [isDark, setIsDark] = useState(true);
  const [didYouMean, setDidYouMean] = useState<string | null>(null);

  const suggestRef = useRef<HTMLDivElement>(null);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const h = localStorage.getItem(HISTORY_KEY);
    if (h) setHistory(JSON.parse(h));
    const dark = localStorage.getItem(THEME_KEY);
    if (dark !== null) setIsDark(dark === 'true');
    fetchFeaturedArticle();
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const saveHistory = useCallback((term: string) => {
    setHistory(prev => {
      const updated = [term, ...prev.filter(h => h !== term)].slice(0, 8);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  };

  const toggleDark = () => {
    setIsDark(prev => {
      const next = !prev;
      localStorage.setItem(THEME_KEY, String(next));
      return next;
    });
  };

  const readingTime = (text: string) => {
    const mins = Math.max(1, Math.ceil(text.trim().split(/\s+/).length / 200));
    return `${mins} min read`;
  };

  const formatHits = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` :
    n >= 1_000 ? `${(n / 1000).toFixed(0)}K` :
    String(n);

  // ── API calls ─────────────────────────────────────────────────────────────

  const fetchFeaturedArticle = async () => {
    try {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const res = await axios.get(`${WIKI_REST}/feed/featured/${y}/${m}/${d}`);
      if (res.data.tfa) setFeaturedArticle(res.data.tfa);
    } catch {
      // Featured article is non-critical; silently skip
    }
  };

  const fetchSuggestions = useCallback((term: string) => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (!term || term.length < 2) { setSuggestions([]); return; }
    suggestTimer.current = setTimeout(async () => {
      try {
        const res = await axios.get(WIKI_API, {
          params: { action: 'opensearch', search: term, limit: 6, namespace: 0, format: 'json', origin: '*' },
        });
        setSuggestions(res.data[1] ?? []);
        setShowSuggestions(true);
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
    setShowSuggestions(false);
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
        (r: { pageid: number; title: string; snippet: string; wordcount: number; timestamp: string }) => ({
          pageid: r.pageid,
          title: r.title,
          snippet: sanitizeSnippet(r.snippet),
          wordcount: r.wordcount ?? 0,
          timestamp: r.timestamp ?? '',
        }),
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
          (r: { pageid: number; title: string }) => ({
            pageid: r.pageid,
            title: r.title,
            snippet: PREFIX_MATCH_SNIPPET,
            wordcount: 0,
            timestamp: '',
          }),
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
      saveHistory(term);
      setView('results');
    } catch {
      setError('Failed to search Wikipedia. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [saveHistory]);

  const fetchArticle = useCallback(async (title: string) => {
    setArticleLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${WIKI_REST}/page/summary/${encodeURIComponent(title)}`);
      setArticle(res.data);
      setView('article');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError('Failed to load article. Please try again.');
    } finally {
      setArticleLoading(false);
    }
  }, []);

  const fetchRandomArticle = async () => {
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
  };

  // ── Event handlers ────────────────────────────────────────────────────────

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchWikipedia(query);
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (val) { fetchSuggestions(val); setShowSuggestions(true); }
    else setShowSuggestions(false);
  };

  const handleSuggestionPick = (s: string) => {
    setQuery(s);
    setShowSuggestions(false);
    searchWikipedia(s);
  };

  const goHome = () => {
    setView('home');
    setQuery('');
    setResults([]);
    setArticle(null);
    setError(null);
    setShowSuggestions(false);
  };

  const backToResults = () => {
    setView('results');
    setArticle(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppShell $dark={isDark}>
      {/* ── Top bar ── */}
      <TopBar $dark={isDark}>
        <TopBarLeft>
          {view !== 'home' && (
            <LogoSmall onClick={goHome} title="Go home" aria-label="Go home">
              <LogoGlyph aria-hidden />
              {'Nexus'.split('').map((ch, i) => (
                <LogoLetter key={i} style={{ color: LOGO_COLORS[i % LOGO_COLORS.length] }}>{ch}</LogoLetter>
              ))}
            </LogoSmall>
          )}
          {view !== 'home' && (
            <HeaderSearchWrap ref={suggestRef}>
              <form onSubmit={handleSearch} style={{ display: 'flex', width: '100%' }}>
                <HeaderInput
                  value={query}
                  onChange={handleQueryChange}
                  onFocus={() => query && setShowSuggestions(true)}
                  placeholder="Search Wikipedia…"
                  $dark={isDark}
                  aria-label="Search"
                />
                <HeaderSearchBtn type="submit" $dark={isDark} aria-label="Submit search">
                  <span aria-hidden>🔍</span>
                </HeaderSearchBtn>
              </form>
              {showSuggestions && suggestions.length > 0 && (
                <SuggestBox $dark={isDark}>
                  {suggestions.map(s => (
                    <SuggestItem key={s} $dark={isDark} onClick={() => handleSuggestionPick(s)}>
                      &#128269; {s}
                    </SuggestItem>
                  ))}
                </SuggestBox>
              )}
            </HeaderSearchWrap>
          )}
        </TopBarLeft>
        <ThemeBtn onClick={toggleDark} title={isDark ? 'Switch to light mode' : 'Switch to dark mode'} $dark={isDark}>
          {isDark ? '☀️' : '🌙'}
        </ThemeBtn>
      </TopBar>

      {/* ── Home view ── */}
      {view === 'home' && (
        <HomeView>
          <LogoBig>
            <LogoGlyph aria-hidden />
            {'NexusBrowser'.split('').map((ch, i) => (
              <LogoLetter key={i} style={{ color: LOGO_COLORS[i % LOGO_COLORS.length] }}>{ch}</LogoLetter>
            ))}
          </LogoBig>
          <Tagline $dark={isDark}>Explore the world's knowledge, powered by Wikipedia</Tagline>

          <SearchWrap ref={suggestRef}>
            <form onSubmit={handleSearch}>
              <SearchRow>
                <SearchInput
                  value={query}
                  onChange={handleQueryChange}
                  onFocus={() => query && setShowSuggestions(true)}
                  placeholder="Search Wikipedia…"
                  $dark={isDark}
                  autoFocus
                  aria-label="Search Wikipedia"
                />
                <SearchBtn type="submit" disabled={loading} $dark={isDark} aria-label="Submit search">
                  {loading ? <CircularProgress size={20} color="inherit" /> : <span aria-hidden>🔍</span>}
                </SearchBtn>
              </SearchRow>
            </form>
            {showSuggestions && suggestions.length > 0 && (
              <SuggestBox $dark={isDark}>
                {suggestions.map(s => (
                    <SuggestItem key={s} $dark={isDark} onClick={() => handleSuggestionPick(s)}>
                      <span aria-hidden>🔍</span> {s}
                    </SuggestItem>
                ))}
              </SuggestBox>
            )}
          </SearchWrap>

            <ActionRow>
              <ActionBtn onClick={() => { if (query.trim()) searchWikipedia(query); }} $dark={isDark}>
                <span aria-hidden>🔍</span> Search
              </ActionBtn>
            <ActionBtn onClick={fetchRandomArticle} $dark={isDark} disabled={loading}>
              &#127922; Random Article
            </ActionBtn>
          </ActionRow>

          {error && <Alert severity="error" sx={{ mt: 2, maxWidth: 620, mx: 'auto', width: '100%' }}>{error}</Alert>}

          {history.length > 0 && (
            <HistorySection $dark={isDark}>
              <HistoryHeader>
                <HistorySectionTitle $dark={isDark}>Recent Searches</HistorySectionTitle>
                <ClearBtn onClick={clearHistory} $dark={isDark}>Clear all</ClearBtn>
              </HistoryHeader>
              <HistoryList>
                {history.map(h => (
                  <HistoryChip key={h} $dark={isDark} onClick={() => { setQuery(h); searchWikipedia(h); }}>
                    &#128336; {h}
                  </HistoryChip>
                ))}
              </HistoryList>
            </HistorySection>
          )}

          {featuredArticle && (
            <FeaturedSection $dark={isDark}>
              <SectionLabel $dark={isDark}>&#128240; Article of the Day</SectionLabel>
              <FeaturedCard $dark={isDark} onClick={() => fetchArticle(featuredArticle.title)}>
                {featuredArticle.thumbnail && (
                  <FeaturedImg
                    src={featuredArticle.thumbnail.source}
                    alt={featuredArticle.title}
                    loading="lazy"
                  />
                )}
                <FeaturedBody>
                  <FeaturedTitle $dark={isDark}>{featuredArticle.title}</FeaturedTitle>
                  {featuredArticle.description && (
                    <FeaturedDesc $dark={isDark}>{featuredArticle.description}</FeaturedDesc>
                  )}
                  <FeaturedExtract $dark={isDark}>
                    {featuredArticle.extract.slice(0, 300)}
                    {featuredArticle.extract.length > 300 ? '…' : ''}
                  </FeaturedExtract>
                  <ReadMoreBtn $dark={isDark}>Read article →</ReadMoreBtn>
                </FeaturedBody>
              </FeaturedCard>
            </FeaturedSection>
          )}
        </HomeView>
      )}

      {/* ── Results view ── */}
      {view === 'results' && (
        <ResultsView>
          {(loading || articleLoading) && (
            <ProgressWrap><CircularProgress size={32} /></ProgressWrap>
          )}
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {!loading && results.length > 0 && (
            <>
              <ResultsStats $dark={isDark}>
                About <strong>{formatHits(totalHits)}</strong> results for "{query}"
              </ResultsStats>
              {didYouMean && (
                <ResultsSuggestion $dark={isDark}>
                  Did you mean{' '}
                  <SuggestionBtn $dark={isDark} onClick={() => { setQuery(didYouMean); searchWikipedia(didYouMean); }}>
                    {didYouMean}
                  </SuggestionBtn>
                  ?
                </ResultsSuggestion>
              )}
              <ResultsList>
                {results.map(result => (
                  <ResultCard key={result.pageid} $dark={isDark} onClick={() => fetchArticle(result.title)}>
                    <ResultCardUrl $dark={isDark}>
                      en.wikipedia.org › wiki › {result.title.replace(/ /g, '_')}
                    </ResultCardUrl>
                    <ResultCardTitle $dark={isDark}>{result.title}</ResultCardTitle>
                    <ResultCardSnippet $dark={isDark}>{result.snippet}</ResultCardSnippet>
                    <ResultCardMeta $dark={isDark}>
                      {result.wordcount > 0 && <span>~{result.wordcount.toLocaleString()} words</span>}
                      {result.wordcount > 0 && <span aria-hidden>·</span>}
                      <ExternalLink
                        href={`https://en.wikipedia.org/?curid=${result.pageid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        $dark={isDark}
                        onClick={e => e.stopPropagation()}
                      >
                        Open on Wikipedia ↗
                      </ExternalLink>
                    </ResultCardMeta>
                  </ResultCard>
                ))}
              </ResultsList>
            </>
          )}
          {!loading && results.length === 0 && !error && (
            <NoResults $dark={isDark}>No results found for &ldquo;{query}&rdquo;. Try a different term.</NoResults>
          )}
        </ResultsView>
      )}

      {/* ── Article view ── */}
      {view === 'article' && (
        <ArticleView>
          {articleLoading && <ProgressWrap><CircularProgress size={32} /></ProgressWrap>}
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {article && !articleLoading && (
            <>
              <BackBtn onClick={backToResults} $dark={isDark}>&#8592; Back to results</BackBtn>
              <ArticleCard $dark={isDark}>
                {article.thumbnail && (
                  <ArticleImg
                    src={article.thumbnail.source}
                    alt={article.title}
                    loading="lazy"
                  />
                )}
                <ArticleHeader>
                  <ArticleTitle $dark={isDark}>{article.title}</ArticleTitle>
                  {article.description && (
                    <ArticleDesc $dark={isDark}>{article.description}</ArticleDesc>
                  )}
                  <ArticleMeta $dark={isDark}>
                    <span>&#128214; {readingTime(article.extract)}</span>
                    {article.content_urls && (
                      <WikiLink
                        href={article.content_urls.desktop.page}
                        target="_blank"
                        rel="noopener noreferrer"
                        $dark={isDark}
                      >
                        View full article on Wikipedia ↗
                      </WikiLink>
                    )}
                  </ArticleMeta>
                </ArticleHeader>
                <ArticleDivider $dark={isDark} />
                <ArticleExtract $dark={isDark}>{article.extract}</ArticleExtract>
              </ArticleCard>
            </>
          )}
        </ArticleView>
      )}
    </AppShell>
  );
};

// ─── Styled Components ───────────────────────────────────────────────────────

// Dark/light tokens
const D = {
  bg: (dark: boolean) => dark ? '#0d1117' : '#f8f9fa',
  surface: (dark: boolean) => dark ? '#161b22' : '#ffffff',
  surfaceHover: (dark: boolean) => dark ? '#1c2330' : '#f0f4ff',
  border: (dark: boolean) => dark ? '#30363d' : '#dfe1e5',
  text: (dark: boolean) => dark ? '#e6edf3' : '#202124',
  textSub: (dark: boolean) => dark ? '#8b949e' : '#4d5156',
  accent: (dark: boolean) => dark ? '#58a6ff' : '#4285f4',
  accentHover: (dark: boolean) => dark ? '#79b8ff' : '#1a73e8',
  link: (dark: boolean) => dark ? '#58a6ff' : '#1a0dab',
  btnBg: (dark: boolean) => dark ? '#21262d' : '#f1f3f4',
  btnText: (dark: boolean) => dark ? '#c9d1d9' : '#3c4043',
  inputBg: (dark: boolean) => dark ? '#0d1117' : '#ffffff',
  shadow: (dark: boolean) => dark
    ? '0 1px 6px rgba(0,0,0,0.5)'
    : '0 1px 6px rgba(32,33,36,0.25)',
  shadowHover: (dark: boolean) => dark
    ? '0 4px 16px rgba(0,0,0,0.7)'
    : '0 4px 12px rgba(32,33,36,0.3)',
};

interface DP { $dark: boolean }

const AppShell = styled.div<DP>`
  min-height: 100vh;
  background: ${p => D.bg(p.$dark)};
  color: ${p => D.text(p.$dark)};
  font-family: 'Ubuntu', sans-serif;
  transition: background 0.25s, color 0.25s;
`;

const TopBar = styled.header<DP>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  border-bottom: 1px solid ${p => D.border(p.$dark)};
  background: ${p => D.surface(p.$dark)};
  position: sticky;
  top: 0;
  z-index: 100;
  gap: 12px;
`;

const TopBarLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  min-width: 0;
`;

const LogoSmall = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  font-family: 'Ubuntu', sans-serif;
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: -0.5px;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  flex-shrink: 0;
  &:focus-visible { outline: 2px solid #4285f4; border-radius: 4px; }
`;

const HeaderSearchWrap = styled.div`
  position: relative;
  flex: 1;
  max-width: 600px;
`;

const HeaderInput = styled.input<DP>`
  flex: 1;
  width: 100%;
  padding: 10px 16px;
  font-size: 16px;
  font-family: 'Ubuntu', sans-serif;
  border: 1px solid ${p => D.border(p.$dark)};
  border-right: none;
  border-radius: 24px 0 0 24px;
  background: ${p => D.inputBg(p.$dark)};
  color: ${p => D.text(p.$dark)};
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  &:focus {
    border-color: ${p => D.accent(p.$dark)};
    box-shadow: 0 0 0 2px ${p => p.$dark ? 'rgba(88,166,255,0.2)' : 'rgba(66,133,244,0.2)'};
  }
`;

const HeaderSearchBtn = styled.button<DP>`
  padding: 10px 18px;
  border: 1px solid ${p => D.border(p.$dark)};
  border-left: none;
  border-radius: 0 24px 24px 0;
  background: ${p => D.btnBg(p.$dark)};
  color: ${p => D.btnText(p.$dark)};
  cursor: pointer;
  font-size: 16px;
  transition: background 0.15s;
  &:hover { background: ${p => p.$dark ? '#2d333b' : '#e8eaed'}; }
`;

const ThemeBtn = styled.button<DP>`
  background: none;
  border: 1px solid ${p => D.border(p.$dark)};
  border-radius: 50%;
  width: 38px;
  height: 38px;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;
  &:hover { background: ${p => D.btnBg(p.$dark)}; }
`;

// ── Home ─────────────────────────────────────────────────────────────────────

const HomeView = styled.main`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 24px 80px;
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
`;

const LogoBig = styled.h1`
  font-family: 'Ubuntu', sans-serif;
  font-size: clamp(2.4rem, 7vw, 4rem);
  font-weight: 700;
  letter-spacing: -1px;
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 8px;
`;

const LogoGlyph = styled.span`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #8ab4ff 0%, #4285f4 45%, #6f42c1 100%);
  box-shadow: 0 0 0 3px rgba(66, 133, 244, 0.15);
  position: relative;
  flex-shrink: 0;
  &::before, &::after {
    content: '';
    position: absolute;
    border-radius: 50%;
    background: #ffffff;
    opacity: 0.95;
  }
  &::before { width: 6px; height: 6px; left: 6px; top: 8px; }
  &::after { width: 5px; height: 5px; right: 6px; bottom: 7px; }
`;

const LogoLetter = styled.span`
  text-shadow: 0 1px 10px rgba(66, 133, 244, 0.1);
`;

const Tagline = styled.p<DP>`
  color: ${p => D.textSub(p.$dark)};
  font-size: 1rem;
  margin: 0 0 36px;
  text-align: center;
`;

const SearchWrap = styled.div`
  position: relative;
  width: 100%;
  max-width: 620px;
`;

const SearchRow = styled.div`
  display: flex;
  width: 100%;
  border-radius: 28px;
  overflow: visible;
`;

const SearchInput = styled.input<DP>`
  flex: 1;
  padding: 14px 20px;
  font-size: 18px;
  font-family: 'Ubuntu', sans-serif;
  border: 1px solid ${p => D.border(p.$dark)};
  border-right: none;
  border-radius: 28px 0 0 28px;
  background: ${p => D.inputBg(p.$dark)};
  color: ${p => D.text(p.$dark)};
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  &:focus {
    border-color: ${p => D.accent(p.$dark)};
    box-shadow: 0 0 0 3px ${p => p.$dark ? 'rgba(88,166,255,0.2)' : 'rgba(66,133,244,0.2)'};
  }
  &::placeholder { color: ${p => D.textSub(p.$dark)}; }
`;

const SearchBtn = styled.button<DP>`
  padding: 14px 22px;
  font-size: 18px;
  border: 1px solid ${p => D.border(p.$dark)};
  border-left: none;
  border-radius: 0 28px 28px 0;
  background: ${p => D.accent(p.$dark)};
  color: #fff;
  cursor: pointer;
  transition: background 0.15s;
  display: flex;
  align-items: center;
  &:hover:not(:disabled) { background: ${p => D.accentHover(p.$dark)}; }
  &:disabled { opacity: 0.7; cursor: not-allowed; }
`;

const SuggestBox = styled.div<DP>`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: ${p => D.surface(p.$dark)};
  border: 1px solid ${p => D.border(p.$dark)};
  border-radius: 12px;
  box-shadow: ${p => D.shadow(p.$dark)};
  overflow: hidden;
  z-index: 200;
`;

const SuggestItem = styled.button<DP>`
  padding: 10px 16px;
  font-size: 15px;
  font-family: 'Ubuntu', sans-serif;
  color: ${p => D.text(p.$dark)};
  cursor: pointer;
  transition: background 0.1s;
  border: none;
  background: transparent;
  width: 100%;
  text-align: left;
  &:hover { background: ${p => D.surfaceHover(p.$dark)}; }
`;

const ActionRow = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 20px;
  flex-wrap: wrap;
  justify-content: center;
`;

const ActionBtn = styled.button<DP>`
  padding: 10px 22px;
  border: 1px solid ${p => D.border(p.$dark)};
  border-radius: 6px;
  background: ${p => D.btnBg(p.$dark)};
  color: ${p => D.btnText(p.$dark)};
  font-size: 15px;
  font-family: 'Ubuntu', sans-serif;
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;
  &:hover:not(:disabled) { background: ${p => D.surfaceHover(p.$dark)}; box-shadow: ${p => D.shadow(p.$dark)}; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

const HistorySection = styled.section<DP>`
  width: 100%;
  max-width: 620px;
  margin-top: 32px;
  padding: 16px 20px;
  border: 1px solid ${p => D.border(p.$dark)};
  border-radius: 12px;
  background: ${p => D.surface(p.$dark)};
`;

const HistoryHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`;

const HistorySectionTitle = styled.h3<DP>`
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${p => D.textSub(p.$dark)};
`;

const ClearBtn = styled.button<DP>`
  background: none;
  border: none;
  cursor: pointer;
  font-size: 13px;
  color: ${p => D.accent(p.$dark)};
  padding: 0;
  &:hover { text-decoration: underline; }
`;

const HistoryList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const HistoryChip = styled.button<DP>`
  padding: 6px 14px;
  border: 1px solid ${p => D.border(p.$dark)};
  border-radius: 20px;
  background: ${p => D.btnBg(p.$dark)};
  color: ${p => D.text(p.$dark)};
  font-size: 14px;
  font-family: 'Ubuntu', sans-serif;
  cursor: pointer;
  transition: background 0.15s;
  &:hover { background: ${p => D.surfaceHover(p.$dark)}; }
`;

const FeaturedSection = styled.section<DP>`
  width: 100%;
  max-width: 620px;
  margin-top: 32px;
`;

const SectionLabel = styled.h2<DP>`
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${p => D.textSub(p.$dark)};
  margin: 0 0 10px;
`;

const FeaturedCard = styled.div<DP>`
  display: flex;
  gap: 16px;
  padding: 20px;
  border: 1px solid ${p => D.border(p.$dark)};
  border-radius: 12px;
  background: ${p => D.surface(p.$dark)};
  box-shadow: ${p => D.shadow(p.$dark)};
  cursor: pointer;
  transition: transform 0.18s, box-shadow 0.18s;
  &:hover {
    transform: translateY(-3px);
    box-shadow: ${p => D.shadowHover(p.$dark)};
  }
`;

const FeaturedImg = styled.img`
  width: 120px;
  height: 120px;
  object-fit: cover;
  border-radius: 8px;
  flex-shrink: 0;
`;

const FeaturedBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
`;

const FeaturedTitle = styled.h3<DP>`
  margin: 0;
  font-size: 1.1rem;
  color: ${p => D.link(p.$dark)};
`;

const FeaturedDesc = styled.p<DP>`
  margin: 0;
  font-size: 0.85rem;
  font-style: italic;
  color: ${p => D.textSub(p.$dark)};
`;

const FeaturedExtract = styled.p<DP>`
  margin: 0;
  font-size: 0.9rem;
  color: ${p => D.textSub(p.$dark)};
  line-height: 1.55;
`;

const ReadMoreBtn = styled.span<DP>`
  font-size: 0.9rem;
  color: ${p => D.accent(p.$dark)};
  margin-top: auto;
  font-weight: 500;
`;

// ── Results ───────────────────────────────────────────────────────────────────

const ResultsView = styled.main`
  max-width: 760px;
  margin: 0 auto;
  padding: 24px 24px 60px;
  width: 100%;
`;

const ProgressWrap = styled.div`
  display: flex;
  justify-content: center;
  padding: 40px 0;
`;

const ResultsStats = styled.p<DP>`
  font-size: 13px;
  color: ${p => D.textSub(p.$dark)};
  margin: 0 0 16px;
`;

const ResultsSuggestion = styled.p<DP>`
  margin: 0 0 12px;
  font-size: 14px;
  color: ${p => D.textSub(p.$dark)};
`;

const SuggestionBtn = styled.button<DP>`
  border: none;
  background: none;
  padding: 0;
  margin: 0 2px;
  color: ${p => D.link(p.$dark)};
  cursor: pointer;
  font: inherit;
  text-decoration: underline;
`;

const ResultsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const ResultCard = styled.article<DP>`
  padding: 16px 0 20px;
  border-bottom: 1px solid ${p => D.border(p.$dark)};
  cursor: pointer;
  transition: background 0.15s;
  border-radius: 6px;
  padding-left: 8px;
  padding-right: 8px;
  &:hover { background: ${p => D.surfaceHover(p.$dark)}; }
  &:last-child { border-bottom: none; }
`;

const ResultCardUrl = styled.div<DP>`
  font-size: 12px;
  color: ${p => D.textSub(p.$dark)};
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ResultCardTitle = styled.h3<DP>`
  margin: 0 0 6px;
  font-size: 1.15rem;
  color: ${p => D.link(p.$dark)};
  font-weight: 500;
`;

const ResultCardSnippet = styled.p<DP>`
  margin: 0 0 8px;
  font-size: 14px;
  line-height: 1.6;
  color: ${p => D.textSub(p.$dark)};
`;

const ResultCardMeta = styled.div<DP>`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: ${p => D.textSub(p.$dark)};
`;

const ExternalLink = styled.a<DP>`
  color: ${p => D.accent(p.$dark)};
  text-decoration: none;
  &:hover { text-decoration: underline; }
`;

const NoResults = styled.p<DP>`
  text-align: center;
  color: ${p => D.textSub(p.$dark)};
  margin-top: 40px;
  font-size: 1rem;
`;

// ── Article ───────────────────────────────────────────────────────────────────

const ArticleView = styled.main`
  max-width: 760px;
  margin: 0 auto;
  padding: 24px 24px 80px;
  width: 100%;
`;

const BackBtn = styled.button<DP>`
  background: none;
  border: none;
  cursor: pointer;
  color: ${p => D.accent(p.$dark)};
  font-size: 15px;
  font-family: 'Ubuntu', sans-serif;
  padding: 0;
  margin-bottom: 20px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  &:hover { text-decoration: underline; }
`;

const ArticleCard = styled.article<DP>`
  background: ${p => D.surface(p.$dark)};
  border: 1px solid ${p => D.border(p.$dark)};
  border-radius: 12px;
  padding: 28px;
  box-shadow: ${p => D.shadow(p.$dark)};
`;

const ArticleImg = styled.img`
  float: right;
  max-width: 220px;
  max-height: 220px;
  object-fit: cover;
  border-radius: 8px;
  margin: 0 0 16px 24px;
  @media (max-width: 480px) {
    float: none;
    max-width: 100%;
    margin: 0 0 16px;
  }
`;

const ArticleHeader = styled.header`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
`;

const ArticleTitle = styled.h2<DP>`
  margin: 0;
  font-size: 1.9rem;
  font-weight: 700;
  color: ${p => D.text(p.$dark)};
  line-height: 1.2;
`;

const ArticleDesc = styled.p<DP>`
  margin: 0;
  font-size: 1rem;
  font-style: italic;
  color: ${p => D.textSub(p.$dark)};
`;

const ArticleMeta = styled.div<DP>`
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 13px;
  color: ${p => D.textSub(p.$dark)};
  flex-wrap: wrap;
`;

const WikiLink = styled.a<DP>`
  color: ${p => D.accent(p.$dark)};
  text-decoration: none;
  font-weight: 500;
  &:hover { text-decoration: underline; }
`;

const ArticleDivider = styled.hr<DP>`
  border: none;
  border-top: 1px solid ${p => D.border(p.$dark)};
  margin: 20px 0;
`;

const ArticleExtract = styled.p<DP>`
  margin: 0;
  font-size: 1rem;
  line-height: 1.8;
  color: ${p => D.text(p.$dark)};
  white-space: pre-wrap;
`;

export default App;
