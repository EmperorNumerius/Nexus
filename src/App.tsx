import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { AnimatePresence } from 'framer-motion';
import { TopBar } from './components/TopBar';
import { HomeView } from './components/HomeView';
import { ResultsView } from './components/ResultsView';
import { ArticleView } from './components/ArticleView';
import { useWikipedia } from './hooks/useWikipedia';
import './App.css';

type View = 'home' | 'results' | 'article';

const HISTORY_KEY = 'nexus-search-history';
const THEME_KEY = 'nexus-dark-mode';

const App: React.FC = () => {
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>('home');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [isDark, setIsDark] = useState(true);
  
  // Voice Search State
  const [isListening, setIsListening] = useState(false);

  const {
    results, setResults, totalHits, article, setArticle, featuredArticle, fetchFeaturedArticle,
    loading, articleLoading, error, suggestions, setSuggestions, didYouMean,
    fetchSuggestions, searchWikipedia, fetchArticle, fetchRandomArticle
  } = useWikipedia();

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const h = localStorage.getItem(HISTORY_KEY);
    if (h) setHistory(JSON.parse(h));
    const dark = localStorage.getItem(THEME_KEY);
    if (dark !== null) setIsDark(dark === 'true');
    fetchFeaturedArticle();
    
    // Fallback theme based on system preference
    if (dark === null) {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        setIsDark(false);
      }
    }
  }, [fetchFeaturedArticle]);

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

  const handleSearchContext = async (term: string) => {
    saveHistory(term);
    setView('results');
    await searchWikipedia(term);
  };

  // ── Event handlers ────────────────────────────────────────────────────────

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearchContext(query);
    setShowSuggestions(false);
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (val) {
      fetchSuggestions(val);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSuggestionPick = (s: string) => {
    setQuery(s);
    setShowSuggestions(false);
    handleSearchContext(s);
  };

  const goHome = () => {
    setView('home');
    setQuery('');
    setResults([]);
    setArticle(null);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const backToResults = () => {
    setView('results');
    setArticle(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFetchArticleWrapper = async (title: string) => {
    await fetchArticle(title);
    setView('article');
  };

  const handleFetchRandomWrapper = async () => {
    await fetchRandomArticle();
    setView('article');
  };

  // ── Voice Search (Web Speech API) ─────────────────────────────────────────

  const startVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser doesn't support Voice Search. Try Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      if (view === 'article') {
        // Stop current text-to-speech if listening starts
        window.speechSynthesis.cancel();
      }
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      handleSearchContext(transcript);
      setIsListening(false);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    
    recognition.start();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppShell $dark={isDark}>
      <AnimatedBackground $dark={isDark} />
      
      <TopBar
        isDark={isDark}
        toggleDark={toggleDark}
        query={query}
        setQuery={setQuery}
        showSuggestions={showSuggestions}
        setShowSuggestions={setShowSuggestions}
        suggestions={suggestions}
        handleSearch={handleSearch}
        handleQueryChange={handleQueryChange}
        handleSuggestionPick={handleSuggestionPick}
        goHome={goHome}
        view={view}
        startVoiceSearch={startVoiceSearch}
        isListening={isListening}
      />

      <MainContent>
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <HomeView
              key="home"
              isDark={isDark}
              query={query}
              setQuery={setQuery}
              loading={loading}
              error={error}
              suggestions={suggestions}
              showSuggestions={showSuggestions}
              setShowSuggestions={setShowSuggestions}
              handleSearch={handleSearch}
              handleQueryChange={handleQueryChange}
              handleSuggestionPick={handleSuggestionPick}
              fetchRandomArticle={handleFetchRandomWrapper}
              history={history}
              clearHistory={clearHistory}
              searchWikipedia={handleSearchContext}
              featuredArticle={featuredArticle}
              fetchArticle={handleFetchArticleWrapper}
              startVoiceSearch={startVoiceSearch}
              isListening={isListening}
            />
          )}

          {view === 'results' && (
            <ResultsView
              key="results"
              isDark={isDark}
              loading={loading}
              articleLoading={articleLoading}
              error={error}
              results={results}
              totalHits={totalHits}
              query={query}
              didYouMean={didYouMean}
              setQuery={setQuery}
              searchWikipedia={handleSearchContext}
              fetchArticle={handleFetchArticleWrapper}
            />
          )}

          {view === 'article' && (
            <ArticleView
              key="article"
              isDark={isDark}
              article={article}
              articleLoading={articleLoading}
              error={error}
              backToResults={backToResults}
            />
          )}
        </AnimatePresence>
      </MainContent>
    </AppShell>
  );
};

// ── Styled Components ───────────────────────────────────────────────────────

interface DP { $dark: boolean }

const D = {
  bg: (dark: boolean) => dark ? '#0d1117' : '#f4f7fb',
  text: (dark: boolean) => dark ? '#e6edf3' : '#202124',
};

const AppShell = styled.div<DP>`
  min-height: 100vh;
  background-color: ${p => D.bg(p.$dark)};
  color: ${p => D.text(p.$dark)};
  font-family: 'Inter', 'Ubuntu', sans-serif;
  transition: background-color 0.4s ease, color 0.4s ease;
  position: relative;
`;

const AnimatedBackground = styled.div<DP>`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 0;
  pointer-events: none;
  background: ${p => p.$dark 
    ? 'radial-gradient(circle at 15% 50%, rgba(88, 166, 255, 0.05), transparent 25%), radial-gradient(circle at 85% 30%, rgba(234, 67, 53, 0.03), transparent 25%)'
    : 'radial-gradient(circle at 10% 20%, rgba(66, 133, 244, 0.04), transparent 30%), radial-gradient(circle at 90% 80%, rgba(52, 168, 83, 0.04), transparent 30%)'
  };
`;

const MainContent = styled.div`
  position: relative;
  z-index: 1;
`;

export default App;
