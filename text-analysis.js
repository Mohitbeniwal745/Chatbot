/**
 * Text Analysis Module
 * Handles grammar and style analysis for text input
 */

class TextAnalysis {
    constructor() {
        // DOM elements
        this.textInput = document.getElementById('text-input');
        this.sendButton = document.getElementById('send-button');
        this.transcriptEl = document.getElementById('text-transcript');
        this.grammarScoreEl = document.getElementById('grammar-score');
        this.styleScoreEl = document.getElementById('style-score');
        this.correctionsListEl = document.getElementById('corrections-list');
        this.charCounter = document.querySelector('.input-counter');
        
        // Constants
        this.MAX_CHARS = 500;
        this.WARNING_THRESHOLD = 50; // Show warning when 50 chars remaining
        
        // Initialize
        this.initializeEventListeners();
        this.updateCharCounter(0);
    }
    
    initializeEventListeners() {
        // Auto-resize textarea
        this.textInput.addEventListener('input', () => {
            this.autoResizeTextarea();
            this.updateCharCounter(this.textInput.value.length);
        });
        
        // Handle Ctrl+Enter
        this.textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                this.analyzeText();
            }
        });
        
        // Send button click
        this.sendButton.addEventListener('click', () => {
            this.analyzeText();
        });
    }
    
    autoResizeTextarea() {
        // Reset height to auto to get correct scrollHeight
        this.textInput.style.height = 'auto';
        
        // Set new height based on scrollHeight
        const newHeight = Math.min(Math.max(55, this.textInput.scrollHeight), 150);
        this.textInput.style.height = newHeight + 'px';
        
        // Enable/disable send button based on content
        this.sendButton.disabled = this.textInput.value.trim().length === 0;
    }
    
    updateCharCounter(length) {
        const remaining = this.MAX_CHARS - length;
        this.charCounter.textContent = `${length}/${this.MAX_CHARS}`;
        
        // Update counter styling based on remaining chars
        this.charCounter.classList.remove('char-limit-warning', 'char-limit-exceeded');
        
        if (remaining <= 0) {
            this.charCounter.classList.add('char-limit-exceeded');
        } else if (remaining <= this.WARNING_THRESHOLD) {
            this.charCounter.classList.add('char-limit-warning');
        }
        
        // Enable/disable send button
        this.sendButton.disabled = length === 0 || length > this.MAX_CHARS;
    }
    
    async analyzeText() {
        const text = this.textInput.value.trim();
        if (!text || text.length > this.MAX_CHARS) return;
        
        // Display user text
        this.appendToTranscript(`
            <div class="user-message">
                <p>${text}</p>
            </div>
        `);
        
        // Clear input and reset height
        this.textInput.value = '';
        this.autoResizeTextarea();
        this.updateCharCounter(0);
        
        // Show analyzing message
        this.appendToTranscript(`
            <div class="bot-message system-message">
                <p>Analyzing your text...</p>
            </div>
        `);
        
        try {
            // Create analysis prompt
            const prompt = {
                contents: [{
                    parts: [{
                        text: `You are a professional writing coach. Analyze the following text for grammar, style, and clarity. Provide specific, actionable feedback.

Text to analyze: "${text}"

Focus on:
1. Grammar and punctuation accuracy
2. Sentence structure and flow
3. Word choice and vocabulary effectiveness
4. Style and tone appropriateness
5. Overall clarity and impact

Respond with a JSON object in this exact format:
{
    "grammarScore": <number between 1-10>,
    "styleScore": <number between 1-10>,
    "corrections": [
        {
            "type": "error",
            "original": "<exact text with error>",
            "correction": "<corrected version>",
            "explanation": "<brief explanation of the correction>"
        }
    ],
    "strengths": ["<specific strength 1>", "<specific strength 2>", "<specific strength 3>"],
    "improvements": ["<specific improvement 1>", "<specific improvement 2>", "<specific improvement 3>"]
}

Ensure the response is valid JSON and includes all fields. The corrections array can be empty if no errors are found.
Keep explanations concise and actionable.`
                    }]
                }]
            };
            
            // Get analysis from Gemini
            const analysis = await this.getTextAnalysis(prompt);
            
            // Remove analyzing message
            const analyzingMsg = this.transcriptEl.querySelector('.system-message');
            if (analyzingMsg) {
                analyzingMsg.remove();
            }
            
            // Update UI with analysis
            this.updateAnalysisDisplay(analysis);
            
        } catch (error) {
            console.error('Error analyzing text:', error);
            
            // Remove analyzing message
            const analyzingMsg = this.transcriptEl.querySelector('.system-message');
            if (analyzingMsg) {
                analyzingMsg.remove();
            }
            
            // Show error message with more details
            this.appendToTranscript(`
                <div class="bot-message error-message">
                    <p>Sorry, I encountered an error analyzing your text: ${error.message}</p>
                    <p>Please try again or check your API key configuration.</p>
                </div>
            `);
        }
    }
    
    async getTextAnalysis(prompt) {
        if (!geminiApi.hasApiKey()) {
            throw new Error('API key not set');
        }

        const response = await fetch(`${geminiApi.apiUrl}?key=${geminiApi.apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: prompt.contents,
                generationConfig: {
                    temperature: 0.7,
                    topK: 32,
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
        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
            throw new Error('Invalid API response format');
        }

        const result = data.candidates[0].content.parts[0].text;
        
        // Extract JSON from response
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Invalid response format');
        }
        
        try {
            return JSON.parse(jsonMatch[0]);
        } catch (error) {
            throw new Error('Failed to parse analysis results');
        }
    }
    
    updateAnalysisDisplay(analysis) {
        // Update scores
        this.grammarScoreEl.textContent = analysis.grammarScore;
        this.styleScoreEl.textContent = analysis.styleScore;
        
        // Update charts
        this.updateChart('grammar-chart', analysis.grammarScore);
        this.updateChart('style-chart', analysis.styleScore);
        
        // Display corrections
        let correctionsHTML = '';
        
        if (analysis.corrections && analysis.corrections.length > 0) {
            analysis.corrections.forEach(correction => {
                correctionsHTML += `
                    <div class="correction-item ${correction.type}">
                        <div class="original">${correction.original}</div>
                        <div class="correction">${correction.correction}</div>
                        <div class="explanation">${correction.explanation}</div>
                    </div>
                `;
            });
        } else {
            correctionsHTML = '<p>No corrections needed. Great job!</p>';
        }
        
        this.correctionsListEl.innerHTML = correctionsHTML;
        
        // Display feedback message
        let feedbackHTML = '<div class="bot-message">';
        
        if (analysis.strengths && analysis.strengths.length > 0) {
            feedbackHTML += '<p><strong>Strengths:</strong></p><ul>';
            analysis.strengths.forEach(strength => {
                feedbackHTML += `<li>${strength}</li>`;
            });
            feedbackHTML += '</ul>';
        }
        
        if (analysis.improvements && analysis.improvements.length > 0) {
            feedbackHTML += '<p><strong>Areas to Improve:</strong></p><ul>';
            analysis.improvements.forEach(improvement => {
                feedbackHTML += `<li>${improvement}</li>`;
            });
            feedbackHTML += '</ul>';
        }
        
        feedbackHTML += '</div>';
        this.appendToTranscript(feedbackHTML);
    }
    
    updateChart(chartId, score) {
        const chartEl = document.getElementById(chartId);
        if (!chartEl) return;
        
        let color = '#dc3545'; // red
        if (score >= 7) {
            color = '#28a745'; // green
        } else if (score >= 4) {
            color = '#ffc107'; // yellow
        }
        
        const width = `${score * 10}%`;
        chartEl.innerHTML = `<div style="height: 100%; width: ${width}; background-color: ${color}; border-radius: 4px;"></div>`;
    }
    
    appendToTranscript(html) {
        this.transcriptEl.insertAdjacentHTML('beforeend', html);
        this.transcriptEl.scrollTop = this.transcriptEl.scrollHeight;
    }
}

// Initialize text analysis
const textAnalysis = new TextAnalysis(); 