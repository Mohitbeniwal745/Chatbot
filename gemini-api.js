/**
 * Gemini API Integration Module
 * Handles interaction with Gemini 2.0 Flash API for advanced speech analysis
 */

class GeminiAPI {
    constructor() {
        this.apiKey = 'AIzaSyCR96GTJ47jkxjICP97kiACfrzdxZDaLaM'; // Default API key
        this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
        this.isApiKeySet = true; // Set to true since we have a default key
        this.contextHistory = [];
    }

    /**
     * Set the API key for Gemini API
     * @param {string} key - The API key
     */
    setApiKey(key) {
        if (key && key.trim().length > 0) {
            this.apiKey = key;
            this.isApiKeySet = true;
            localStorage.setItem('geminiApiKey', key);
            return true;
        }
        return false;
    }

    /**
     * Try to load API key from local storage
     */
    loadApiKey() {
        const savedKey = localStorage.getItem('geminiApiKey');
        if (savedKey) {
            return this.setApiKey(savedKey);
        }
        return false;
    }

    /**
     * Check if API key is set
     * @returns {boolean} - True if API key is set
     */
    hasApiKey() {
        return this.isApiKeySet;
    }

    /**
     * Analyze the speech transcript using Gemini API
     * @param {string} transcript - The speech transcript to analyze
     * @param {object} metrics - Speech metrics like pace, filler words, etc.
     * @param {string} scenario - The practice scenario context
     * @returns {Promise<object>} - The analysis result
     */
    async analyzeTranscript(transcript, metrics, scenario = 'general') {
        if (!this.isApiKeySet) {
            throw new Error('API key not set');
        }

        if (!transcript || transcript.trim().length === 0) {
            throw new Error('Transcript is empty');
        }

        try {
            // Create context and prompt
            const context = this._createContext(scenario);
            const prompt = {
                contents: [{
                    parts: [{
                        text: `You are a professional speech coach. Analyze the following speech transcript and metrics to provide detailed, actionable feedback.

Transcript: "${transcript}"

Speaking Metrics:
- Words per minute: ${metrics.wpm}
- Filler word count: ${metrics.fillerWordCount}
- Vocabulary diversity: ${(metrics.vocabularyDiversity * 100).toFixed(1)}%
- Duration: ${metrics.duration} seconds

Context: ${context}

Focus on:
1. Speaking pace and rhythm
2. Filler word usage and verbal habits
3. Vocabulary choice and variety
4. Sentence structure and flow
5. Overall clarity and impact
6. Specific improvements based on the practice scenario

Respond with a JSON object in this exact format:
{
    "toneFeedback": "<emotional tone assessment>",
    "overallScore": <number between 1-10>,
    "corrections": [
        {
            "type": "suggestion",
            "original": "<problematic phrase or pattern>",
            "correction": "<improved version>",
            "explanation": "<brief, actionable explanation>"
        }
    ],
    "feedback": "<general feedback paragraph>",
    "improvements": [
        "<specific improvement suggestion 1>",
        "<specific improvement suggestion 2>",
        "<specific improvement suggestion 3>"
    ]
}

Keep feedback constructive and actionable. Focus on patterns rather than individual words unless they significantly impact clarity.`
                    }]
                }]
            };
            
            // Make API request
            const response = await this._makeApiRequest(prompt);
            
            // Process and return the analysis
            return this._processResponse(response);
        } catch (error) {
            console.error('Error analyzing transcript:', error);
            throw error;
        }
    }

    /**
     * Create the context for the prompt based on scenario
     * @param {string} scenario - The practice scenario
     * @returns {string} - The context
     */
    _createContext(scenario) {
        const contexts = {
            'interview': 'You are in a job interview setting. Provide professional and concise responses.',
            'social': 'You are in a casual social conversation. Keep responses friendly and engaging.',
            'public': 'You are giving a public speech or presentation. Focus on clarity, structure, and engagement.',
            'general': 'You are practicing general speaking skills. Focus on clear communication.'
        };

        return contexts[scenario] || contexts.general;
    }

    /**
     * Make API request to Gemini
     * @param {object} prompt - The formatted prompt
     * @returns {Promise<object>} - The API response
     */
    async _makeApiRequest(prompt) {
        const endpoint = `${this.apiUrl}?key=${this.apiKey}`;
        
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: prompt.contents,
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 1024
                    },
                    safetySettings: [
                        {
                            category: "HARM_CATEGORY_HARASSMENT",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        }
                    ]
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error making API request:', error);
            throw error;
        }
    }

    /**
     * Process and extract the analysis from API response
     * @param {object} response - The API response
     * @returns {object} - The processed analysis
     */
    _processResponse(response) {
        try {
            // Extract text from response
            const textContent = response?.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (!textContent) {
                throw new Error('Invalid API response format');
            }
            
            // Try to parse JSON response
            try {
                // Extract JSON from the text (in case it's wrapped in text/markdown)
                const jsonMatch = textContent.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const analysis = JSON.parse(jsonMatch[0]);
                    
                    // Validate required fields
                    if (!analysis.overallScore || !analysis.strengths || !analysis.improvements) {
                        throw new Error('Missing required fields in analysis');
                    }
                    
                    // Add to history
                    this.addToHistory('assistant', JSON.stringify(analysis));
                    
                    return analysis;
                }
            } catch (jsonError) {
                console.warn('Could not parse JSON response:', jsonError);
            }
            
            // If we can't parse JSON, create a structured response from the text
            const fallbackAnalysis = {
                overallScore: 7,
                strengths: ['Clear communication detected'],
                improvements: ['Consider structuring responses in a more organized way'],
                toneFeedback: 'Professional and engaged',
                suggestion: 'Practice with more specific examples'
            };
            
            this.addToHistory('assistant', JSON.stringify(fallbackAnalysis));
            return fallbackAnalysis;
        } catch (error) {
            console.error('Error processing API response:', error);
            throw error;
        }
    }

    /**
     * Add a message to conversation history
     * @param {string} role - 'user' or 'assistant'
     * @param {string} content - The message content
     */
    addToHistory(role, content) {
        this.contextHistory.push({ role, content });
        
        // Keep history to a reasonable size
        if (this.contextHistory.length > 10) {
            this.contextHistory = this.contextHistory.slice(-10);
        }
    }

    /**
     * Clear conversation history
     */
    clearHistory() {
        this.contextHistory = [];
    }
}

// Export the module
const geminiApi = new GeminiAPI(); 