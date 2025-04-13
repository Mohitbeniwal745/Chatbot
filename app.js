/**
 * Main Application Module
 * Coordinates all components of the speech coach application
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const micButton = document.getElementById('mic-button');
    const sendButton = document.getElementById('send-button');
    const userInput = document.getElementById('user-input');
    const transcriptEl = document.getElementById('transcript');
    const scenarioButtons = document.querySelectorAll('.scenario-btn');
    
    // Application state
    let activeScenario = 'general';
    let isRecording = false;
    let pendingAnalysis = false;
    
    // Initialize components
    initSpeechRecognition();
    initScenarioSelection();
    initUserInput();
    checkAPIKey();
    
    /**
     * Initialize the speech recognition component
     */
    function initSpeechRecognition() {
        // Check browser support
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            showMessage('Your browser does not support speech recognition. Please try Chrome, Edge, or Safari.', 'error');
            micButton.disabled = true;
            return;
        }
        
        // Set up speech recognition callbacks
        speechRecognition.setTranscriptUpdateCallback((finalTranscript, interimTranscript) => {
            updateTranscript(finalTranscript, interimTranscript);
        });
        
        speechRecognition.setAnalyticsUpdateCallback((analytics, isFinal) => {
            speechAnalytics.updateMetrics(analytics, isFinal);
            
            // If this is the final update and we have enough speech, analyze with Gemini
            if (isFinal && analytics.duration > 10 && !pendingAnalysis) {
                analyzeWithGemini(speechRecognition.getTranscript(), analytics);
            }
        });
        
        // Set up microphone button
        micButton.addEventListener('click', toggleRecording);
    }
    
    /**
     * Initialize scenario selection buttons
     */
    function initScenarioSelection() {
        scenarioButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Remove active class from all buttons
                scenarioButtons.forEach(btn => btn.classList.remove('active'));
                
                // Add active class to clicked button
                button.classList.add('active');
                
                // Set active scenario
                activeScenario = button.dataset.scenario;
                
                // Show scenario message
                const scenarioMessages = {
                    'interview': 'You are now practicing for a job interview. Try answering common interview questions with confidence.',
                    'social': 'You are now practicing social conversation skills. Try speaking naturally and engaging with the listener.',
                    'public': 'You are now practicing public speaking. Focus on clarity, structure, and engaging your audience.'
                };
                
                showMessage(scenarioMessages[activeScenario] || 'Ready to practice speaking. Click the microphone to begin.', 'system');
                
                // Clear Gemini context when switching scenarios
                geminiApi.clearHistory();
            });
        });
    }
    
    /**
     * Initialize user text input
     */
    function initUserInput() {
        // Send button click
        sendButton.addEventListener('click', () => {
            const text = userInput.value.trim();
            if (text) {
                sendUserMessage(text);
            }
        });
        
        // Enter key press
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const text = userInput.value.trim();
                if (text) {
                    sendUserMessage(text);
                }
            }
        });
    }
    
    /**
     * Check for Gemini API key
     */
    function checkAPIKey() {
        if (!geminiApi.loadApiKey()) {
            // No API key found, show generic message
            const apiKeyPrompt = `
                <div class="system-message">
                    <p>SpeechCoach AI is ready to help you improve your speaking skills!</p>
                    <p>Choose a practice scenario above and click the microphone to begin.</p>
                </div>
            `;
            appendToTranscript(apiKeyPrompt);
        }
    }
    
    /**
     * Toggle speech recording on/off
     */
    function toggleRecording() {
        if (!isRecording) {
            // Start recording
            isRecording = true;
            micButton.classList.add('recording');
            micButton.innerHTML = '<i class="fas fa-stop"></i>';
            
            // Start speech recognition
            speechRecognition.start();
            
            // Start a new analytics session
            speechAnalytics.startSession();
            
            // Show recording message
            showMessage('Listening... Speak clearly into your microphone.', 'system');
        } else {
            // Stop recording
            isRecording = false;
            micButton.classList.remove('recording');
            micButton.innerHTML = '<i class="fas fa-microphone"></i>';
            
            // Stop speech recognition
            speechRecognition.stop();
            
            // Show analyzing message if we have speech
            if (speechRecognition.getTranscript().trim().length > 0) {
                showMessage('Processing your speech...', 'system');
            }
        }
    }
    
    /**
     * Update the transcript display
     * @param {string} finalTranscript - The final transcript text
     * @param {string} interimTranscript - The interim (in-progress) transcript text
     */
    function updateTranscript(finalTranscript, interimTranscript) {
        const transcriptEl = document.getElementById('speech-transcript');
        
        // Create or update final transcript
        let transcriptHTML = '';
        if (finalTranscript) {
            transcriptHTML += `
                <div class="user-message">
                    <p>${finalTranscript}</p>
                </div>
            `;
        }
        
        // Add interim transcript if available
        if (interimTranscript) {
            transcriptHTML += `
                <div class="user-message interim">
                    <p><i>${interimTranscript}</i></p>
                </div>
            `;
        }
        
        // Update the display
        if (transcriptHTML) {
            transcriptEl.innerHTML = transcriptHTML;
            transcriptEl.scrollTop = transcriptEl.scrollHeight;
        }
    }
    
    /**
     * Append HTML to the transcript element
     * @param {string} html - The HTML to append
     */
    function appendToTranscript(html) {
        const transcriptEl = document.getElementById('speech-transcript');
        transcriptEl.insertAdjacentHTML('beforeend', html);
        transcriptEl.scrollTop = transcriptEl.scrollHeight;
    }
    
    /**
     * Show a message in the transcript
     * @param {string} message - The message text
     * @param {string} type - Message type ('system', 'error', etc.)
     */
    function showMessage(message, type = 'system') {
        let cssClass = 'bot-message';
        
        if (type === 'error') {
            cssClass += ' error-message';
        } else if (type === 'system') {
            cssClass += ' system-message';
        }
        
        const messageHTML = `
            <div class="${cssClass}">
                <p>${message}</p>
            </div>
        `;
        
        appendToTranscript(messageHTML);
    }
    
    /**
     * Handle user text message
     * @param {string} text - The user's message text
     */
    function sendUserMessage(text) {
        // Display user message
        const userMessageHTML = `
            <div class="user-message">
                <p>${text}</p>
            </div>
        `;
        appendToTranscript(userMessageHTML);
        
        // Clear input field
        userInput.value = '';
        
        // Add to Gemini context
        geminiApi.addToHistory('user', text);
        
        // If in conversation mode, send to Gemini for response
        respondToMessage(text);
    }
    
    /**
     * Get AI response to user message
     * @param {string} message - The user's message
     */
    async function respondToMessage(message) {
        try {
            showMessage('Analyzing your speech...', 'system');
            
            // Create simple metrics for text input
            const metrics = {
                wpm: 150, // Assume average reading speed
                fillerWordCount: 0,
                vocabularyDiversity: 0.5,
                duration: Math.ceil(message.split(' ').length / 2.5) // Rough estimate of duration
            };
            
            // Analyze with Gemini
            const analysis = await geminiApi.analyzeTranscript(message, metrics, activeScenario);
            
            // Remove thinking message
            const thinkingMsg = transcriptEl.querySelector('.system-message');
            if (thinkingMsg) {
                thinkingMsg.remove();
            }
            
            // Show response based on analysis
            showResponse(analysis);
        } catch (error) {
            console.error('Error getting response:', error);
            showMessage('I apologize, but I encountered an error analyzing your speech. Please try again in a moment.', 'error');
        }
    }
    
    /**
     * Analyze speech with Gemini API
     * @param {string} transcript - The speech transcript
     * @param {object} metrics - Speech analytics metrics
     */
    async function analyzeWithGemini(transcript, metrics) {
        if (!transcript || transcript.trim().length === 0) {
            return;
        }
        
        try {
            pendingAnalysis = true;
            
            // Add to Gemini context
            geminiApi.addToHistory('user', transcript);
            
            // Get analysis from Gemini
            const analysis = await geminiApi.analyzeTranscript(transcript, metrics, activeScenario);
            
            // Update analytics with analysis
            speechAnalytics.updateAnalysis(analysis);
            
            // Show feedback response
            showResponse(analysis);
            
            pendingAnalysis = false;
        } catch (error) {
            console.error('Error analyzing with Gemini:', error);
            showMessage('Sorry, there was an error analyzing your speech. Please try again.', 'error');
            pendingAnalysis = false;
        }
    }
    
    /**
     * Show AI response based on analysis
     * @param {object} analysis - The speech analysis object
     */
    function showResponse(analysis) {
        let responseHTML = '<div class="bot-message">';
        
        if (analysis.overallScore) {
            // Add score
            const scoreColor = analysis.overallScore >= 7 ? 'green' : 
                               analysis.overallScore >= 4 ? 'orange' : 'red';
            
            responseHTML += `<p><strong style="color: ${scoreColor}">Score: ${analysis.overallScore}/10</strong></p>`;
        }
        
        if (analysis.strengths && analysis.strengths.length > 0) {
            responseHTML += '<p><strong>Strengths:</strong></p><ul>';
            analysis.strengths.forEach(strength => {
                responseHTML += `<li>${strength}</li>`;
            });
            responseHTML += '</ul>';
        }
        
        if (analysis.improvements && analysis.improvements.length > 0) {
            responseHTML += '<p><strong>Areas to Improve:</strong></p><ul>';
            analysis.improvements.forEach(improvement => {
                responseHTML += `<li>${improvement}</li>`;
            });
            responseHTML += '</ul>';
        }
        
        if (analysis.toneFeedback) {
            responseHTML += `<p><strong>Tone:</strong> ${analysis.toneFeedback}</p>`;
        }
        
        if (analysis.suggestion) {
            responseHTML += `<p><strong>Suggestion:</strong> ${analysis.suggestion}</p>`;
        }
        
        responseHTML += '</div>';
        
        appendToTranscript(responseHTML);
    }
}); 