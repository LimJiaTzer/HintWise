import { useState, useEffect, memo, useMemo, useRef } from '@lynx-js/react'
import './App.css'
import arrow from './assets/arrow.png'
import logo from './assets/logo.png'

type LynxChangeEvent = {
  detail: {
    value: string
  }
}

// Props for the main App component, required for the testing environment
type AppProps = {
  onRender?: () => void;
}

const HARDCODED_SUGGESTIONS = [
  "What makes a life truly meaningful?",
  "If AI could feel, should it have rights?",
  "How does our perception fundamentally shape reality?",
  "Explain the importance of biodiversity to a child.",
  "What is the most important lesson humanity has yet to learn?",
  "If you could perfectly understand one thing, what would it be?",
  "Create a workout plan for a busy professional.",
  "Write a short, suspenseful story that ends on a cliffhanger.",
  "Help me plan a surprise birthday party.",
  "Summarize the theory of relativity in simple terms.",
  "What are some effective ways to combat procrastination?",
  "Design a unique three-course meal.",
];

const SuggestionRow = memo(({ id, items, direction, onClick }: { id: string, items: string[], direction: 'left' | 'right', onClick: (item: string) => void }) => {
  useEffect(() => {
    const animatedElement = lynx.getElementById(id);
    if (!animatedElement || items.length === 0) return;

    const keyframes = direction === 'left'
      ? [{ transform: 'translateX(0%)' }, { transform: 'translateX(-50%)' }]
      : [{ transform: 'translateX(-50%)' }, { transform: 'translateX(0%)' }];

    const animation = animatedElement.animate(keyframes, {
      duration: 30000,
      iterations: Infinity,
      easing: 'linear',
    });

    return () => animation.cancel();
  }, [id, items, direction]);

  if (items.length === 0) return null;

  return (
    <view className="SuggestionRowContainer">
      <view id={id} className="SuggestionRow">
        {[...items, ...items].map((item, index) => (
          <view key={`${item}-${index}`} className="SuggestionChip" bindtap={() => onClick(item)}>
            <text className="SuggestionChipText">{item} ↗</text>
          </view>
        ))}
      </view>
    </view>
  );
});

const AnimatedInputArea = ({ onSend }: { onSend: (text: string) => void }) => {
  const [inputValue, setInputValue] = useState('');
  const [inputKey, setInputKey] = useState(Date.now());

  const handleLocalSend = () => {
    const text = inputValue.trim();
    if (!text) return;

    onSend(text);
    
    setInputValue('');
    setInputKey(Date.now());
  };

  return (
    <view className='AnimatedBorderContainer'>
      <view className='AnimatedBorderGradient'></view>
      <view className='AnimatedBorderMask'></view>
      <view className='InputArea centered'>
        <textarea
          key={inputKey}
          className='TextInput'
          placeholder='Ask me a question'
          value={inputValue}
          bindinput={(e: LynxChangeEvent) => setInputValue(e.detail.value)}
          maxlines={5}
        />
        <view className='SendButton' bindtap={handleLocalSend}>
          <image src={arrow} className='SendIcon' />
        </view>
      </view>
    </view>
  );
};

export function App({ onRender }: AppProps) {
  const [currentPage, setCurrentPage] = useState<'main' | 'settings'>('main');
  const [isChatActive, setIsChatActive] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [tempApiKey, setTempApiKey] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [summarizedProblem, setSummarizedProblem] = useState<string | null>(null);
  const [hints, setHints] = useState<string[]>([]);
  const [solution, setSolution] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isHintCooldownActive, setIsHintCooldownActive] = useState(false);
  const [hintCooldownTime, setHintCooldownTime] = useState(60);
  const cooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [loadingStates, setLoadingStates] = useState({
    summary: false,
    hint: false,
    solution: false,
  });

  const suggestionRow1 = useMemo(() => suggestions.slice(0, 3), [suggestions]);
  const suggestionRow2 = useMemo(() => suggestions.slice(3, 6), [suggestions]);
  const suggestionRow3 = useMemo(() => suggestions.slice(6, 9), [suggestions]);
  const suggestionRow4 = useMemo(() => suggestions.slice(9, 12), [suggestions]);
  
  useEffect(() => {
    if (onRender) {
      onRender();
    }
  }, []);

  const fetchLLMResponse = async (prompt: string, type: 'summary' | 'hint' | 'solution' | 'suggestions') => {
    if (type !== 'suggestions' && !apiKey) {
      const errorText = "API Key not set. Please go to Settings to add your key.";
      if (type === 'summary') setSummarizedProblem(errorText);
      if (type === 'hint') setHints(prev => [...prev, errorText]);
      if (type === 'solution') setSolution(errorText);
      return;
    }
    
    if (type !== 'suggestions') {
      setLoadingStates(prev => ({ ...prev, [type]: true }));
    }

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
    const payload = { contents: [{ parts: [{ text: prompt }] }] };

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);
      
      const data = await response.json();
      const llmText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (llmText) {
        if (type === 'summary') setSummarizedProblem(llmText);
        if (type === 'hint') setHints(prev => [...prev, llmText]);
        if (type === 'solution') setSolution(llmText);
        if (type === 'suggestions') {
           try {
            const cleanedText = llmText.replace(/```json|```/g, '').trim();
            const parsedSuggestions = JSON.parse(cleanedText);
            setSuggestions(parsedSuggestions);
          } catch (e) {
            console.error("Failed to parse AI suggestions:", e);
            setSuggestions(HARDCODED_SUGGESTIONS);
          }
        }
      } else {
        throw new Error("No response text found.");
      }
    } catch (error) {
      console.error("Error fetching LLM response:", error);
      const errorMessage = "Sorry, I couldn't get a response. Please check your API key and network.";
      if (type === 'summary') setSummarizedProblem(errorMessage);
      if (type === 'hint') setHints(prev => [...prev, errorMessage]);
      if (type === 'solution') setSolution(errorMessage);
      if (type === 'suggestions') setSuggestions(HARDCODED_SUGGESTIONS);
    } finally {
      if (type !== 'suggestions') {
        setLoadingStates(prev => ({ ...prev, [type]: false }));
      }
    }
  };

  useEffect(() => {
    const fetchSuggestions = () => {
      if (apiKey) {
        const suggestionPrompt = `Generate a list of exactly 12 short, diverse, and thought-provoking questions suitable as prompts for a helpful assistant. Output them as a single, clean JSON array of strings. Example: ["question 1", "question 2"]`;
        fetchLLMResponse(suggestionPrompt, 'suggestions');
      } else {
        setSuggestions(HARDCODED_SUGGESTIONS);
      }
    };
    
    if (currentPage === 'main') {
       fetchSuggestions();
    }
  }, [apiKey, currentPage]);
  
  useEffect(() => {
    return () => {
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
      }
    };
  }, []);

  const handleSend = (text: string) => {
    if (!text) return;
    
    setIsChatActive(true);
    setCurrentQuestion(text);
    
    const summaryPrompt = `Rephrase the following user question into a clear, one-sentence problem statement. Focus on the core task or question being asked. User question: "${text}"`;
    fetchLLMResponse(summaryPrompt, 'summary');
    
    const hintPrompt = `The user's problem is: "${text}". Provide a single, direct, and helpful first hint to guide them. Do not give away the final answer. Phrase it as a suggestion or a question to ponder.`;
    fetchLLMResponse(hintPrompt, 'hint');
  };
  
  const handleSuggestionClick = (question: string) => {
    const cleanQuestion = question.replace(/ ↗$/, '');
    handleSend(cleanQuestion);
  };

  const handleGetAnotherHint = () => {
    if (loadingStates.hint || !currentQuestion || isHintCooldownActive) return;
    const hintPrompt = `The user's original problem was: "${currentQuestion}". They have received ${hints.length} hint(s) already. Provide one more small, distinct hint to help them proceed without solving it for them.`;
    fetchLLMResponse(hintPrompt, 'hint');
    setIsHintCooldownActive(true);
    setHintCooldownTime(60);
    cooldownIntervalRef.current = setInterval(() => {
      setHintCooldownTime(prevTime => {
        if (prevTime <= 1) {
          if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
          setIsHintCooldownActive(false);
          return 60;
        }
        return prevTime - 1;
      });
    }, 1000);
  };

  const handleGetSolution = () => {
    if (loadingStates.solution || !currentQuestion) return;
    // --- MODIFIED: Updated solution prompt ---
    const solutionPrompt = `The user's original problem was: "${currentQuestion}". Provide a step-by-step solution, preferably in a concise way.`;
    fetchLLMResponse(solutionPrompt, 'solution');
  };
  
  const handleReset = () => {
    setIsChatActive(false);
    setSummarizedProblem(null);
    setHints([]);
    setSolution(null);
    setCurrentQuestion(null);
    if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
    setIsHintCooldownActive(false);
    setHintCooldownTime(60);
  };

  const handleSaveSettings = () => {
    setApiKey(tempApiKey);
    setCurrentPage('main');
  };

  const handleGoBackToMain = () => {
    handleReset();
    setCurrentPage('main');
  };

  const renderHeader = () => (
    <view className='Header'>
      {currentPage === 'settings' ? (
        <view className='BackButton' bindtap={handleGoBackToMain}>
          <text className='BackButtonText'>Back</text>
        </view>
      ) : (
        <view className='HeaderTitleGroup'>
          <image src={logo} className='HeaderLogo' />
          <text className='HeaderText'>HintWise</text>
        </view>
      )}
      {currentPage === 'main' && (
        <view className='SettingsButton' bindtap={() => { setTempApiKey(apiKey); setCurrentPage('settings'); }}>
          <text className='SettingsButtonText'>Settings</text>
        </view>
      )}
    </view>
  );

  const renderPage = () => {
    if (currentPage === 'settings') {
      return (
        <view className='SettingsPage'>
          <text className='SettingsTitle'>API Key Settings</text>
          <text className='SettingsDescription'>
            Please enter your Google Gemini API key below. You can get a free key from Google AI Studio.
          </text>
          <textarea
            className='ApiInput'
            placeholder='Enter your API key here'
            value={tempApiKey}
            bindinput={(e: LynxChangeEvent) => setTempApiKey(e.detail.value)}
            maxlines={3}
          />
          <view className='SaveButton' bindtap={handleSaveSettings}>
            <text className='SaveButtonText'>Save and Return</text>
          </view>
        </view>
      );
    }

    return isChatActive ? (
      <>
        <scroll-view className='Content' scroll-orientation="vertical">
          <view className='WorksheetContainer'>
            <view className='SectionBox problem'>
              <text className='SectionHeader'>Problem</text>
              <text className={loadingStates.summary ? 'ProblemStatement LoadingText' : 'ProblemStatement'}>
                {loadingStates.summary ? 'Summarizing question...' : summarizedProblem}
              </text>
            </view>
            <view className='SectionBox hints'>
              <text className='SectionHeader'>Hints</text>
              {hints.map((hint, index) => (
                <text key={index} className='HintText'>• {hint}</text>
              ))}
              {loadingStates.hint && <text className='HintText LoadingText'>HintWise is thinking...</text>}
            </view>
            {(solution || loadingStates.solution) && (
                <view className='SectionBox solution'>
                <text className='SectionHeader'>Solution</text>
                <text className={loadingStates.solution ? 'SolutionText LoadingText' : 'SolutionText'}>
                  {loadingStates.solution ? 'HintWise is thinking...' : solution}
                </text>
              </view>
            )}
          </view>
        </scroll-view>
        <view className='ActionArea'>
          <view className={`ActionButton hint ${isHintCooldownActive || loadingStates.hint ? 'disabled' : ''}`} bindtap={handleGetAnotherHint}>
            <text className='ActionButtonText'>
              {isHintCooldownActive ? `Next Hint in ${hintCooldownTime}s` : 'Another Hint'}
            </text>
          </view>
          <view className={`ActionButton solution ${loadingStates.solution ? 'disabled' : ''}`} bindtap={handleGetSolution}>
            <text className='ActionButtonText'>Solution</text>
          </view>
          <view className='ResetButton' bindtap={handleReset}>
            <text className='ResetButtonText'>⟳</text>
          </view>
        </view>
      </>
    ) : (
      <view className='HomePageContainer'>
        <SuggestionRow id="row1" items={suggestionRow1} direction="left" onClick={handleSuggestionClick} />
        <SuggestionRow id="row2" items={suggestionRow2} direction="right" onClick={handleSuggestionClick} />
        <AnimatedInputArea onSend={handleSend} />
        <SuggestionRow id="row3" items={suggestionRow3} direction="left" onClick={handleSuggestionClick} />
        <SuggestionRow id="row4" items={suggestionRow4} direction="right" onClick={handleSuggestionClick} />
      </view>
    );
  };
  
  return (
    <view className='AppContainer'>
      <view className='App' adjust-keyboard={true}>
        {renderHeader()}
        <view className='Divider' />
        {renderPage()}
      </view>
    </view>
  );
}








