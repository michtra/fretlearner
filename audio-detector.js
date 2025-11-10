// Audio detection module
class AudioDetector {
    constructor() {
        this.NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        this.A4_FREQUENCY = 440;
        this.A4_MIDI_NUMBER = 69;

        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.isDetecting = false;
        this.animationId = null;

        // Stability tracking
        this.recentNotes = [];
        this.MAX_RECENT_NOTES = 8;
        this.lastValidNote = null;
        this.framesWithoutDetection = 0;
        this.MAX_FRAMES_WITHOUT_DETECTION = 8;
        this.cooldownFrames = 0;
        this.COOLDOWN_DURATION = 50; // Ignore detections for 50 frames (~800ms) after clearing - matches the delay before next note

        // Callbacks
        this.onNoteDetected = null;
        this.onVolumeChange = null;
    }

    async getAudioDevices() {
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(device => device.kind === 'audioinput');
        } catch (error) {
            console.error('Error getting audio devices:', error);
            throw error;
        }
    }

    async start(deviceId) {
        if (this.isDetecting) {
            console.warn('Audio detection already running');
            return;
        }

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const constraints = {
                audio: {
                    deviceId: deviceId,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 4096; // Larger buffer for better low frequency detection

            this.microphone.connect(this.analyser);

            this.isDetecting = true;
            this.detectPitch();

            return {
                sampleRate: this.audioContext.sampleRate,
                bufferSize: this.analyser.fftSize
            };
        } catch (error) {
            console.error('Error starting audio detection:', error);
            throw error;
        }
    }

    stop() {
        this.isDetecting = false;

        if (this.microphone) {
            this.microphone.disconnect();
            if (this.microphone.mediaStream) {
                this.microphone.mediaStream.getTracks().forEach(track => track.stop());
            }
        }

        if (this.audioContext) {
            this.audioContext.close();
        }

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        // Clear state
        this.recentNotes = [];
        this.lastValidNote = null;
        this.framesWithoutDetection = 0;
    }

    clearRecentNotes() {
        // Clear the recent notes buffer to prevent lingering detection
        this.recentNotes = [];
        this.lastValidNote = null;
        this.framesWithoutDetection = 0;
        // Start cooldown period to ignore detections
        this.cooldownFrames = this.COOLDOWN_DURATION;
    }

    detectPitch() {
        if (!this.isDetecting) return;

        const bufferLength = this.analyser.fftSize;
        const buffer = new Float32Array(bufferLength);
        this.analyser.getFloatTimeDomainData(buffer);

        // Calculate volume
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += buffer[i] * buffer[i];
        }
        const rms = Math.sqrt(sum / bufferLength);
        const volume = Math.min(100, rms * 500);

        if (this.onVolumeChange) {
            this.onVolumeChange(volume);
        }

        // Handle cooldown period - ignore all detections to prevent previous note detection
        if (this.cooldownFrames > 0) {
            this.cooldownFrames--;
            if (this.onNoteDetected) {
                this.onNoteDetected(null);
            }
            this.animationId = requestAnimationFrame(() => this.detectPitch());
            return;
        }

        // Detect pitch
        const pitch = this.autoCorrelate(buffer, this.audioContext.sampleRate);

        if (pitch > 0 && pitch >= 50 && pitch <= 2000) {
            const note = this.frequencyToNote(pitch);
            if (note) {
                this.framesWithoutDetection = 0;

                // Add to recent notes for stability
                const noteName = `${note.name}${note.octave}`;
                this.recentNotes.push(noteName);
                if (this.recentNotes.length > this.MAX_RECENT_NOTES) {
                    this.recentNotes.shift();
                }

                // Get most common recent note for stability
                let displayNote = noteName;
                if (this.recentNotes.length >= 5) {
                    const counts = {};
                    let maxCount = 0;
                    let mostCommon = noteName;
                    for (const n of this.recentNotes) {
                        counts[n] = (counts[n] || 0) + 1;
                        if (counts[n] > maxCount) {
                            maxCount = counts[n];
                            mostCommon = n;
                        }
                    }
                    if (maxCount >= 3) {
                        displayNote = mostCommon;
                    }
                }

                this.lastValidNote = {
                    displayNote: displayNote,
                    frequency: pitch,
                    cents: note.cents,
                    name: note.name,
                    octave: note.octave
                };

                if (this.onNoteDetected) {
                    this.onNoteDetected(this.lastValidNote);
                }
            }
        } else {
            this.framesWithoutDetection++;

            if (this.framesWithoutDetection > this.MAX_FRAMES_WITHOUT_DETECTION) {
                this.lastValidNote = null;
                this.recentNotes = [];
                if (this.onNoteDetected) {
                    this.onNoteDetected(null);
                }
            } else if (this.lastValidNote && this.onNoteDetected) {
                // Keep showing the last valid note
                this.onNoteDetected(this.lastValidNote);
            }
        }

        this.animationId = requestAnimationFrame(() => this.detectPitch());
    }

    autoCorrelate(buffer, sampleRate) {
        const SIZE = buffer.length;
        let rms = 0;

        for (let i = 0; i < SIZE; i++) {
            rms += buffer[i] * buffer[i];
        }
        rms = Math.sqrt(rms / SIZE);

        if (rms < 0.01) return -1;

        const halfSize = Math.floor(SIZE / 2);
        const correlations = new Array(halfSize);

        for (let lag = 0; lag < halfSize; lag++) {
            let sum = 0;
            for (let i = 0; i < halfSize; i++) {
                sum += buffer[i] * buffer[i + lag];
            }
            correlations[lag] = sum;
        }

        const diffs = [];
        for (let i = 1; i < correlations.length; i++) {
            diffs.push(correlations[i] - correlations[i - 1]);
        }

        const minLag = Math.floor(sampleRate / 1000);
        let start = -1;
        for (let i = minLag; i < diffs.length; i++) {
            if (diffs[i] > 0) {
                start = i;
                break;
            }
        }

        if (start === -1) return -1;

        const maxLag = Math.min(Math.floor(sampleRate / 50), correlations.length);
        let peak = start;
        let maxCorrelation = correlations[start];
        for (let i = start + 1; i < maxLag; i++) {
            if (correlations[i] > maxCorrelation) {
                maxCorrelation = correlations[i];
                peak = i;
            }
        }

        if (peak > 0 && peak < correlations.length - 1) {
            const y1 = correlations[peak - 1];
            const y2 = correlations[peak];
            const y3 = correlations[peak + 1];

            const a = (y1 + y3 - 2 * y2) / 2;
            const b = (y3 - y1) / 2;

            let refinedPeak = peak;
            if (a !== 0) {
                const offset = -b / (2 * a);
                if (Math.abs(offset) < 0.5) {
                    refinedPeak = peak + offset;
                }
            }

            return sampleRate / refinedPeak;
        }

        return -1;
    }

    frequencyToNote(frequency) {
        if (frequency <= 0) return null;

        const halfSteps = 12 * Math.log2(frequency / this.A4_FREQUENCY);
        const midiNumber = Math.round(this.A4_MIDI_NUMBER + halfSteps);
        const noteIndex = midiNumber % 12;
        const octave = Math.floor(midiNumber / 12) - 1;

        const exactFrequency = this.A4_FREQUENCY * Math.pow(2, (midiNumber - this.A4_MIDI_NUMBER) / 12);
        const cents = Math.round(1200 * Math.log2(frequency / exactFrequency));

        return {
            name: this.NOTE_NAMES[noteIndex],
            octave: octave,
            frequency: frequency,
            cents: cents,
            midiNumber: midiNumber
        };
    }
}
