/**
 * Analytics Module
 * Handles visualization and display of speech analytics
 */

class SpeechAnalytics {
    constructor() {
        // DOM elements
        this.fillerCountEl = document.getElementById('filler-count');
        this.vocabScoreEl = document.getElementById('vocab-score');
        this.paceValueEl = document.getElementById('pace-value');
        this.toneValueEl = document.getElementById('tone-value');
        
        this.fillerChartEl = document.getElementById('filler-chart');
        this.vocabChartEl = document.getElementById('vocab-chart');
        this.paceChartEl = document.getElementById('pace-chart');
        this.toneChartEl = document.getElementById('tone-chart');
        this.correctionsListEl = document.getElementById('speech-corrections-list');
        
        // Data storage
        this.history = [];
        this.currentSession = {
            startTime: null,
            metrics: {},
            transcript: '',
            analysis: null
        };
        
        // Initialize from local storage
        this._loadHistoryFromStorage();
    }
    
    /**
     * Update analytics display with new metrics
     * @param {object} metrics - The current speech metrics
     * @param {boolean} isFinal - Whether this is the final update for the session
     */
    updateMetrics(metrics, isFinal = false) {
        // Update UI elements with metrics
        this.fillerCountEl.textContent = metrics.fillerWordCount;
        
        // Format vocabulary diversity as percentage with 1 decimal
        const vocabScore = (metrics.vocabularyDiversity * 100).toFixed(1);
        this.vocabScoreEl.textContent = vocabScore > 0 ? `${vocabScore}%` : 'N/A';
        
        // Update pace
        this.paceValueEl.textContent = `${metrics.wpm} wpm`;
        
        // Update visualizations
        this._updateFillerChart(metrics.fillerWordCount);
        this._updateVocabChart(metrics.vocabularyDiversity);
        this._updatePaceChart(metrics.wpm);
        
        // Save metrics
        this.currentSession.metrics = metrics;
        
        // If final, save to history
        if (isFinal && metrics.duration > 5) { // Only save if duration is more than 5 seconds
            this._saveSession();
        }
    }
    
    /**
     * Update with AI analysis results
     * @param {object} analysis - The analysis from Gemini API
     */
    updateAnalysis(analysis) {
        // Update emotional tone
        if (analysis.toneFeedback) {
            this.toneValueEl.textContent = analysis.toneFeedback;
            this._updateToneChart(analysis.overallScore);
        }
        
        // Update suggestions panel
        this._updateSuggestionsPanel(analysis);
        
        // Save analysis
        this.currentSession.analysis = analysis;
        
        // Save updated session
        this._saveSession();
    }
    
    /**
     * Update the suggestions panel with analysis feedback
     * @param {object} analysis - The analysis from Gemini API
     */
    _updateSuggestionsPanel(analysis) {
        if (!this.correctionsListEl) return;
        
        let suggestionsHTML = '';
        
        // Add immediate corrections if any
        if (analysis.corrections && analysis.corrections.length > 0) {
            analysis.corrections.forEach(correction => {
                suggestionsHTML += `
                    <div class="correction-item ${correction.type || 'suggestion'}">
                        <div class="original">${correction.original}</div>
                        <div class="correction">${correction.correction}</div>
                        <div class="explanation">${correction.explanation}</div>
                    </div>
                `;
            });
        }
        
        // Add general feedback and improvements
        if (analysis.feedback || analysis.improvements) {
            suggestionsHTML += '<div class="correction-item suggestion">';
            
            if (analysis.feedback) {
                suggestionsHTML += `
                    <div class="explanation">
                        <strong>General Feedback:</strong><br>
                        ${analysis.feedback}
                    </div>
                `;
            }
            
            if (analysis.improvements && analysis.improvements.length > 0) {
                suggestionsHTML += `
                    <div class="explanation">
                        <strong>Areas to Improve:</strong>
                        <ul>
                            ${analysis.improvements.map(imp => `<li>${imp}</li>`).join('')}
                        </ul>
                    </div>
                `;
            }
            
            suggestionsHTML += '</div>';
        }
        
        // If no suggestions, show encouraging message
        if (!suggestionsHTML) {
            suggestionsHTML = `
                <div class="correction-item suggestion">
                    <div class="explanation">
                        Great job! Keep practicing to further improve your speaking skills.
                    </div>
                </div>
            `;
        }
        
        this.correctionsListEl.innerHTML = suggestionsHTML;
    }
    
    /**
     * Start a new analytics session
     */
    startSession(transcript = '') {
        this.currentSession = {
            startTime: new Date(),
            metrics: {},
            transcript: transcript,
            analysis: null
        };
    }
    
    /**
     * Update the transcript for the current session
     * @param {string} transcript - The current transcript text
     */
    updateTranscript(transcript) {
        this.currentSession.transcript = transcript;
    }
    
    /**
     * Get all session history
     * @returns {array} - Array of session objects
     */
    getHistory() {
        return this.history;
    }
    
    /**
     * Clear all session history
     */
    clearHistory() {
        this.history = [];
        localStorage.removeItem('speechCoachHistory');
        
        // Update the UI
        const historyList = document.getElementById('history-list');
        historyList.innerHTML = '<p class="empty-state">No previous sessions. Start practicing to see your history.</p>';
    }
    
    /**
     * Visualize filler word count
     * @param {number} count - The filler word count
     */
    _updateFillerChart(count) {
        // Simple visualization - color bar based on count
        let color = '#28a745'; // Good (green)
        let width = '10%';
        
        if (count > 0) {
            if (count < 5) {
                color = '#28a745'; // Good (green)
                width = `${Math.max(20, count * 10)}%`;
            } else if (count < 10) {
                color = '#ffc107'; // Warning (yellow)
                width = `${Math.max(50, count * 5)}%`;
            } else {
                color = '#dc3545'; // Bad (red)
                width = `${Math.min(100, count * 5)}%`;
            }
        }
        
        this.fillerChartEl.innerHTML = `<div style="height: 100%; width: ${width}; background-color: ${color}; border-radius: 4px;"></div>`;
    }
    
    /**
     * Visualize vocabulary diversity
     * @param {number} diversity - The vocabulary diversity score (0-1)
     */
    _updateVocabChart(diversity) {
        // Visualize vocabulary diversity as a percentage
        let color = '#28a745'; // Good (green)
        let width = '10%';
        
        if (diversity > 0) {
            width = `${Math.max(10, diversity * 100)}%`;
            
            if (diversity < 0.3) {
                color = '#dc3545'; // Bad (red)
            } else if (diversity < 0.5) {
                color = '#ffc107'; // Warning (yellow)
            } else {
                color = '#28a745'; // Good (green)
            }
        }
        
        this.vocabChartEl.innerHTML = `<div style="height: 100%; width: ${width}; background-color: ${color}; border-radius: 4px;"></div>`;
    }
    
    /**
     * Visualize speaking pace
     * @param {number} wpm - Words per minute
     */
    _updatePaceChart(wpm) {
        // Visualize pace (optimal is 120-150 wpm)
        let color = '#28a745'; // Good (green)
        let width = '10%';
        
        if (wpm > 0) {
            // Normalize to percentage (0-250 wpm range)
            width = `${Math.min(100, Math.max(10, (wpm / 250) * 100))}%`;
            
            if (wpm < 100 || wpm > 180) {
                color = '#dc3545'; // Bad (red)
            } else if (wpm < 120 || wpm > 150) {
                color = '#ffc107'; // Warning (yellow)
            } else {
                color = '#28a745'; // Good (green)
            }
        }
        
        this.paceChartEl.innerHTML = `<div style="height: 100%; width: ${width}; background-color: ${color}; border-radius: 4px;"></div>`;
    }
    
    /**
     * Visualize emotional tone based on score
     * @param {number} score - Overall score (1-10)
     */
    _updateToneChart(score) {
        // Default values
        let color = '#6c757d'; // Gray
        let width = '50%';
        
        if (score) {
            width = `${Math.max(10, score * 10)}%`;
            
            if (score < 4) {
                color = '#dc3545'; // Bad (red)
            } else if (score < 7) {
                color = '#ffc107'; // Warning (yellow)
            } else {
                color = '#28a745'; // Good (green)
            }
        }
        
        this.toneChartEl.innerHTML = `<div style="height: 100%; width: ${width}; background-color: ${color}; border-radius: 4px;"></div>`;
    }
    
    /**
     * Save current session to history
     */
    _saveSession() {
        // Only save if we have a transcript
        if (!this.currentSession.transcript || this.currentSession.transcript.trim().length === 0) {
            return;
        }
        
        // Create session object with metadata
        const session = {
            id: Date.now(),
            date: new Date().toISOString(),
            duration: this.currentSession.metrics.duration || 0,
            transcript: this.currentSession.transcript,
            metrics: this.currentSession.metrics,
            analysis: this.currentSession.analysis
        };
        
        // Add to history array (at the beginning)
        this.history.unshift(session);
        
        // Keep history to a reasonable size
        if (this.history.length > 20) {
            this.history = this.history.slice(0, 20);
        }
        
        // Save to local storage
        this._saveHistoryToStorage();
        
        // Update history display
        this._updateHistoryDisplay();
    }
    
    /**
     * Save history to local storage
     */
    _saveHistoryToStorage() {
        try {
            localStorage.setItem('speechCoachHistory', JSON.stringify(this.history));
        } catch (error) {
            console.error('Error saving history to local storage:', error);
        }
    }
    
    /**
     * Load history from local storage
     */
    _loadHistoryFromStorage() {
        try {
            const savedHistory = localStorage.getItem('speechCoachHistory');
            if (savedHistory) {
                this.history = JSON.parse(savedHistory);
                this._updateHistoryDisplay();
            }
        } catch (error) {
            console.error('Error loading history from local storage:', error);
        }
    }
    
    /**
     * Update the history display in the UI
     */
    _updateHistoryDisplay() {
        const historyList = document.getElementById('history-list');
        
        if (!historyList) return;
        
        if (this.history.length === 0) {
            historyList.innerHTML = '<p class="empty-state">No previous sessions. Start practicing to see your history.</p>';
            return;
        }
        
        // Clear and rebuild history list
        historyList.innerHTML = '';
        
        this.history.forEach(session => {
            const date = new Date(session.date);
            const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
            
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.dataset.sessionId = session.id;
            
            // Format duration in minutes and seconds
            const minutes = Math.floor(session.duration / 60);
            const seconds = session.duration % 60;
            const durationText = minutes > 0 ? 
                `${minutes}m ${seconds}s` : 
                `${seconds}s`;
            
            // Create summary of session
            const score = session.analysis ? session.analysis.overallScore : 'N/A';
            
            historyItem.innerHTML = `
                <div><strong>${formattedDate}</strong> (${durationText})</div>
                <div>Score: ${score} | Words: ${session.metrics.wordCount || 0} | Pace: ${session.metrics.wpm || 0} wpm</div>
            `;
            
            // Add click event to load session details
            historyItem.addEventListener('click', () => {
                // Display session details (could show in a modal or other UI element)
                console.log('Session details:', session);
                alert(`Session transcript: ${session.transcript}`);
            });
            
            historyList.appendChild(historyItem);
        });
    }
}

// Export the module
const speechAnalytics = new SpeechAnalytics(); 