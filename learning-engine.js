// Learning engine for managing progression and flashcards
class LearningEngine {
    constructor() {
        // Learning configuration
        this.modes = {
            naturals: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
            sharps: ['C#', 'D#', 'F#', 'G#', 'A#'],
            flats: ['Db', 'Eb', 'Gb', 'Ab', 'Bb'],
            anywhere: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        };

        // Enharmonic equivalents for matching
        this.enharmonics = {
            'C#': 'Db', 'Db': 'C#',
            'D#': 'Eb', 'Eb': 'D#',
            'F#': 'Gb', 'Gb': 'F#',
            'G#': 'Ab', 'Ab': 'G#',
            'A#': 'Bb', 'Bb': 'A#'
        };

        // String configuration (0-5, where 0 is high E)
        // Listed from low to high for learning progression
        this.strings = [
            { index: 5, name: 'Low E (6th)' },
            { index: 4, name: 'A (5th)' },
            { index: 3, name: 'D (4th)' },
            { index: 2, name: 'G (3rd)' },
            { index: 1, name: 'B (2nd)' },
            { index: 0, name: 'High E (1st)' }
        ];

        this.reset();
    }

    reset() {
        // Current state
        this.currentMode = 'naturals';
        this.currentStringIndex = 0;
        this.currentNoteIndex = 0;
        this.currentRound = 0; // Changed from currentRepeat - tracks which round (0-indexed)
        this.currentNoteRepetition = 0; // Track how many times we've played the current note
        this.isRandomRound = false;
        this.randomNotes = [];
        this.randomNoteIndex = 0;
        this.randomRepeat = 0;

        // Settings (configurable)
        this.noteRepetitions = 1; // Number of times to repeat each individual note
        this.repeatCount = 2; // Number of rounds through all notes
        this.randomRounds = 1;

        // Progress tracking
        this.totalAttempts = 0;
        this.correctAttempts = 0;
        this.notesCompleted = 0;

        // Callbacks
        this.onNoteChange = null;
        this.onProgressUpdate = null;
        this.onModeComplete = null;
        this.onStringComplete = null;

        this.loadState();
    }

    // Get current target note
    getCurrentTarget() {
        if (this.isRandomRound) {
            if (this.randomNotes.length === 0) {
                this.generateRandomRound();
            }
            const note = this.randomNotes[this.randomNoteIndex];
            const string = this.strings[this.currentStringIndex];
            return {
                note: note,
                string: string.index,
                stringName: string.name,
                mode: this.currentMode,
                round: `Random ${this.randomRepeat + 1}/${this.randomRounds}`,
                noteRepetition: this.noteRepetitions > 1 ? `${this.currentNoteRepetition + 1}/${this.noteRepetitions}` : null,
                progress: this.getProgress()
            };
        } else {
            const notes = this.modes[this.currentMode];
            const note = notes[this.currentNoteIndex];
            const string = this.strings[this.currentStringIndex];
            return {
                note: note,
                string: string.index,
                stringName: string.name,
                mode: this.currentMode,
                round: `Round ${this.currentRound + 1}/${this.repeatCount}`,
                noteRepetition: this.noteRepetitions > 1 ? `${this.currentNoteRepetition + 1}/${this.noteRepetitions}` : null,
                progress: this.getProgress()
            };
        }
    }

    // Check if played note matches target
    checkNote(playedNote) {
        const target = this.getCurrentTarget();

        // Normalize notes (handle enharmonics)
        const normalizedPlayed = this.normalizeNote(playedNote);
        const normalizedTarget = this.normalizeNote(target.note);

        console.log('checkNote:', {
            playedNote,
            normalizedPlayed,
            targetNote: target.note,
            normalizedTarget,
            match: normalizedPlayed === normalizedTarget,
            enharmonicMatch: this.enharmonics[normalizedPlayed] === normalizedTarget
        });

        this.totalAttempts++;

        const isCorrect = normalizedPlayed === normalizedTarget ||
                         this.enharmonics[normalizedPlayed] === normalizedTarget;

        if (isCorrect) {
            this.correctAttempts++;
            this.advance();
        }

        if (this.onProgressUpdate) {
            this.onProgressUpdate();
        }

        return isCorrect;
    }

    normalizeNote(note) {
        // Remove octave information if present
        return note.replace(/[0-9]/g, '');
    }

    advance() {
        if (this.isRandomRound) {
            // Increment note repetition counter
            this.currentNoteRepetition++;

            if (this.currentNoteRepetition >= this.noteRepetitions) {
                // Finished repeating this note, move to next
                this.currentNoteRepetition = 0;
                this.randomNoteIndex++;

                if (this.randomNoteIndex >= this.randomNotes.length) {
                    // Finished one random round
                    this.randomNoteIndex = 0;
                    this.randomRepeat++;

                    if (this.randomRepeat >= this.randomRounds) {
                        // Finished all random rounds for this string
                        this.moveToNextString();
                    } else {
                        // Generate new random sequence
                        this.generateRandomRound();
                    }
                }
            }
        } else {
            // Increment note repetition counter
            this.currentNoteRepetition++;

            if (this.currentNoteRepetition >= this.noteRepetitions) {
                // Finished repeating this note, move to next
                this.currentNoteRepetition = 0;
                this.currentNoteIndex++;
                const notes = this.modes[this.currentMode];

                if (this.currentNoteIndex >= notes.length) {
                    // Finished all notes in this round
                    this.currentNoteIndex = 0;
                    this.currentRound++;
                    this.notesCompleted++;

                    if (this.currentRound >= this.repeatCount) {
                        // Finished all rounds, start random rounds
                        this.startRandomRound();
                    }
                }
            }
        }

        if (this.onNoteChange) {
            this.onNoteChange(this.getCurrentTarget());
        }

        this.saveState();
    }

    startRandomRound() {
        this.isRandomRound = true;
        this.randomRepeat = 0;
        this.randomNoteIndex = 0;
        this.currentNoteRepetition = 0;
        this.generateRandomRound();
    }

    generateRandomRound() {
        const notes = this.modes[this.currentMode];
        this.randomNotes = [...notes].sort(() => Math.random() - 0.5);
    }

    moveToNextString() {
        this.currentStringIndex++;
        this.currentNoteIndex = 0;
        this.currentNoteRepetition = 0;
        this.currentRound = 0;
        this.isRandomRound = false;
        this.randomNotes = [];

        if (this.currentStringIndex >= this.strings.length) {
            // Completed all strings for this mode
            if (this.onStringComplete) {
                this.onStringComplete(this.currentMode);
            }
            this.moveToNextMode();
        } else {
            if (this.onStringComplete) {
                this.onStringComplete();
            }
        }
    }

    moveToNextMode() {
        const modeOrder = ['naturals', 'sharps', 'flats', 'anywhere'];
        const currentIndex = modeOrder.indexOf(this.currentMode);

        if (currentIndex < modeOrder.length - 1) {
            this.currentMode = modeOrder[currentIndex + 1];
            this.currentStringIndex = 0;
            this.currentNoteIndex = 0;
            this.currentRound = 0;
            this.isRandomRound = false;

            if (this.onModeComplete) {
                this.onModeComplete(this.currentMode);
            }
        } else {
            // Completed everything!
            if (this.onModeComplete) {
                this.onModeComplete('complete');
            }
        }

        this.saveState();
    }

    setMode(mode) {
        if (this.modes[mode]) {
            this.currentMode = mode;
            this.currentStringIndex = 0;
            this.currentNoteIndex = 0;
            this.currentNoteRepetition = 0;
            this.currentRound = 0;
            this.isRandomRound = false;
            this.randomNotes = [];
            this.saveState();
        }
    }

    setNoteRepetitions(count) {
        this.noteRepetitions = Math.max(1, count);
        this.saveState();
    }

    setRepeatCount(count) {
        this.repeatCount = Math.max(1, count);
        this.saveState();
    }

    setRandomRounds(count) {
        this.randomRounds = Math.max(1, count);
        this.saveState();
    }

    getProgress() {
        const notes = this.modes[this.currentMode];
        const totalNotesPerString = (notes.length * this.noteRepetitions * this.repeatCount) +
                                   (notes.length * this.noteRepetitions * this.randomRounds);
        const totalNotes = totalNotesPerString * this.strings.length;

        let completedNotes = this.currentStringIndex * totalNotesPerString;

        if (this.isRandomRound) {
            completedNotes += notes.length * this.noteRepetitions * this.repeatCount;
            completedNotes += this.randomRepeat * notes.length * this.noteRepetitions +
                             this.randomNoteIndex * this.noteRepetitions +
                             this.currentNoteRepetition;
        } else {
            // Calculate: (rounds completed * all notes * reps) + (current note index * reps) + current rep
            completedNotes += this.currentRound * notes.length * this.noteRepetitions +
                             this.currentNoteIndex * this.noteRepetitions +
                             this.currentNoteRepetition;
        }

        return {
            current: completedNotes,
            total: totalNotes,
            percentage: Math.round((completedNotes / totalNotes) * 100)
        };
    }

    getAccuracy() {
        if (this.totalAttempts === 0) return 100;
        return Math.round((this.correctAttempts / this.totalAttempts) * 100);
    }

    // State persistence
    saveState() {
        const state = {
            currentMode: this.currentMode,
            currentStringIndex: this.currentStringIndex,
            currentNoteIndex: this.currentNoteIndex,
            currentNoteRepetition: this.currentNoteRepetition,
            currentRound: this.currentRound,
            isRandomRound: this.isRandomRound,
            randomNotes: this.randomNotes,
            randomNoteIndex: this.randomNoteIndex,
            randomRepeat: this.randomRepeat,
            noteRepetitions: this.noteRepetitions,
            repeatCount: this.repeatCount,
            randomRounds: this.randomRounds,
            totalAttempts: this.totalAttempts,
            correctAttempts: this.correctAttempts,
            notesCompleted: this.notesCompleted
        };
        localStorage.setItem('fretlearner_state', JSON.stringify(state));
        console.log('State saved:', state);
    }

    loadState() {
        const saved = localStorage.getItem('fretlearner_state');
        if (saved) {
            try {
                const state = JSON.parse(saved);
                Object.assign(this, state);
                console.log('State loaded:', state);
            } catch (e) {
                console.error('Error loading state:', e);
                // Clear corrupted state
                localStorage.removeItem('fretlearner_state');
            }
        } else {
            console.log('No saved state found, starting fresh');
        }
    }

    resetLevel() {
        this.currentNoteIndex = 0;
        this.currentNoteRepetition = 0;
        this.currentRound = 0;
        this.isRandomRound = false;
        this.randomNotes = [];
        this.randomNoteIndex = 0;
        this.randomRepeat = 0;
        this.saveState();
    }

    resetAll() {
        // Clear all localStorage data
        localStorage.clear();

        this.currentMode = 'naturals';
        this.currentStringIndex = 0;
        this.currentNoteIndex = 0;
        this.currentNoteRepetition = 0;
        this.currentRound = 0;
        this.isRandomRound = false;
        this.randomNotes = [];
        this.randomNoteIndex = 0;
        this.randomRepeat = 0;
        this.totalAttempts = 0;
        this.correctAttempts = 0;
        this.notesCompleted = 0;
        this.saveState();
    }
}
