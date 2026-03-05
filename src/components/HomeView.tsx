import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, Mic, History, Trash2, BookOpen } from 'lucide-react';
import { ArticleSummary } from '../hooks/useWikipedia';

interface HomeViewProps {
  isDark: boolean;
  query: string;
  setQuery: (q: string) => void;
  loading: boolean;
  error: string | null;
  suggestions: string[];
  showSuggestions: boolean;
  setShowSuggestions: (s: boolean) => void;
  handleSearch: (e: React.FormEvent) => void;
  handleQueryChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSuggestionPick: (s: string) => void;
  fetchRandomArticle: () => void;
  history: string[];
  clearHistory: () => void;
  searchWikipedia: (q: string) => void;
  featuredArticle: ArticleSummary | null;
  fetchArticle: (title: string) => void;
  startVoiceSearch: () => void;
  isListening: boolean;
}

const LOGO_COLORS = ['#4285f4', '#ea4335', '#fbbc05', '#34a853'];

export const HomeView: React.FC<HomeViewProps> = ({
  isDark, query, loading, error, suggestions, showSuggestions,
  setShowSuggestions, handleSearch, handleQueryChange, handleSuggestionPick,
  fetchRandomArticle, history, clearHistory, searchWikipedia, setQuery,
  featuredArticle, fetchArticle, startVoiceSearch, isListening
}) => {
  const suggestRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [setShowSuggestions]);

  return (
    <Container
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
    >
      <LogoContainer>
        <LogoGlyph
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        />
        <LogoText>
          {'NexusSearch'.split('').map((ch, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, type: 'spring' }}
              style={{ color: LOGO_COLORS[i % LOGO_COLORS.length], display: 'inline-block' }}
            >
              {ch}
            </motion.span>
          ))}
        </LogoText>
      </LogoContainer>

      <Tagline $dark={isDark}>Explore the world's knowledge, beautifully.</Tagline>

      <SearchWrap ref={suggestRef}>
        <form onSubmit={handleSearch}>
          <SearchRow $dark={isDark}>
            <SearchIconWrapper>
              <Search size={22} color={isDark ? '#8b949e' : '#5f6368'} />
            </SearchIconWrapper>
            <SearchInput
              value={query}
              onChange={handleQueryChange}
              onFocus={() => query && setShowSuggestions(true)}
              placeholder="Search Wikipedia…"
              $dark={isDark}
              autoFocus
            />
            <VoiceIconWrapper onClick={startVoiceSearch} $isListening={isListening}>
              {isListening ? (
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                  <Mic size={22} color="#ea4335" />
                </motion.div>
              ) : (
                <Mic size={22} color={isDark ? '#8b949e' : '#4285f4'} />
              )}
            </VoiceIconWrapper>
            <SearchBtn type="submit" disabled={loading} $dark={isDark}>
              {loading ? <Loader2 size={20} className="spinner" /> : 'Search'}
            </SearchBtn>
          </SearchRow>
        </form>

        <AnimatePresence>
          {showSuggestions && suggestions.length > 0 && (
            <SuggestBox
              $dark={isDark}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {suggestions.map((s, i) => (
                <SuggestItem key={s} $dark={isDark} onClick={() => handleSuggestionPick(s)}
                 initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                  <Search size={16} style={{ marginRight: '12px', opacity: 0.6 }} /> {s}
                </SuggestItem>
              ))}
            </SuggestBox>
          )}
        </AnimatePresence>
      </SearchWrap>

      <ActionRow>
        <ActionBtn onClick={fetchRandomArticle} $dark={isDark} disabled={loading} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <BookOpen size={18} /> I'm Feeling Curious
        </ActionBtn>
      </ActionRow>

      {error && <ErrorAlert>{error}</ErrorAlert>}

      {history.length > 0 && (
        <HistorySection $dark={isDark} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <HistoryHeader>
            <HistoryTitle $dark={isDark}><History size={16} /> Recent Searches</HistoryTitle>
            <ClearBtn onClick={clearHistory} $dark={isDark}><Trash2 size={14} /> Clear</ClearBtn>
          </HistoryHeader>
          <HistoryList>
            {history.map((h, i) => (
              <HistoryChip key={h} $dark={isDark} onClick={() => { setQuery(h); searchWikipedia(h); }}
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                whileHover={{ scale: 1.05 }}
              >
                {h}
              </HistoryChip>
            ))}
          </HistoryList>
        </HistorySection>
      )}

      {featuredArticle && (
        <FeaturedSection
          $dark={isDark}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          onClick={() => fetchArticle(featuredArticle.title)}
          whileHover={{ y: -5, scale: 1.01 }}
        >
          <SectionLabel $dark={isDark}>✨ Featured Article</SectionLabel>
          <FeaturedCard $dark={isDark}>
            {featuredArticle.thumbnail && (
              <FeaturedImg src={featuredArticle.thumbnail.source} alt={featuredArticle.title} loading="lazy" />
            )}
            <FeaturedBody>
              <FeaturedTitle $dark={isDark}>{featuredArticle.title}</FeaturedTitle>
              {featuredArticle.description && <FeaturedDesc $dark={isDark}>{featuredArticle.description}</FeaturedDesc>}
              <FeaturedExtract $dark={isDark}>
                {featuredArticle.extract.length > 250 ? `${featuredArticle.extract.slice(0, 250)}...` : featuredArticle.extract}
              </FeaturedExtract>
            </FeaturedBody>
          </FeaturedCard>
        </FeaturedSection>
      )}
    </Container>
  );
};

// ── Styled Components for HomeView ──

interface DP { $dark?: boolean; $isListening?: boolean }

const D = {
  bg: (d?: boolean) => d ? 'rgba(13, 17, 23, 0.7)' : 'rgba(255, 255, 255, 0.7)',
  surface: (d?: boolean) => d ? 'rgba(22, 27, 34, 0.6)' : 'rgba(255, 255, 255, 0.8)',
  surfaceHover: (d?: boolean) => d ? 'rgba(45, 51, 59, 0.8)' : 'rgba(240, 244, 255, 0.9)',
  border: (d?: boolean) => d ? 'rgba(48, 54, 61, 0.5)' : 'rgba(223, 225, 229, 0.6)',
  text: (d?: boolean) => d ? '#e6edf3' : '#202124',
  textSub: (d?: boolean) => d ? '#8b949e' : '#5f6368',
  accent: (d?: boolean) => d ? '#58a6ff' : '#1a73e8',
  glassShadow: (d?: boolean) => d ? '0 8px 32px 0 rgba(0, 0, 0, 0.37)' : '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
};

const Container = styled(motion.main)`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10vh 24px 80px;
  max-width: 760px;
  margin: 0 auto;
  width: 100%;
`;

const LogoContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 8px;
`;

const LogoGlyph = styled(motion.div)`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, #4285f4, #ea4335, #fbbc05, #34a853, #4285f4);
  box-shadow: 0 0 20px rgba(66, 133, 244, 0.4);
  position: relative;
  &::before {
    content: '';
    position: absolute;
    inset: 6px;
    background: #fff;
    border-radius: 50%;
  }
`;

const LogoText = styled.h1`
  font-family: 'Space Grotesk', 'Ubuntu', sans-serif;
  font-size: clamp(2.8rem, 8vw, 4.5rem);
  font-weight: 800;
  letter-spacing: -2px;
  margin: 0;
`;

const Tagline = styled.p<DP>`
  color: ${p => D.textSub(p.$dark)};
  font-size: 1.1rem;
  margin: 0 0 40px;
  text-align: center;
  font-weight: 500;
`;

const SearchWrap = styled.div`
  position: relative;
  width: 100%;
  max-width: 680px;
  z-index: 10;
`;

const SearchRow = styled.div<DP>`
  display: flex;
  align-items: center;
  width: 100%;
  border-radius: 32px;
  background: ${p => D.surface(p.$dark)};
  border: 1px solid ${p => D.border(p.$dark)};
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: ${p => D.glassShadow(p.$dark)};
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  padding: 4px;
  
  &:focus-within {
    box-shadow: 0 0 0 3px ${p => p.$dark ? 'rgba(88,166,255,0.3)' : 'rgba(26,115,232,0.3)'};
    border-color: ${p => D.accent(p.$dark)};
    transform: translateY(-2px);
  }
`;

const SearchIconWrapper = styled.div`
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const VoiceIconWrapper = styled.div<DP>`
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s;
  &:hover { transform: scale(1.1); }
`;

const SearchInput = styled.input<DP>`
  flex: 1;
  padding: 16px 0;
  font-size: 1.15rem;
  font-family: 'Inter', sans-serif;
  background: transparent;
  border: none;
  color: ${p => D.text(p.$dark)};
  outline: none;
  &::placeholder { color: ${p => D.textSub(p.$dark)}; }
`;

const SearchBtn = styled.button<DP>`
  padding: 12px 28px;
  font-size: 1.05rem;
  font-weight: 600;
  border: none;
  border-radius: 28px;
  background: ${p => D.accent(p.$dark)};
  color: #fff;
  cursor: pointer;
  margin-right: 4px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover:not(:disabled) {
    background: ${p => p.$dark ? '#79b8ff' : '#1557b0'};
    box-shadow: 0 4px 12px rgba(26, 115, 232, 0.4);
  }
  &:disabled { opacity: 0.7; cursor: not-allowed; }
  
  .spinner { animation: spin 1s linear infinite; }
  @keyframes spin { 100% { transform: rotate(360deg); } }
`;

const SuggestBox = styled(motion.div)<DP>`
  position: absolute;
  top: calc(100% + 12px);
  left: 0;
  right: 0;
  background: ${p => D.surface(p.$dark)};
  border: 1px solid ${p => D.border(p.$dark)};
  border-radius: 16px;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: ${p => D.glassShadow(p.$dark)};
  overflow: hidden;
  padding: 8px 0;
`;

const SuggestItem = styled(motion.button)<DP>`
  padding: 12px 24px;
  font-size: 1.05rem;
  font-family: 'Inter', sans-serif;
  color: ${p => D.text(p.$dark)};
  cursor: pointer;
  transition: background 0.2s;
  border: none;
  background: transparent;
  width: 100%;
  text-align: left;
  display: flex;
  align-items: center;
  &:hover { background: ${p => D.surfaceHover(p.$dark)}; }
`;

const ActionRow = styled.div`
  display: flex;
  gap: 16px;
  margin-top: 32px;
  justify-content: center;
`;

const ActionBtn = styled(motion.button)<DP>`
  padding: 12px 24px;
  border: 1px solid ${p => D.border(p.$dark)};
  border-radius: 12px;
  background: ${p => D.surface(p.$dark)};
  color: ${p => D.text(p.$dark)};
  font-size: 0.95rem;
  font-weight: 600;
  font-family: 'Inter', sans-serif;
  cursor: pointer;
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  &:hover:not(:disabled) {
    border-color: ${p => D.accent(p.$dark)};
    color: ${p => D.accent(p.$dark)};
  }
`;

const ErrorAlert = styled.div`
  margin-top: 24px;
  padding: 16px;
  background: rgba(234, 67, 53, 0.1);
  color: #ea4335;
  border: 1px solid rgba(234, 67, 53, 0.2);
  border-radius: 12px;
  width: 100%;
  max-width: 680px;
  text-align: center;
  font-weight: 500;
`;

const HistorySection = styled(motion.section)<DP>`
  width: 100%;
  max-width: 680px;
  margin-top: 48px;
`;

const HistoryHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding: 0 4px;
`;

const HistoryTitle = styled.h3<DP>`
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${p => D.textSub(p.$dark)};
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ClearBtn = styled.button<DP>`
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  color: ${p => D.textSub(p.$dark)};
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s;
  &:hover { background: rgba(234, 67, 53, 0.1); color: #ea4335; }
`;

const HistoryList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

const HistoryChip = styled(motion.button)<DP>`
  padding: 8px 16px;
  border: 1px solid ${p => D.border(p.$dark)};
  border-radius: 24px;
  background: ${p => D.surface(p.$dark)};
  color: ${p => D.text(p.$dark)};
  font-size: 0.9rem;
  font-family: 'Inter', sans-serif;
  cursor: pointer;
  backdrop-filter: blur(8px);
  &:hover { background: ${p => D.surfaceHover(p.$dark)}; border-color: ${p => D.accent(p.$dark)}; }
`;

const FeaturedSection = styled(motion.section)<DP>`
  width: 100%;
  max-width: 680px;
  margin-top: 48px;
  cursor: pointer;
`;

const SectionLabel = styled.h2<DP>`
  font-size: 0.9rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${p => D.accent(p.$dark)};
  margin: 0 0 16px 4px;
`;

const FeaturedCard = styled.div<DP>`
  display: flex;
  gap: 24px;
  padding: 24px;
  border: 1px solid ${p => D.border(p.$dark)};
  border-radius: 20px;
  background: ${p => D.surface(p.$dark)};
  backdrop-filter: blur(12px);
  box-shadow: ${p => D.glassShadow(p.$dark)};
  transition: border-color 0.3s;
  
  &:hover { border-color: ${p => D.accent(p.$dark)}; }

  @media (max-width: 600px) {
    flex-direction: column;
    gap: 16px;
  }
`;

const FeaturedImg = styled.img`
  width: 140px;
  height: 140px;
  object-fit: cover;
  border-radius: 12px;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  @media (max-width: 600px) {
    width: 100%;
    height: 200px;
  }
`;

const FeaturedBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
`;

const FeaturedTitle = styled.h3<DP>`
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
  color: ${p => D.text(p.$dark)};
  line-height: 1.2;
`;

const FeaturedDesc = styled.p<DP>`
  margin: 0;
  font-size: 0.95rem;
  font-style: italic;
  font-weight: 500;
  color: ${p => D.accent(p.$dark)};
`;

const FeaturedExtract = styled.p<DP>`
  margin: 0;
  font-size: 0.95rem;
  color: ${p => D.textSub(p.$dark)};
  line-height: 1.6;
`;
