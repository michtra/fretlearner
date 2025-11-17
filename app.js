class Fretlearner {
    constructor() {
        // Initialize components
        this.audioDetector = new AudioDetector();
        this.fretboard = new Fretboard('fretboard');
        this.learningEngine = new LearningEngine();

        // State
        this.isAudioActive = false;
        this.isLearningActive = false;
        this.lastDetectedNote = null;
        this.feedbackTimeout = null;
        this.isTestingMode = false;
        this.lastKeyWasSharp = false;
        this.lastKeyWasFlat = false;
        this.isWaitingForSilence = false; // Wait for note to release before next note
        this.waitingForSilenceTimeout = null;
        this.releasePromptTimeout = null;

        // UI elements
        this.elements = {
            // Audio controls
            audioInput: document.getElementById('audioInput'),
            startAudioBtn: document.getElementById('startAudioBtn'),
            stopAudioBtn: document.getElementById('stopAudioBtn'),

            // Learning controls
            startLearningBtn: document.getElementById('startLearningBtn'),
            pauseLearningBtn: document.getElementById('pauseLearningBtn'),

            // Settings
            noteRepetitions: document.getElementById('noteRepetitions'),
            repeatCount: document.getElementById('repeatCount'),
            randomRounds: document.getElementById('randomRounds'),
            modeSelect: document.getElementById('modeSelect'),

            // Display
            currentMode: document.getElementById('currentMode'),
            currentString: document.getElementById('currentString'),
            progressInfo: document.getElementById('progressInfo'),
            targetNote: document.getElementById('targetNote'),
            targetString: document.getElementById('targetString'),
            feedbackMessage: document.getElementById('feedbackMessage'),
            detectedNote: document.getElementById('detectedNote'),
            frequencyDisplay: document.getElementById('frequencyDisplay'),
            volumeBar: document.getElementById('volumeBar'),

            // Progress
            currentRound: document.getElementById('currentRound'),
            notesLearned: document.getElementById('notesLearned'),
            accuracy: document.getElementById('accuracy'),
            progressBar: document.getElementById('progressBar'),

            // Reset
            resetLevelBtn: document.getElementById('resetLevelBtn'),
            resetAllBtn: document.getElementById('resetAllBtn'),

            // Overlay
            welcomeOverlay: document.getElementById('welcomeOverlay'),
            closeWelcomeBtn: document.getElementById('closeWelcomeBtn'),

            // Testing mode
            testingModeToggle: document.getElementById('testingModeToggle'),
            testingControls: document.getElementById('testingControls'),

            // Focus mode
            focusModeToggle: document.getElementById('focusModeToggle'),
            fretboardContainer: document.querySelector('.fretboard-container'),
            flashcardContainer: document.querySelector('.flashcard-container')
        };

        this.setupEventListeners();
        this.setupCallbacks();
        this.loadAudioDevices();
        this.updateUI();
    }

    setupEventListeners() {
        // Audio controls
        this.elements.startAudioBtn.addEventListener('click', () => this.startAudio());
        this.elements.stopAudioBtn.addEventListener('click', () => this.stopAudio());

        // Learning controls
        this.elements.startLearningBtn.addEventListener('click', () => this.startLearning());
        this.elements.pauseLearningBtn.addEventListener('click', () => this.pauseLearning());

        // Settings
        this.elements.noteRepetitions.addEventListener('change', (e) => {
            this.learningEngine.setNoteRepetitions(parseInt(e.target.value));
            this.updateUI();
        });

        this.elements.repeatCount.addEventListener('change', (e) => {
            this.learningEngine.setRepeatCount(parseInt(e.target.value));
            this.updateUI();
        });

        this.elements.randomRounds.addEventListener('change', (e) => {
            this.learningEngine.setRandomRounds(parseInt(e.target.value));
            this.updateUI();
        });

        this.elements.modeSelect.addEventListener('change', (e) => {
            this.learningEngine.setMode(e.target.value);
            this.updateUI();
            this.showCurrentNote();
        });

        // Reset controls
        this.elements.resetLevelBtn.addEventListener('click', () => this.resetLevel());
        this.elements.resetAllBtn.addEventListener('click', () => this.resetAll());

        // Welcome overlay
        this.elements.closeWelcomeBtn.addEventListener('click', () => {
            this.elements.welcomeOverlay.classList.add('hidden');
        });

        // Testing mode
        this.elements.testingModeToggle.addEventListener('change', (e) => {
            this.toggleTestingMode(e.target.checked);
        });

        // Focus mode
        this.elements.focusModeToggle.addEventListener('change', (e) => {
            this.toggleFocusMode(e.target.checked);
        });

        // Note buttons - delegate to parent since buttons exist
        const testingControls = this.elements.testingControls;
        testingControls.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-note')) {
                const note = e.target.getAttribute('data-note');
                this.simulateNoteDetection(note);
            }
        });

        // Debug mode shortcut (Ctrl+Shift+D)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                this.toggleDebugMode();
            }
        });

        // Keyboard shortcuts for testing
        document.addEventListener('keydown', (e) => {
            if (!this.isTestingMode || !this.isLearningActive) return;

            const key = e.key.toUpperCase();
            const noteMap = {
                'C': 'C',
                'D': 'D',
                'E': 'E',
                'F': 'F',
                'G': 'G',
                'A': 'A',
                'B': 'B'
            };

            if (noteMap[key]) {
                // Check for sharp or flat modifiers
                if (e.shiftKey || this.lastKeyWasSharp) {
                    this.simulateNoteDetection(noteMap[key] + '#');
                    this.lastKeyWasSharp = false;
                } else if (this.lastKeyWasFlat) {
                    this.simulateNoteDetection(noteMap[key] + 'b');
                    this.lastKeyWasFlat = false;
                } else {
                    this.simulateNoteDetection(noteMap[key]);
                }
            } else if (key === 'S') {
                // Next note will be sharp
                this.lastKeyWasSharp = true;
                setTimeout(() => this.lastKeyWasSharp = false, 1000);
            } else if (key === 'L' || key === 'F') {
                // Next note will be flat (L for fLat or F for flat)
                this.lastKeyWasFlat = true;
                setTimeout(() => this.lastKeyWasFlat = false, 1000);
            }
        });
    }

    setupCallbacks() {
        // Audio detector callbacks
        this.audioDetector.onNoteDetected = (noteInfo) => {
            if (noteInfo) {
                this.elements.detectedNote.textContent = `${noteInfo.name}${noteInfo.octave}`;
                this.elements.frequencyDisplay.textContent = `${noteInfo.frequency.toFixed(2)} Hz`;

                // Check if this matches our target (only when learning is active and not waiting for silence)
                if (this.isLearningActive && !this.isWaitingForSilence && noteInfo.name !== this.lastDetectedNote) {
                    this.lastDetectedNote = noteInfo.name;
                    this.checkPlayedNote(noteInfo.name);
                }
            } else {
                this.elements.detectedNote.textContent = '-';
                this.elements.frequencyDisplay.textContent = '-';
                this.lastDetectedNote = null;
            }
        };

        this.audioDetector.onVolumeChange = (volume) => {
            this.elements.volumeBar.style.width = volume + '%';
        };

        this.audioDetector.onSilenceDetected = () => {
            // Only advance if we're waiting for silence AND no note is currently detected
            if (this.isWaitingForSilence && this.lastDetectedNote === null) {
                this.isWaitingForSilence = false;

                // Clear any timeouts
                if (this.waitingForSilenceTimeout) {
                    clearTimeout(this.waitingForSilenceTimeout);
                    this.waitingForSilenceTimeout = null;
                }
                if (this.releasePromptTimeout) {
                    clearTimeout(this.releasePromptTimeout);
                    this.releasePromptTimeout = null;
                }

                // Show next note
                this.showCurrentNote();
            }
        };

        // Learning engine callbacks
        this.learningEngine.onNoteChange = (target) => {
            this.showCurrentNote();
            this.updateUI();
        };

        this.learningEngine.onProgressUpdate = () => {
            this.updateUI();
        };

        this.learningEngine.onStringComplete = (mode) => {
            if (mode) {
                this.showFeedback(`Mode Complete: ${mode}!`, 'correct', 3000);
            } else {
                this.showFeedback('String Complete!', 'correct', 2000);
            }
        };

        this.learningEngine.onModeComplete = (mode) => {
            if (mode === 'complete') {
                this.showFeedback('Congratulations! All modes completed!', 'correct', 5000);
                this.pauseLearning();
            } else {
                this.showFeedback(`Starting: ${mode}`, 'correct', 2000);
            }
        };
    }

    async loadAudioDevices() {
        try {
            const devices = await this.audioDetector.getAudioDevices();
            this.elements.audioInput.innerHTML = '<option value="">Select Audio Input...</option>';

            devices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Microphone ${this.elements.audioInput.options.length}`;
                this.elements.audioInput.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading audio devices:', error);
            alert('Error: Could not access audio devices. Please check permissions.');
        }
    }

    async startAudio() {
        const deviceId = this.elements.audioInput.value;
        if (!deviceId) {
            alert('Please select an audio input device');
            return;
        }

        try {
            await this.audioDetector.start(deviceId);
            this.isAudioActive = true;

            this.elements.startAudioBtn.style.display = 'none';
            this.elements.stopAudioBtn.style.display = 'block';
            this.elements.audioInput.disabled = true;
            this.elements.startLearningBtn.disabled = false;
        } catch (error) {
            console.error('Error starting audio:', error);
            alert('Error: Could not start audio detection');
        }
    }

    stopAudio() {
        this.audioDetector.stop();
        this.isAudioActive = false;

        this.elements.startAudioBtn.style.display = 'block';
        this.elements.stopAudioBtn.style.display = 'none';
        this.elements.audioInput.disabled = false;
        this.elements.startLearningBtn.disabled = true;

        if (this.isLearningActive) {
            this.pauseLearning();
        }

        this.elements.detectedNote.textContent = '-';
        this.elements.frequencyDisplay.textContent = '-';
        this.elements.volumeBar.style.width = '0%';
    }

    startLearning() {
        // Allow learning if audio is active OR testing mode is enabled
        if (!this.isAudioActive && !this.isTestingMode) {
            alert('Please start audio detection first or enable Testing Mode');
            return;
        }

        this.isLearningActive = true;
        this.elements.startLearningBtn.style.display = 'none';
        this.elements.pauseLearningBtn.style.display = 'block';

        this.showCurrentNote();
        this.updateUI();
    }

    pauseLearning() {
        this.isLearningActive = false;
        this.elements.startLearningBtn.style.display = 'block';
        this.elements.pauseLearningBtn.style.display = 'none';
        this.fretboard.clearHighlight();
    }

    showCurrentNote() {
        if (!this.isLearningActive) return;

        const target = this.learningEngine.getCurrentTarget();
        this.elements.targetNote.textContent = target.note;

        // Reset colors back to default
        this.elements.targetNote.style.color = '';
        this.elements.targetString.style.color = '';

        // Show string and note repetition info
        let stringInfo = `on ${target.stringName}`;
        if (target.noteRepetition) {
            stringInfo += ` (Rep ${target.noteRepetition})`;
        }
        this.elements.targetString.textContent = stringInfo;

        // Reset detection state
        this.lastDetectedNote = null;
        this.isWaitingForSilence = false;

        // Highlight on fretboard
        const fret = this.fretboard.getLowestFretForNote(target.note, target.string);
        if (fret !== null) {
            this.fretboard.highlight(target.note, target.string, fret);
        }

        // Clear feedback
        this.elements.feedbackMessage.textContent = '';
        this.elements.feedbackMessage.className = 'feedback-message';
    }

    checkPlayedNote(playedNote) {
        const isCorrect = this.learningEngine.checkNote(playedNote);

        if (isCorrect) {
            // Enter waiting for silence mode
            this.isWaitingForSilence = true;

            // Show success message
            this.elements.targetNote.textContent = '✓';
            this.elements.targetNote.style.color = 'var(--color-success)';
            this.elements.targetString.textContent = 'Good job!';
            this.elements.targetString.style.color = 'var(--color-success)';
            this.elements.feedbackMessage.textContent = '';
            this.elements.feedbackMessage.className = 'feedback-message';

            // Clear fretboard highlight
            this.fretboard.clearHighlight();

            // After 2 seconds, show "Release the note..." if still waiting
            this.releasePromptTimeout = setTimeout(() => {
                if (this.isWaitingForSilence) {
                    this.elements.targetString.textContent = 'Release the note...';
                }
            }, 2000);

            // In testing mode, auto-advance after delay
            if (this.isTestingMode) {
                this.waitingForSilenceTimeout = setTimeout(() => {
                    this.isWaitingForSilence = false;
                    if (this.releasePromptTimeout) {
                        clearTimeout(this.releasePromptTimeout);
                        this.releasePromptTimeout = null;
                    }
                    this.showCurrentNote();
                }, 1500);
            } else {
                // For real audio mode: Set a safety timeout (max 5 seconds wait)
                this.waitingForSilenceTimeout = setTimeout(() => {
                    if (this.isWaitingForSilence) {
                        this.isWaitingForSilence = false;
                        if (this.releasePromptTimeout) {
                            clearTimeout(this.releasePromptTimeout);
                            this.releasePromptTimeout = null;
                        }
                        this.showCurrentNote();
                    }
                }, 5000);
            }
        } else {
            this.showFeedback(`Try again (you played ${playedNote})`, 'incorrect');
        }
    }

    showFeedback(message, type, duration = 1500) {
        this.elements.feedbackMessage.textContent = message;
        this.elements.feedbackMessage.className = `feedback-message ${type}`;

        if (this.feedbackTimeout) {
            clearTimeout(this.feedbackTimeout);
        }

        this.feedbackTimeout = setTimeout(() => {
            if (type !== 'correct' || !this.isLearningActive) {
                this.elements.feedbackMessage.textContent = '';
                this.elements.feedbackMessage.className = 'feedback-message';
            }
        }, duration);
    }

    updateUI() {
        const target = this.learningEngine.getCurrentTarget();
        const progress = this.learningEngine.getProgress();
        const accuracy = this.learningEngine.getAccuracy();

        // Update context
        this.elements.currentMode.textContent = this.capitalizeFirst(target.mode);
        this.elements.currentString.textContent = target.stringName;
        this.elements.progressInfo.textContent = `${progress.current}/${progress.total} (${progress.percentage}%)`;

        // Update progress stats
        this.elements.currentRound.textContent = target.round;
        this.elements.notesLearned.textContent = this.learningEngine.notesCompleted;
        this.elements.accuracy.textContent = `${accuracy}%`;
        this.elements.progressBar.style.width = `${progress.percentage}%`;

        // Update settings values
        this.elements.noteRepetitions.value = this.learningEngine.noteRepetitions;
        this.elements.repeatCount.value = this.learningEngine.repeatCount;
        this.elements.randomRounds.value = this.learningEngine.randomRounds;
        this.elements.modeSelect.value = this.learningEngine.currentMode;
    }

    resetLevel() {
        if (confirm('Reset current level? This will restart the current string.')) {
            this.learningEngine.resetLevel();
            this.updateUI();
            if (this.isLearningActive) {
                this.showCurrentNote();
            }
        }
    }

    resetAll() {
        if (confirm('Reset ALL progress? This will erase all your progress and start from the beginning.')) {
            this.learningEngine.resetAll();
            this.updateUI();
            if (this.isLearningActive) {
                this.showCurrentNote();
            }
        }
    }

    toggleTestingMode(enabled) {
        this.isTestingMode = enabled;

        if (enabled) {
            // Show testing controls
            this.elements.testingControls.style.display = 'block';
            // Enable learning without audio
            this.elements.startLearningBtn.disabled = false;
            // Hide audio indicator (we're not using real audio)
            this.elements.detectedNote.textContent = 'Testing Mode';
            this.elements.frequencyDisplay.textContent = 'Click buttons or use keyboard';
        } else {
            // Hide testing controls
            this.elements.testingControls.style.display = 'none';
            // Require audio to be active for learning
            this.elements.startLearningBtn.disabled = !this.isAudioActive;
            if (!this.isAudioActive) {
                this.elements.detectedNote.textContent = '-';
                this.elements.frequencyDisplay.textContent = '-';
            }
        }
    }

    toggleFocusMode(enabled) {
        if (enabled) {
            // Hide fretboard and enlarge flashcard
            this.elements.fretboardContainer.classList.add('hidden');
            this.elements.flashcardContainer.classList.add('focus-mode');
        } else {
            // Show fretboard and restore flashcard size
            this.elements.fretboardContainer.classList.remove('hidden');
            this.elements.flashcardContainer.classList.remove('focus-mode');
        }
    }

    simulateNoteDetection(note) {
        if (!this.isLearningActive || this.isWaitingForSilence) {
            return;
        }

        // Update the detected note display
        this.elements.detectedNote.textContent = note;
        this.elements.volumeBar.style.width = '80%';

        // Flash the volume bar
        setTimeout(() => {
            this.elements.volumeBar.style.width = '0%';
        }, 200);

        // For testing mode, always check the note (no duplicate prevention)
        // In audio mode, duplicate prevention happens in audioDetector callback
        this.checkPlayedNote(note);

        // Reset after a short delay so same note can be clicked again
        setTimeout(() => {
            this.lastDetectedNote = null;
        }, 500);
    }

    toggleDebugMode() {
        if (!this.audioDetector.debugMode) {
            this.audioDetector.enableConsoleDebug();
            console.log('%cDEBUG MODE ENABLED (Ctrl+Shift+D to toggle)', 'color: #00ff00; font-weight: bold;');
        } else {
            this.audioDetector.setDebugMode(false);
            this.audioDetector.onDebugData = null;
            console.log('%cDEBUG MODE DISABLED', 'color: #ff0000; font-weight: bold;');
        }
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new Fretlearner();

    // Make debug functions available in console
    window.debugAudio = () => window.app.toggleDebugMode();
    console.log('Tip: Press Ctrl+Shift+D or type debugAudio() to toggle debug mode');
});
