import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, Clock, ExternalLink, Play, Square } from 'lucide-react';
import { ArticleSummary } from '../hooks/useWikipedia';

interface ArticleViewProps {
  isDark: boolean;
  article: ArticleSummary | null;
  articleLoading: boolean;
  error: string | null;
  backToResults: () => void;
}

export const ArticleView: React.FC<ArticleViewProps> = ({
  isDark, article, articleLoading, error, backToResults
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

  useEffect(() => {
    return () => {
      // Cleanup audio when component unmounts
      if (synth && isPlaying) {
        synth.cancel();
      }
    };
  }, [synth, isPlaying]);

  const toggleReadAloud = () => {
    if (!synth || !article) return;
    
    if (isPlaying) {
      synth.cancel();
      setIsPlaying(false);
    } else {
      const utterance = new SpeechSynthesisUtterance(`${article.title}. ${article.description ? article.description + '.' : ''} ${article.extract}`);
      utterance.rate = 0.95; // Slightly slower for readability
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      setIsPlaying(true);
      synth.speak(utterance);
    }
  };

  const readingTime = (text: string) => {
    const mins = Math.max(1, Math.ceil(text.trim().split(/\s+/).length / 200));
    return `${mins} min read`;
  };

  return (
    <Container
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    >
      <BackBtn onClick={backToResults} $dark={isDark} whileHover={{ x: -5 }}>
        <ArrowLeft size={18} /> Back tracking results
      </BackBtn>

      {articleLoading && (
        <ProgressWrap>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
            <Loader2 size={40} color={isDark ? '#58a6ff' : '#1a73e8'} />
          </motion.div>
        </ProgressWrap>
      )}

      {error && <ErrorAlert>{error}</ErrorAlert>}

      {article && !articleLoading && (
        <ArticleCard $dark={isDark}>
          <ContentWrapper $hasImage={!!article.thumbnail}>
             {article.thumbnail && (
              <ArticleImg
                src={article.thumbnail.source}
                alt={article.title}
                loading="lazy"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
              />
            )}
            
            <ArticleHeader>
              <ArticleTitle $dark={isDark}>{article.title}</ArticleTitle>
              {article.description && (
                <ArticleDesc $dark={isDark}>{article.description}</ArticleDesc>
              )}
              
              <ArticleMeta $dark={isDark}>
                <MetaItem><Clock size={14} /> {readingTime(article.extract)}</MetaItem>
                {article.content_urls && (
                  <WikiLink
                    href={article.content_urls.desktop.page}
                    target="_blank"
                    rel="noopener noreferrer"
                    $dark={isDark}
                  >
                    Wikipedia <ExternalLink size={14} />
                  </WikiLink>
                )}
                <ReadAloudBtn onClick={toggleReadAloud} $dark={isDark} $isPlaying={isPlaying}>
                  {isPlaying ? <><Square size={14} fill="currentColor" /> Stop Audio</> : <><Play size={14} fill="currentColor" /> Read Aloud</>}
                </ReadAloudBtn>
              </ArticleMeta>
            </ArticleHeader>

            <ArticleExtract $dark={isDark}>
              {article.extract.split('\n').map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </ArticleExtract>
          </ContentWrapper>
        </ArticleCard>
      )}
    </Container>
  );
};

// ── Styled Components for ArticleView ──

interface DP { $dark?: boolean; $hasImage?: boolean; $isPlaying?: boolean; }

const D = {
  surface: (d?: boolean) => d ? 'rgba(22, 27, 34, 0.7)' : 'rgba(255, 255, 255, 0.9)',
  border: (d?: boolean) => d ? 'rgba(48, 54, 61, 0.6)' : 'rgba(223, 225, 229, 0.8)',
  text: (d?: boolean) => d ? '#e6edf3' : '#202124',
  textSub: (d?: boolean) => d ? '#8b949e' : '#5f6368',
  accent: (d?: boolean) => d ? '#58a6ff' : '#1a73e8',
  glassShadow: (d?: boolean) => d ? '0 12px 40px 0 rgba(0, 0, 0, 0.4)' : '0 12px 40px 0 rgba(31, 38, 135, 0.1)',
};

const Container = styled(motion.main)`
  max-width: 860px;
  width: 100%;
  margin: 0 auto;
  padding: 32px 24px 80px;
`;

const BackBtn = styled(motion.button)<DP>`
  background: none;
  border: none;
  cursor: pointer;
  color: ${p => D.accent(p.$dark)};
  font-size: 1.05rem;
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  padding: 0;
  margin-bottom: 32px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
`;

const ProgressWrap = styled.div`
  display: flex;
  justify-content: center;
  padding: 80px 0;
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

const ArticleCard = styled(motion.article)<DP>`
  background: ${p => D.surface(p.$dark)};
  border: 1px solid ${p => D.border(p.$dark)};
  border-radius: 24px;
  padding: 40px;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: ${p => D.glassShadow(p.$dark)};
  
  @media (max-width: 768px) {
    padding: 24px;
  }
`;

const ContentWrapper = styled.div<DP>`
  display: flow-root; /* establishes a new block formatting context */
`;

const ArticleImg = styled(motion.img)`
  float: right;
  max-width: 320px;
  max-height: 400px;
  object-fit: cover;
  border-radius: 16px;
  margin: 0 0 24px 32px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  
  @media (max-width: 768px) {
    float: none;
    max-width: 100%;
    margin: 0 0 24px 0;
  }
`;

const ArticleHeader = styled.header`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 32px;
`;

const ArticleTitle = styled.h1<DP>`
  margin: 0;
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 800;
  font-family: 'Space Grotesk', 'Ubuntu', sans-serif;
  letter-spacing: -1px;
  color: ${p => D.text(p.$dark)};
  line-height: 1.1;
`;

const ArticleDesc = styled.p<DP>`
  margin: 0;
  font-size: 1.25rem;
  font-style: italic;
  font-weight: 500;
  color: ${p => D.textSub(p.$dark)};
`;

const ArticleMeta = styled.div<DP>`
  display: flex;
  align-items: center;
  gap: 20px;
  font-size: 0.95rem;
  color: ${p => D.textSub(p.$dark)};
  flex-wrap: wrap;
  margin-top: 8px;
  font-family: 'Inter', sans-serif;
`;

const MetaItem = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
`;

const WikiLink = styled.a<DP>`
  color: ${p => D.accent(p.$dark)};
  text-decoration: none;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
  &:hover { text-decoration: underline; }
`;

const ReadAloudBtn = styled.button<DP>`
  background: ${p => p.$isPlaying ? 'rgba(234, 67, 53, 0.1)' : 'rgba(26, 115, 232, 0.1)'};
  color: ${p => p.$isPlaying ? '#ea4335' : D.accent(p.$dark)};
  border: 1px solid ${p => p.$isPlaying ? 'rgba(234, 67, 53, 0.2)' : 'rgba(26, 115, 232, 0.2)'};
  border-radius: 20px;
  padding: 6px 12px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
  
  &:hover {
    background: ${p => p.$isPlaying ? 'rgba(234, 67, 53, 0.2)' : 'rgba(26, 115, 232, 0.2)'};
  }
`;

const ArticleExtract = styled.div<DP>`
  font-size: 1.15rem;
  line-height: 1.9;
  color: ${p => D.text(p.$dark)};
  font-family: 'Inter', sans-serif;
  
  p { margin-top: 0; margin-bottom: 24px; }
`;
