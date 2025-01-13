import React, { useState } from 'react';
import axios from 'axios';
import styled from 'styled-components';
import './App.css';
import { TextField, CircularProgress, Button, Typography, Alert } from '@mui/material';

interface SearchResult {
  pageid: number;
  title: string;
  snippet: string;
}

const App: React.FC = () => {
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<string>('');
  const [references, setReferences] = useState<{ url: string, title: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState<boolean>(true);
  const [isFocused, setIsFocused] = useState<boolean>(false);

  const searchWikipedia = async (searchTerm: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`https://en.wikipedia.org/w/api.php`, {
        params: {
          action: 'query',
          list: 'search',
          srsearch: searchTerm,
          format: 'json',
          origin: '*'
        }
      });
      const searchResults = response.data.query.search.map((result: { pageid: number; title: string; snippet: string; }) => ({
        pageid: result.pageid,
        title: result.title,
        snippet: result.snippet
      }));
      const filteredResults = await filterResultsByCategory(searchResults);
      setResults(filteredResults);
    } catch (error) {
      setError('Error fetching data from Wikipedia');
      console.error('Error fetching data from Wikipedia', error);
    } finally {
      setLoading(false);
    }
  };

  const filterResultsByCategory = async (results: SearchResult[]) => {
    const filteredResults = [];
    for (const result of results) {
      const response = await axios.get(`https://en.wikipedia.org/w/api.php`, {
        params: {
          action: 'query',
          pageids: result.pageid,
          prop: 'categories',
          format: 'json',
          origin: '*'
        }
      });
      const categories = response.data.query.pages[result.pageid].categories;
      if (!categories.some((category: { title: string }) => category.title.toLowerCase().includes('sex'))) {
        filteredResults.push(result);
      }
    }
    return filteredResults;
  };

  const fetchArticleContent = async (pageId: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`https://en.wikipedia.org/w/api.php`, {
        params: {
          action: 'parse',
          pageid: pageId,
          prop: 'text|externallinks',
          format: 'json',
          origin: '*'
        }
      });
      const article = response.data.parse.text['*'];
      const refs = response.data.parse.externallinks;
      const articleContent = article.split('</p>').slice(0, 4).join('</p>') + '</p>'; // Include more paragraphs
      const referencesWithTitles = refs.map((url: string) => ({ url, title: url.split('/').pop() || 'Unknown' }));
      setSelectedArticle(articleContent);
      setReferences(referencesWithTitles);
      setShowResults(false);
    } catch (error) {
      setError('Error fetching article content from Wikipedia');
      console.error('Error fetching article content from Wikipedia', error);
    } finally {
      setLoading(false);
    }
  };

  const onSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    searchWikipedia(query);
  };

  const onResultClick = (pageId: number) => {
    fetchArticleContent(pageId);
  };

  return (
    <Container>
      <Header>
        <Title variant="h1">
          <span>N</span>
          <span>e</span>
          <span>x</span>
          <span>u</span>
          <span>s</span>
          <span>B</span>
          <span>r</span>
          <span>o</span>
          <span>w</span>
          <span>s</span>
          <span>e</span>
          <span>r</span>
        </Title>
        <Typography variant="subtitle1">Search for articles on Wikipedia</Typography>
      </Header>
      <SearchContainer>
        <form onSubmit={onSearchSubmit} style={{ width: '100%' }}>
          <StyledTextField
            label="Search Wikipedia"
            variant="outlined"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            fullWidth
            style={{ marginBottom: '20px' }}
            InputProps={{
              style: {
                height: '50px',
                fontSize: '20px',
                border: isFocused || query ? '1px solid #4285f4' : 'none',
                boxShadow: isFocused || query ? '0 1px 6px rgba(32, 33, 36, 0.28)' : 'none'
              }
            }}
          />
          <Button type="submit" variant="contained" color="primary" fullWidth style={{ height: '50px', fontSize: '20px' }}>
            Search
          </Button>
        </form>
      </SearchContainer>
      {loading ? (
        <CircularProgress />
      ) : (
        <>
          {error && <Alert severity="error">{error}</Alert>}
          {(results.length > 0 || selectedArticle) && (
            <ContentContainer>
              {showResults && (
                <ResultsContainer>
                  {results.map((result) => (
                    <ResultItem key={result.pageid} onClick={() => onResultClick(result.pageid)}>
                      <h3>{result.title}</h3>
                      <Snippet dangerouslySetInnerHTML={{ __html: result.snippet }}></Snippet>
                      <ReadMore href={`https://en.wikipedia.org/?curid=${result.pageid}`} target="_blank" rel="noopener noreferrer">Read more</ReadMore>
                    </ResultItem>
                  ))}
                </ResultsContainer>
              )}
              <ReferencesContainer>
                <h2>Results</h2>
                {references.map((ref, index) => (
                  <ReferenceItem key={index}>
                    <a href={ref.url} target="_blank" rel="noopener noreferrer">{ref.title}</a>
                  </ReferenceItem>
                ))}
              </ReferencesContainer>
              <ArticleContainer dangerouslySetInnerHTML={{ __html: selectedArticle }} />
            </ContentContainer>
          )}
        </>
      )}
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  max-width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 50px;
`;

const Title = styled(Typography)`
  font-family: 'Ubuntu', sans-serif;
  font-size: 3rem;
  display: flex;
  justify-content: center;
  & > span:nth-child(1) { color: #4285f4; }
  & > span:nth-child(2) { color: #ea4335; }
  & > span:nth-child(3) { color: #fbbc05; }
  & > span:nth-child(4) { color: #34a853; }
  & > span:nth-child(5) { color: #4285f4; }
  & > span:nth-child(6) { color: #ea4335; }
  & > span:nth-child(7) { color: #fbbc05; }
  & > span:nth-child(8) { color: #34a853; }
  & > span:nth-child(9) { color: #4285f4; }
  & > span:nth-child(10) { color: #ea4335; }
  & > span:nth-child(11) { color: #fbbc05; }
  & > span:nth-child(12) { color: #34a853; }
`;

const SearchContainer = styled.div`
  width: 100%;
  max-width: 600px;
`;

const StyledTextField = styled(TextField)`
  & .MuiOutlinedInput-root {
    & fieldset {
      border-color: transparent;
    }

    &:hover fieldset {
      border-color: transparent;
    }

    &.Mui-focused fieldset {
      border-color: #4285f4;
      box-shadow: 0 0 8px rgba(66, 133, 244, 0.6); /* Add blue glow */
    }

    background-color: #ffffff; /* Set background color to white */
    color: #ffffff; /* Set text color to dark */
  }

  & .MuiInputBase-input {
    font-size: 20px; /* Increase font size */
    padding: 10px; /* Add padding */
  }
`;

const ContentContainer = styled.div`
  display: flex;
  width: 100%;
  max-width: 1280px;
  margin-top: 20px;
`;

const ResultsContainer = styled.div`
  flex: 1;
  margin-right: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const ResultItem = styled.div`
  padding: 20px;
  border: 1px solid #dfe1e5;
  border-radius: 8px;
  background-color: #f8f9fa;
  color: #202124;
  box-shadow: 0 1px 6px rgba(32, 33, 36, 0.28);
  transition: transform 0.2s, box-shadow 0.2s;
  cursor: pointer;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 4px 12px rgba(32, 33, 36, 0.28);
  }

  h3 {
    margin: 0;
    font-size: 1.5rem;
    color: #1a0dab;
  }

  p {
    margin: 10px 0;
    font-size: 1rem;
    color: #4d5156;
  }

  a {
    color: #1a0dab;
    text-decoration: none;
    font-weight: bold;
  }

  a:hover {
    text-decoration: underline;
  }
`;

const Snippet = styled.p`
  color: #555;
  font-size: 16px;
`;

const ReadMore = styled.a`
  color: #1a0dab;
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
`;

const ArticleContainer = styled.div`
  flex: 1;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow-y: auto;
  margin-left: 20px;
`;

const ReferencesContainer = styled.div`
  flex: 1;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow-y: auto;
  margin-right: 20px;
  display: flex;
  flex-direction: column;
  align-items: flex-start; /* Align items to the left */
`;

const ReferenceItem = styled.div`
  margin-bottom: 10px;
  text-align: left; /* Align text to the left */
  font-size: 16px; /* Make the font size smaller */
  line-height: 1.5;
`;

export default App;