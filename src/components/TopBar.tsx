import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sun, Moon, Mic } from 'lucide-react';

interface TopBarProps {
  isDark: boolean;
  toggleDark: () => void;
  query: string;
  setQuery: (q: string) => void;
  showSuggestions: boolean;
  setShowSuggestions: (s: boolean) => void;
  suggestions: string[];
  handleSearch: (e: React.FormEvent) => void;
  handleQueryChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSuggestionPick: (s: string) => void;
  goHome: () => void;
  view: 'home' | 'results' | 'article';
  startVoiceSearch: () => void;
  isListening: boolean;
}

const LOGO_COLORS = ['#4285f4', '#ea4335', '#fbbc05', '#34a853'];

export const TopBar: React.FC<TopBarProps> = ({
  isDark, toggleDark, query, showSuggestions, setShowSuggestions,
  suggestions, handleSearch, handleQueryChange, handleSuggestionPick,
  goHome, view, startVoiceSearch, isListening
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
    <Header $dark={isDark} initial={{ y: -60 }} animate={{ y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
      <TopBarLeft>
        <LogoSmall onClick={goHome} title="Go home" aria-label="Go home" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <LogoGlyph aria-hidden />
          <LogoText>
            {'Nexus'.split('').map((ch, i) => (
              <span key={i} style={{ color: LOGO_COLORS[i % LOGO_COLORS.length] }}>{ch}</span>
            ))}
          </LogoText>
        </LogoSmall>

        <AnimatePresence>
          {view !== 'home' && (
             <HeaderSearchWrap
               ref={suggestRef}
               initial={{ opacity: 0, scale: 0.95, width: 0 }}
               animate={{ opacity: 1, scale: 1, width: '100%' }}
               exit={{ opacity: 0, scale: 0.95, width: 0 }}
               transition={{ duration: 0.3 }}
             >
                <form onSubmit={handleSearch} style={{ display: 'flex', width: '100%' }}>
                  <SearchContainer $dark={isDark}>
                    <HeaderInput
                      value={query}
                      onChange={handleQueryChange}
                      onFocus={() => query && setShowSuggestions(true)}
                      placeholder="Search Wikipedia…"
                      $dark={isDark}
                    />
                    <VoiceIconWrapper onClick={startVoiceSearch}>
                      {isListening ? (
                        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                          <Mic size={18} color="#ea4335" />
                        </motion.div>
                      ) : (
                        <Mic size={18} color={isDark ? '#8b949e' : '#5f6368'} />
                      )}
                    </VoiceIconWrapper>
                    <HeaderSearchBtn type="submit" $dark={isDark} aria-label="Submit search">
                      <Search size={16} />
                    </HeaderSearchBtn>
                  </SearchContainer>
                </form>

                <AnimatePresence>
                  {showSuggestions && suggestions.length > 0 && (
                    <SuggestBox
                      $dark={isDark}
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                    >
                      {suggestions.map((s) => (
                        <SuggestItem key={s} $dark={isDark} onClick={() => handleSuggestionPick(s)}>
                          <Search size={14} style={{ marginRight: '10px', opacity: 0.6 }} /> {s}
                        </SuggestItem>
                      ))}
                    </SuggestBox>
                  )}
                </AnimatePresence>
             </HeaderSearchWrap>
          )}
        </AnimatePresence>
      </TopBarLeft>

      <ThemeBtn onClick={toggleDark} title="Toggle theme" $dark={isDark} whileHover={{ rotate: 15 }} whileTap={{ scale: 0.9 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={isDark ? "dark" : "light"}
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {isDark ? <Sun size={20} color="#e6edf3" /> : <Moon size={20} color="#202124" />}
          </motion.div>
        </AnimatePresence>
      </ThemeBtn>
    </Header>
  );
};

// ── Styled Components for TopBar ──

interface DP { $dark?: boolean; }

const D = {
  surface: (d?: boolean) => d ? 'rgba(22, 27, 34, 0.85)' : 'rgba(255, 255, 255, 0.95)',
  surfaceHover: (d?: boolean) => d ? 'rgba(45, 51, 59, 0.8)' : 'rgba(240, 244, 255, 0.9)',
  border: (d?: boolean) => d ? 'rgba(48, 54, 61, 0.5)' : 'rgba(223, 225, 229, 0.6)',
  text: (d?: boolean) => d ? '#e6edf3' : '#202124',
  textSub: (d?: boolean) => d ? '#8b949e' : '#5f6368',
  accent: (d?: boolean) => d ? '#58a6ff' : '#1a73e8',
  glassShadow: (d?: boolean) => d ? '0 4px 24px 0 rgba(0, 0, 0, 0.3)' : '0 4px 24px 0 rgba(31, 38, 135, 0.05)',
  btnBg: (d?: boolean) => d ? 'rgba(45, 51, 59, 0.5)' : 'rgba(241, 243, 244, 0.7)',
};

const Header = styled(motion.header)<DP>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  border-bottom: 1px solid ${p => D.border(p.$dark)};
  background: ${p => D.surface(p.$dark)};
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  position: sticky;
  top: 0;
  z-index: 100;
  gap: 16px;
  box-shadow: ${p => D.glassShadow(p.$dark)};
`;

const TopBarLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 24px;
  flex: 1;
  min-width: 0;
`;

const LogoSmall = styled(motion.button)`
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  flex-shrink: 0;
  border-radius: 8px;
  &:focus-visible { outline: 2px solid #4285f4; outline-offset: 4px; }
`;

const LogoGlyph = styled.span`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, #4285f4, #ea4335, #fbbc05, #34a853, #4285f4);
  box-shadow: 0 0 10px rgba(66, 133, 244, 0.3);
  position: relative;
  &::before {
    content: '';
    position: absolute;
    inset: 4px;
    background: #fff;
    border-radius: 50%;
  }
`;

const LogoText = styled.span`
  font-family: 'Space Grotesk', 'Ubuntu', sans-serif;
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -1px;
`;

const HeaderSearchWrap = styled(motion.div)`
  position: relative;
  max-width: 680px;
  transform-origin: left center;
`;

const SearchContainer = styled.div<DP>`
  display: flex;
  align-items: center;
  width: 100%;
  border-radius: 24px;
  background: ${p => p.$dark ? 'rgba(13, 17, 23, 0.6)' : 'rgba(255, 255, 255, 0.8)'};
  border: 1px solid ${p => D.border(p.$dark)};
  transition: all 0.2s;
  
  &:focus-within {
    border-color: ${p => D.accent(p.$dark)};
    box-shadow: 0 0 0 3px ${p => p.$dark ? 'rgba(88,166,255,0.2)' : 'rgba(26,115,232,0.2)'};
    background: ${p => p.$dark ? '#0d1117' : '#ffffff'};
  }
`;

const HeaderInput = styled.input<DP>`
  flex: 1;
  width: 100%;
  padding: 10px 16px 10px 20px;
  font-size: 1rem;
  font-family: 'Inter', sans-serif;
  background: transparent;
  border: none;
  color: ${p => D.text(p.$dark)};
  outline: none;
  
  &::placeholder { color: ${p => D.textSub(p.$dark)}; }
`;

const VoiceIconWrapper = styled.div`
  padding: 0 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  &:hover { opacity: 0.8; }
`;

const HeaderSearchBtn = styled.button<DP>`
  padding: 8px 16px;
  border: none;
  background: transparent;
  color: ${p => D.accent(p.$dark)};
  cursor: pointer;
  display: flex;
  align-items: center;
  border-radius: 0 24px 24px 0;
  transition: background 0.2s;
  
  &:hover { background: ${p => D.btnBg(p.$dark)}; }
`;

const SuggestBox = styled(motion.div)<DP>`
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: ${p => D.surface(p.$dark)};
  border: 1px solid ${p => D.border(p.$dark)};
  border-radius: 12px;
  box-shadow: ${p => D.glassShadow(p.$dark)};
  overflow: hidden;
  padding: 8px 0;
`;

const SuggestItem = styled(motion.button)<DP>`
  padding: 10px 20px;
  font-size: 0.95rem;
  font-family: 'Inter', sans-serif;
  color: ${p => D.text(p.$dark)};
  cursor: pointer;
  transition: background 0.1s;
  border: none;
  background: transparent;
  width: 100%;
  text-align: left;
  display: flex;
  align-items: center;
  
  &:hover { background: ${p => D.surfaceHover(p.$dark)}; }
`;

const ThemeBtn = styled(motion.button)<DP>`
  background: ${p => D.btnBg(p.$dark)};
  border: 1px solid ${p => D.border(p.$dark)};
  border-radius: 50%;
  width: 40px;
  height: 40px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.2s, border-color 0.2s;
  &:hover { background: ${p => D.surfaceHover(p.$dark)}; border-color: ${p => D.accent(p.$dark)}; }
`;
