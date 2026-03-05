import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ExternalLink, ChevronRight } from 'lucide-react';
import { SearchResult } from '../hooks/useWikipedia';

interface ResultsViewProps {
  isDark: boolean;
  loading: boolean;
  articleLoading: boolean;
  error: string | null;
  results: SearchResult[];
  totalHits: number;
  query: string;
  didYouMean: string | null;
  setQuery: (q: string) => void;
  searchWikipedia: (q: string) => void;
  fetchArticle: (title: string) => void;
}

const formatHits = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` :
  n >= 1_000 ? `${(n / 1000).toFixed(0)}K` :
  String(n);

export const ResultsView: React.FC<ResultsViewProps> = ({
  isDark, loading, articleLoading, error, results, totalHits, query,
  didYouMean, setQuery, searchWikipedia, fetchArticle
}) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <Container
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      {(loading || articleLoading) && (
        <ProgressWrap>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
            <Loader2 size={36} color={isDark ? '#58a6ff' : '#1a73e8'} />
          </motion.div>
        </ProgressWrap>
      )}

      {error && <ErrorAlert>{error}</ErrorAlert>}

      {!loading && results.length > 0 && (
        <motion.div variants={containerVariants} initial="hidden" animate="show">
          <ResultsStats $dark={isDark}>
            About <strong>{formatHits(totalHits)}</strong> results for "{query}"
          </ResultsStats>

          <AnimatePresence>
            {didYouMean && (
              <ResultsSuggestion
                $dark={isDark}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                Did you mean{' '}
                <SuggestionBtn $dark={isDark} onClick={() => { setQuery(didYouMean); searchWikipedia(didYouMean); }}>
                  {didYouMean}
                </SuggestionBtn>
                ?
              </ResultsSuggestion>
            )}
          </AnimatePresence>

          <ResultsList>
            {results.map(result => (
              <ResultCard
                key={result.pageid}
                $dark={isDark}
                onClick={() => fetchArticle(result.title)}
                variants={itemVariants}
                whileHover={{ x: 6, backgroundColor: isDark ? 'rgba(45, 51, 59, 0.5)' : 'rgba(240, 244, 255, 0.6)' }}
              >
                <ResultCardUrl $dark={isDark}>
                  <img src="https://en.wikipedia.org/static/favicon/wikipedia.ico" alt="Wikipedia" width={16} height={16} />
                  <span>en.wikipedia.org</span> <ChevronRight size={14} style={{ opacity: 0.5 }} /> <span>{result.title}</span>
                </ResultCardUrl>
                <ResultCardTitle $dark={isDark}>{result.title}</ResultCardTitle>
                <ResultCardSnippet
                  $dark={isDark}
                  dangerouslySetInnerHTML={{ __html: result.snippet }} // Fallback if user uses Wikipedia's raw HTML highlighting
                />
                <ResultCardMeta $dark={isDark}>
                  {result.wordcount > 0 && <span>~{result.wordcount.toLocaleString()} words</span>}
                  {result.wordcount > 0 && <span aria-hidden>·</span>}
                  <ExternalLinkWrap
                    href={`https://en.wikipedia.org/?curid=${result.pageid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    $dark={isDark}
                    onClick={e => e.stopPropagation()}
                  >
                    Open on Wikipedia <ExternalLink size={14} />
                  </ExternalLinkWrap>
                </ResultCardMeta>
              </ResultCard>
            ))}
          </ResultsList>
        </motion.div>
      )}

      {!loading && results.length === 0 && !error && (
        <NoResults
          $dark={isDark}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <img src="https://en.wikipedia.org/static/images/project-logos/enwiki.png" alt="Wikipedia logo" style={{ opacity: 0.2, width: 100, marginBottom: 20 }} />
          <p>No results found for <strong>"{query}"</strong></p>
          <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>Try checking your spelling or using more general terms.</p>
        </NoResults>
      )}
    </Container>
  );
};

// ── Styled Components for ResultsView ──

interface DP { $dark?: boolean; }

const D = {
  surfaceHover: (d?: boolean) => d ? 'rgba(45, 51, 59, 0.4)' : 'rgba(240, 244, 255, 0.5)',
  border: (d?: boolean) => d ? 'rgba(48, 54, 61, 0.5)' : 'rgba(223, 225, 229, 0.6)',
  text: (d?: boolean) => d ? '#e6edf3' : '#202124',
  textSub: (d?: boolean) => d ? '#8b949e' : '#5f6368',
  accent: (d?: boolean) => d ? '#58a6ff' : '#1a0dab',
  link: (d?: boolean) => d ? '#8ab4f8' : '#1a0dab',
  snippetMatch: (d?: boolean) => d ? '#c9d1d9' : '#3c4043',
};

const Container = styled(motion.main)`
  max-width: 800px;
  width: 100%;
  padding: 32px 24px 80px;
  margin: 0 auto;
`;

const ProgressWrap = styled.div`
  display: flex;
  justify-content: center;
  padding: 60px 0;
`;

const ErrorAlert = styled.div`
  margin-bottom: 24px;
  padding: 16px;
  background: rgba(234, 67, 53, 0.1);
  color: #ea4335;
  border: 1px solid rgba(234, 67, 53, 0.2);
  border-radius: 12px;
  font-weight: 500;
`;

const ResultsStats = styled.p<DP>`
  font-size: 0.9rem;
  color: ${p => D.textSub(p.$dark)};
  margin: 0 0 24px 16px;
  strong { color: ${p => D.text(p.$dark)}; }
`;

const ResultsSuggestion = styled(motion.p)<DP>`
  margin: 0 0 20px 16px;
  font-size: 1.05rem;
  color: ${p => D.text(p.$dark)};
`;

const SuggestionBtn = styled.button<DP>`
  border: none;
  background: none;
  padding: 0;
  margin: 0 4px;
  color: ${p => D.accent(p.$dark)};
  cursor: pointer;
  font: inherit;
  font-weight: 600;
  font-style: italic;
  &:hover { text-decoration: underline; }
`;

const ResultsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const ResultCard = styled(motion.article)<DP>`
  padding: 24px;
  border: 1px solid ${p => D.border(p.$dark)};
  border-radius: 16px;
  background: ${p => p.$dark ? 'rgba(22, 27, 34, 0.4)' : 'rgba(255, 255, 255, 0.6)'};
  backdrop-filter: blur(8px);
  cursor: pointer;
  transition: border-color 0.2s;
  
  &:hover {
    border-color: ${p => D.accent(p.$dark)};
  }
`;

const ResultCardUrl = styled.div<DP>`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: ${p => D.text(p.$dark)};
  margin-bottom: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  
  img {
    border-radius: 50%;
    background: #fff;
    padding: 2px;
  }
`;

const ResultCardTitle = styled.h3<DP>`
  margin: 0 0 8px;
  font-size: 1.4rem;
  font-weight: 600;
  color: ${p => D.link(p.$dark)};
  line-height: 1.3;
`;

const ResultCardSnippet = styled.p<DP>`
  margin: 0 0 12px;
  font-size: 0.95rem;
  line-height: 1.6;
  color: ${p => D.textSub(p.$dark)};
  
  /* If Wikipedia API returns HTML <span class="searchmatch"> */
  .searchmatch {
    font-weight: 700;
    color: ${p => D.snippetMatch(p.$dark)};
  }
`;

const ResultCardMeta = styled.div<DP>`
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.85rem;
  color: ${p => D.textSub(p.$dark)};
`;

const ExternalLinkWrap = styled.a<DP>`
  display: flex;
  align-items: center;
  gap: 4px;
  color: ${p => D.accent(p.$dark)};
  text-decoration: none;
  font-weight: 500;
  &:hover { text-decoration: underline; }
`;

const NoResults = styled(motion.div)<DP>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  color: ${p => D.text(p.$dark)};
  text-align: center;
  
  strong { color: ${p => D.accent(p.$dark)}; }
`;
