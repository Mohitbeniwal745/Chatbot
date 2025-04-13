/**
 * Speech Recognition Module
 * Handles Web Speech API integration with real-time speech-to-text and analytics
 */

class SpeechRecognitionManager {
    constructor() {
        // Check browser support
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.error('Speech recognition not supported in this browser');
            return;
        }

        this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.isRecording = false;
        this.transcriptText = '';
        this.startTime = null;
        this.wordCount = 0;
        this.fillerWords = ['um', 'uh', 'like', 'you know', 'actually', 'basically', 'literally', 'sort of', 'kind of'];
        this.fillerWordCount = 0;
        this.uniqueWords = new Set();

        // Emotional tone tracking
        this.emotionScores = { positive: 0, negative: 0, neutral: 0 };
        this.sentimentDictionary = {
            positive: ['great', 'awesome', 'happy', 'excellent', 'wonderful', 'love', 'fantastic'],
            negative: ['bad', 'terrible', 'sad', 'awful', 'hate', 'horrible', 'disappointing'],
            neutral: ['okay', 'fine', 'normal', 'usual']
        };

        this.onTranscriptUpdate = null;
        this.onAnalyticsUpdate = null;
        this.analyticsTimer = null;

        this._setupEventListeners();
    }

    _setupEventListeners() {
        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                    this._processTranscript(transcript, false);
                } else {
                    interimTranscript += transcript;
                    this._processTranscript(transcript, true);
                }
            }

            this.transcriptText = (this.transcriptText + ' ' + finalTranscript).trim();

            if (this.onTranscriptUpdate) {
                this.onTranscriptUpdate(this.transcriptText, interimTranscript);
            }

            // Trigger analytics update for real-time feedback
            this._updateAnalytics(false);
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.stop();
        };

        this.recognition.onend = () => {
            if (this.isRecording) {
                this.recognition.start(); // Restart for continuous recognition
            } else {
                clearInterval(this.analyticsTimer);
                this._updateAnalytics(true); // Final analytics update
            }
        };
    }

    _processTranscript(transcript, isInterim = false) {
        const words = transcript.trim().toLowerCase().split(/\s+/);

        if (!isInterim) {
            this.wordCount += words.length;
        }

        words.forEach(word => {
            const cleanWord = word.replace(/[^\w\s]|_/g, "");
            if (cleanWord.length > 0) {
                this.uniqueWords.add(cleanWord);

                // Analyze emotional tone
                if (this.sentimentDictionary.positive.includes(cleanWord)) {
                    this.emotionScores.positive += 1;
                } else if (this.sentimentDictionary.negative.includes(cleanWord)) {
                    this.emotionScores.negative += 1;
                } else if (this.sentimentDictionary.neutral.includes(cleanWord)) {
                    this.emotionScores.neutral += 1;
                }
            }
        });

        if (!isInterim) {
            this.fillerWords.forEach(fillerWord => {
                const regex = new RegExp('\\b' + fillerWord + '\\b', 'gi');
                const matches = transcript.match(regex);
                if (matches) {
                    this.fillerWordCount += matches.length;
                }
            });
        }
    }

    _updateAnalytics(isFinal = false) {
        if (!this.startTime) return;

        const duration = (Date.now() - this.startTime) / 1000 / 60; // Duration in minutes
        const wpm = duration > 0 ? Math.round(this.wordCount / duration) : 0;
        const vocabularyDiversity = this.wordCount > 0 ? this.uniqueWords.size / this.wordCount : 0;

        // Calculate dominant emotional tone
        const totalEmotion = this.emotionScores.positive + this.emotionScores.negative + this.emotionScores.neutral;
        const emotionalTone = totalEmotion > 0 ? {
            positive: (this.emotionScores.positive / totalEmotion).toFixed(2),
            negative: (this.emotionScores.negative / totalEmotion).toFixed(2),
            neutral: (this.emotionScores.neutral / totalEmotion).toFixed(2)
        } : { positive: 0, negative: 0, neutral: 1 };

        const analytics = {
            speakingPace: wpm, // Words per minute
            fillerWordCount: this.fillerWordCount,
            vocabularyDiversity: vocabularyDiversity.toFixed(2),
            emotionalTone: emotionalTone,
            duration: Math.round(duration * 60) // Duration in seconds
        };

        if (this.onAnalyticsUpdate) {
            this.onAnalyticsUpdate(analytics, isFinal);
        }
    }

    start() {
        if (!this.recognition) return;

        try {
            this.isRecording = true;
            this.recognition.start();
            this.startTime = Date.now();

            // Reset analytics
            this.wordCount = 0;
            this.fillerWordCount = 0;
            this.uniqueWords = new Set();
            this.emotionScores = { positive: 0, negative: 0, neutral: 0 };
            this.transcriptText = '';

            // Real-time analytics updates every 2 seconds
            this.analyticsTimer = setInterval(() => {
                this._updateAnalytics(false);
            }, 2000);

            console.log('Speech recognition started');
        } catch (error) {
            console.error('Error starting speech recognition:', error);
        }
    }

    stop() {
        if (!this.recognition) return;

        try {
            // Stop recording and clear the analytics timer
            this.isRecording = false;
            this.recognition.stop();
            clearInterval(this.analyticsTimer);

            // Finalize analytics
            if (this.startTime) {
                const duration = (Date.now() - this.startTime) / 1000 / 60; // Duration in minutes
                if (duration > 0) {
                    this._updateAnalytics(true); // Ensure final analytics are calculated
                } else {
                    console.warn('Speech duration too short to calculate analytics.');
                }
            }

            console.log('Speech recognition stopped');
        } catch (error) {
            console.error('Error stopping speech recognition:', error);
        }
    }

    setTranscriptUpdateCallback(callback) {
        this.onTranscriptUpdate = callback;
    }

    setAnalyticsUpdateCallback(callback) {
        this.onAnalyticsUpdate = callback;
    }

    getTranscript() {
        return this.transcriptText;
    }

    isListening() {
        return this.isRecording;
    }
}

// Export the module
const speechRecognition = new SpeechRecognitionManager();