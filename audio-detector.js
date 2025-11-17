/**
 * Musical note detector using YIN pitch detection, spectral flux onset detection,
 * ADSR envelope tracking, and harmonic validation.
 *
 * Usage:
 *   detector.enableConsoleDebug();  // Enable debug output
 *   detector.onNoteDetected = (note) => { ... };
 *   await detector.start(deviceId);
 */
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

        // YIN algorithm parameters
        this.YIN_THRESHOLD = 0.15; // Aperiodicity threshold (lower = stricter)
        this.MIN_FREQUENCY = 50;   // E1 (~82Hz), allow lower for detection
        this.MAX_FREQUENCY = 2000; // B6 (~1976Hz)

        // Onset detection (Spectral Flux)
        this.previousSpectrum = null;
        this.spectralFlux = 0;
        this.ONSET_THRESHOLD = 0.3;  // Threshold for attack detection
        this.fluxHistory = [];
        this.FLUX_HISTORY_SIZE = 5;

        // ADSR Envelope tracking
        this.noteState = 'SILENCE'; // States: SILENCE, ATTACK, SUSTAIN, RELEASE
        this.envelope = 0;
        this.envelopeSmoothing = 0.3; // Exponential smoothing factor
        this.peakEnvelope = 0;
        this.ATTACK_THRESHOLD = 0.02;  // Energy threshold to trigger attack
        this.RELEASE_THRESHOLD = 0.01; // Energy threshold for release
        this.SUSTAIN_RATIO = 0.7;      // Sustain is 70% of peak

        // Note segmentation state
        this.currentNote = null;
        this.noteStartTime = 0;
        this.noteConfidence = 0;
        this.MIN_NOTE_DURATION = 100; // Minimum note duration in ms
        this.framesSinceAttack = 0;
        this.framesSinceRelease = 0;

        // Hysteresis for state transitions (prevents rapid switching)
        this.ATTACK_HYSTERESIS_FRAMES = 3;
        this.RELEASE_HYSTERESIS_FRAMES = 5;

        // Harmonic confidence
        this.harmonicConfidence = 0;
        this.MIN_HARMONIC_CONFIDENCE = 0.5;

        // Cooldown
        this.cooldownFrames = 0;
        this.COOLDOWN_DURATION = 50;

        // Debug mode
        this.debugMode = true;
        this.debugData = {};

        // Callbacks
        this.onNoteDetected = null;
        this.onVolumeChange = null;
        this.onDebugData = null; // New callback for debug information
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
        this.resetState();
    }

    resetState() {
        this.noteState = 'SILENCE';
        this.currentNote = null;
        this.envelope = 0;
        this.peakEnvelope = 0;
        this.spectralFlux = 0;
        this.previousSpectrum = null;
        this.fluxHistory = [];
        this.framesSinceAttack = 0;
        this.framesSinceRelease = 0;
        this.harmonicConfidence = 0;
    }

    clearRecentNotes() {
        // Start cooldown period to ignore detections
        this.cooldownFrames = this.COOLDOWN_DURATION;
        this.resetState();
    }

    detectPitch() {
        if (!this.isDetecting) return;

        const bufferLength = this.analyser.fftSize;
        const timeBuffer = new Float32Array(bufferLength);
        const freqBuffer = new Uint8Array(this.analyser.frequencyBinCount);

        this.analyser.getFloatTimeDomainData(timeBuffer);
        this.analyser.getByteFrequencyData(freqBuffer);

        // === STEP 1: Calculate Amplitude Envelope (RMS with exponential smoothing) ===
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += timeBuffer[i] * timeBuffer[i];
        }
        const instantEnvelope = Math.sqrt(sum / bufferLength);

        // Exponential smoothing: envelope = α * current + (1-α) * previous
        this.envelope = this.envelopeSmoothing * instantEnvelope +
                       (1 - this.envelopeSmoothing) * this.envelope;

        const volume = Math.min(100, this.envelope * 500);
        if (this.onVolumeChange) {
            this.onVolumeChange(volume);
        }

        // === STEP 2: Calculate Spectral Flux (onset detection) ===
        this.spectralFlux = this.calculateSpectralFlux(freqBuffer);

        // Handle cooldown period
        if (this.cooldownFrames > 0) {
            this.cooldownFrames--;
            this.emitDebugData('COOLDOWN', null);
            if (this.onNoteDetected) {
                this.onNoteDetected(null);
            }
            this.animationId = requestAnimationFrame(() => this.detectPitch());
            return;
        }

        // === STEP 3: Detect pitch using YIN algorithm ===
        const pitchResult = this.yinPitch(timeBuffer, this.audioContext.sampleRate);
        let detectedPitch = null;
        let yinConfidence = 0;

        if (pitchResult && pitchResult.frequency >= this.MIN_FREQUENCY &&
            pitchResult.frequency <= this.MAX_FREQUENCY) {
            detectedPitch = pitchResult.frequency;
            yinConfidence = pitchResult.confidence;
        }

        // === STEP 4: Calculate harmonic confidence ===
        if (detectedPitch) {
            this.harmonicConfidence = this.calculateHarmonicConfidence(freqBuffer, detectedPitch);
        } else {
            this.harmonicConfidence = 0;
        }

        // === STEP 5: ADSR State Machine with Hysteresis ===
        this.updateNoteState(detectedPitch, yinConfidence);

        // === STEP 6: Emit results ===
        this.emitNoteDetection();

        this.animationId = requestAnimationFrame(() => this.detectPitch());
    }

    calculateSpectralFlux(spectrum) {
        if (!this.previousSpectrum) {
            this.previousSpectrum = new Uint8Array(spectrum);
            return 0;
        }

        // Spectral flux = sum of positive differences in magnitude
        let flux = 0;
        for (let i = 0; i < spectrum.length; i++) {
            const diff = (spectrum[i] - this.previousSpectrum[i]) / 255.0;
            if (diff > 0) {
                flux += diff * diff; // L2 norm of positive differences
            }
        }
        flux = Math.sqrt(flux);

        // Update history for adaptive thresholding
        this.fluxHistory.push(flux);
        if (this.fluxHistory.length > this.FLUX_HISTORY_SIZE) {
            this.fluxHistory.shift();
        }

        this.previousSpectrum = new Uint8Array(spectrum);
        return flux;
    }

    updateNoteState(detectedPitch, yinConfidence) {
        const prevState = this.noteState;

        // Calculate dynamic thresholds based on recent history
        const avgFlux = this.fluxHistory.length > 0 ?
            this.fluxHistory.reduce((a, b) => a + b, 0) / this.fluxHistory.length : 0;
        const adaptiveOnsetThreshold = Math.max(this.ONSET_THRESHOLD, avgFlux * 1.5);

        switch (this.noteState) {
            case 'SILENCE':
                // Transition to ATTACK if we detect onset + sufficient energy
                if (this.spectralFlux > adaptiveOnsetThreshold &&
                    this.envelope > this.ATTACK_THRESHOLD) {
                    this.framesSinceAttack++;

                    if (this.framesSinceAttack >= this.ATTACK_HYSTERESIS_FRAMES) {
                        this.noteState = 'ATTACK';
                        this.peakEnvelope = this.envelope;
                        this.noteStartTime = Date.now();
                        this.framesSinceAttack = 0;
                    }
                } else {
                    this.framesSinceAttack = 0;
                }
                break;

            case 'ATTACK':
                // Track peak during attack
                if (this.envelope > this.peakEnvelope) {
                    this.peakEnvelope = this.envelope;
                }

                // Transition to SUSTAIN when envelope stabilizes
                if (this.envelope < this.peakEnvelope * 0.95 &&
                    this.envelope > this.RELEASE_THRESHOLD) {
                    this.noteState = 'SUSTAIN';

                    // Capture note at end of attack phase
                    if (detectedPitch && this.harmonicConfidence > this.MIN_HARMONIC_CONFIDENCE) {
                        const noteInfo = this.frequencyToNote(detectedPitch);
                        this.currentNote = {
                            ...noteInfo,
                            confidence: yinConfidence,
                            harmonicConfidence: this.harmonicConfidence
                        };
                    }
                }
                break;

            case 'SUSTAIN':
                // Update note if we have better detection
                if (detectedPitch && this.harmonicConfidence > this.MIN_HARMONIC_CONFIDENCE) {
                    const noteInfo = this.frequencyToNote(detectedPitch);
                    if (!this.currentNote ||
                        Math.abs(detectedPitch - this.currentNote.frequency) < 20) {
                        this.currentNote = {
                            ...noteInfo,
                            confidence: yinConfidence,
                            harmonicConfidence: this.harmonicConfidence
                        };
                    }
                }

                // Transition to RELEASE when energy drops significantly
                if (this.envelope < this.RELEASE_THRESHOLD) {
                    this.framesSinceRelease++;

                    if (this.framesSinceRelease >= this.RELEASE_HYSTERESIS_FRAMES) {
                        this.noteState = 'RELEASE';
                        this.framesSinceRelease = 0;
                    }
                } else {
                    this.framesSinceRelease = 0;
                }
                break;

            case 'RELEASE':
                // Note is decaying, wait for silence
                if (this.envelope < this.RELEASE_THRESHOLD * 0.5) {
                    const noteDuration = Date.now() - this.noteStartTime;

                    // Only clear note if it lasted long enough
                    if (noteDuration >= this.MIN_NOTE_DURATION) {
                        this.noteState = 'SILENCE';
                        this.currentNote = null;
                    }
                }

                // If energy increases again, might be a new note
                if (this.spectralFlux > adaptiveOnsetThreshold &&
                    this.envelope > this.ATTACK_THRESHOLD) {
                    this.noteState = 'SILENCE'; // Will transition to ATTACK next frame
                }
                break;
        }

        // Debug state transitions
        if (prevState !== this.noteState) {
            this.emitDebugData('STATE_TRANSITION', {
                from: prevState,
                to: this.noteState
            });
        }
    }

    emitNoteDetection() {
        if (this.onNoteDetected) {
            if (this.currentNote && (this.noteState === 'SUSTAIN' || this.noteState === 'ATTACK')) {
                const noteName = `${this.currentNote.name}${this.currentNote.octave}`;
                this.onNoteDetected({
                    displayNote: noteName,
                    frequency: this.currentNote.frequency,
                    cents: this.currentNote.cents,
                    name: this.currentNote.name,
                    octave: this.currentNote.octave,
                    confidence: this.currentNote.confidence,
                    harmonicConfidence: this.currentNote.harmonicConfidence,
                    state: this.noteState
                });
            } else {
                this.onNoteDetected(null);
            }
        }

        // Emit comprehensive debug data
        this.emitDebugData('FRAME', {
            envelope: this.envelope,
            peakEnvelope: this.peakEnvelope,
            spectralFlux: this.spectralFlux,
            state: this.noteState,
            currentNote: this.currentNote,
            harmonicConfidence: this.harmonicConfidence
        });
    }

    emitDebugData(eventType, data) {
        if (this.debugMode && this.onDebugData) {
            this.onDebugData({
                timestamp: Date.now(),
                type: eventType,
                data: data,
                state: {
                    noteState: this.noteState,
                    envelope: this.envelope.toFixed(4),
                    spectralFlux: this.spectralFlux.toFixed(4),
                    harmonicConf: this.harmonicConfidence.toFixed(2)
                }
            });
        }
    }

    /**
     * YIN Algorithm - Probabilistic pitch detection
     * Reference: "YIN, a fundamental frequency estimator for speech and music"
     * by Cheveigne & Kawahara (2002)
     */
    yinPitch(buffer, sampleRate) {
        const bufferSize = buffer.length;
        const halfSize = Math.floor(bufferSize / 2);

        // Step 1: Calculate difference function
        // d(tau) = sum of squared differences between buffer[i] and buffer[i+tau]
        const differenceFunction = new Float32Array(halfSize);
        for (let tau = 0; tau < halfSize; tau++) {
            let sum = 0;
            for (let i = 0; i < halfSize; i++) {
                const delta = buffer[i] - buffer[i + tau];
                sum += delta * delta;
            }
            differenceFunction[tau] = sum;
        }

        // Step 2: Cumulative mean normalized difference function (CMNDF)
        // d'(tau) = d(tau) / [(1/tau) * sum(d(j)) for j=1 to tau]
        const cmndf = new Float32Array(halfSize);
        cmndf[0] = 1; // By definition

        let runningSum = 0;
        for (let tau = 1; tau < halfSize; tau++) {
            runningSum += differenceFunction[tau];
            cmndf[tau] = differenceFunction[tau] / (runningSum / tau);
        }

        // Step 3: Absolute threshold - find first tau where CMNDF < threshold
        const minTau = Math.floor(sampleRate / this.MAX_FREQUENCY);
        const maxTau = Math.floor(sampleRate / this.MIN_FREQUENCY);

        let tau = minTau;
        while (tau < maxTau) {
            if (cmndf[tau] < this.YIN_THRESHOLD) {
                // Found a candidate, now search for local minimum
                while (tau + 1 < maxTau && cmndf[tau + 1] < cmndf[tau]) {
                    tau++;
                }
                break;
            }
            tau++;
        }

        // No valid pitch found
        if (tau >= maxTau || cmndf[tau] >= this.YIN_THRESHOLD) {
            return null;
        }

        // Step 4: Parabolic interpolation for sub-sample accuracy
        let betterTau = tau;
        if (tau > 0 && tau < cmndf.length - 1) {
            const s0 = cmndf[tau - 1];
            const s1 = cmndf[tau];
            const s2 = cmndf[tau + 1];

            // Parabolic interpolation formula
            const adjustment = (s2 - s0) / (2 * (2 * s1 - s2 - s0));
            betterTau = tau + adjustment;
        }

        const frequency = sampleRate / betterTau;

        // Confidence = 1 - CMNDF value (lower CMNDF = more periodic = higher confidence)
        const confidence = 1 - cmndf[tau];

        return {
            frequency: frequency,
            confidence: confidence,
            tau: betterTau,
            cmndf: cmndf[tau]
        };
    }

    /**
     * Calculate harmonic confidence by checking if expected harmonics
     * are present in the frequency spectrum
     */
    calculateHarmonicConfidence(spectrum, fundamentalFreq) {
        const sampleRate = this.audioContext.sampleRate;
        const fftSize = this.analyser.fftSize;
        const binWidth = sampleRate / fftSize;

        // Check first 5 harmonics
        const numHarmonics = 5;
        let harmonicScore = 0;
        let totalWeight = 0;

        for (let h = 1; h <= numHarmonics; h++) {
            const harmonicFreq = fundamentalFreq * h;
            if (harmonicFreq > sampleRate / 2) break;

            // Find the bin corresponding to this harmonic
            const binIndex = Math.round(harmonicFreq / binWidth);
            if (binIndex >= spectrum.length) break;

            // Check magnitude at harmonic frequency and neighbors
            const magnitude = spectrum[binIndex] / 255.0;
            const leftMag = binIndex > 0 ? spectrum[binIndex - 1] / 255.0 : 0;
            const rightMag = binIndex < spectrum.length - 1 ? spectrum[binIndex + 1] / 255.0 : 0;

            // Take max of center and neighbors (accounts for frequency drift)
            const peakMag = Math.max(magnitude, leftMag, rightMag);

            // Weight lower harmonics more heavily (they're stronger in musical instruments)
            const weight = 1.0 / h;
            harmonicScore += peakMag * weight;
            totalWeight += weight;
        }

        // Normalize to 0-1 range
        return totalWeight > 0 ? Math.min(1.0, harmonicScore / totalWeight) : 0;
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

    // ===== DEBUG METHODS =====

    /**
     * Enable or disable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        if (enabled) {
            console.log('Audio Detector Debug Mode ENABLED');
            console.log('Parameters:', {
                'YIN Threshold': this.YIN_THRESHOLD,
                'Attack Threshold': this.ATTACK_THRESHOLD,
                'Release Threshold': this.RELEASE_THRESHOLD,
                'Onset Threshold': this.ONSET_THRESHOLD,
                'Min Harmonic Conf': this.MIN_HARMONIC_CONFIDENCE
            });
        }
    }

    /**
     * Enable console logging of debug data
     */
    enableConsoleDebug() {
        this.setDebugMode(true);

        let frameCount = 0;
        const LOG_INTERVAL = 30; // Log every 30 frames (~500ms at 60fps)

        this.onDebugData = (debugInfo) => {
            // Log state transitions immediately
            if (debugInfo.type === 'STATE_TRANSITION') {
                console.log(`%cSTATE: ${debugInfo.data.from} -> ${debugInfo.data.to}`,
                    'color: #00ff00; font-weight: bold;',
                    debugInfo.state);
            }

            // Log periodic frame data
            if (debugInfo.type === 'FRAME') {
                frameCount++;
                if (frameCount % LOG_INTERVAL === 0) {
                    this.logFrameDebug(debugInfo);
                }
            }

            // Log cooldown events
            if (debugInfo.type === 'COOLDOWN') {
                console.log('%cCOOLDOWN ACTIVE', 'color: #ffaa00;');
            }
        };
    }

    /**
     * Log detailed frame debug information
     */
    logFrameDebug(debugInfo) {
        const data = debugInfo.data;
        const state = debugInfo.state;

        console.group(`Frame Debug [${state.noteState}]`);

        console.log('%cEnvelope Analysis:', 'font-weight: bold;');
        console.log(`  Current: ${state.envelope}`);
        console.log(`  Peak:    ${data.peakEnvelope.toFixed(4)}`);
        this.printBar('Energy', parseFloat(state.envelope) * 100, 10);

        console.log('%cOnset Detection:', 'font-weight: bold;');
        console.log(`  Spectral Flux: ${state.spectralFlux}`);
        this.printBar('Flux', parseFloat(state.spectralFlux) * 100, 3);

        if (data.currentNote) {
            console.log('%cDetected Note:', 'font-weight: bold; color: #00ffff;');
            console.log(`  Note: ${data.currentNote.name}${data.currentNote.octave}`);
            console.log(`  Freq: ${data.currentNote.frequency.toFixed(2)} Hz`);
            console.log(`  Cents: ${data.currentNote.cents > 0 ? '+' : ''}${data.currentNote.cents}`);
            console.log(`  YIN Confidence: ${(data.currentNote.confidence * 100).toFixed(1)}%`);
            console.log(`  Harmonic Conf:  ${state.harmonicConf}`);

            this.printBar('Pitch Accuracy', 50 + (data.currentNote.cents / 2), 100);
        }

        console.groupEnd();
    }

    /**
     * Print a visual bar chart to console
     */
    printBar(label, value, maxValue) {
        const percentage = Math.min(100, (value / maxValue) * 100);
        const barLength = 20;
        const filled = Math.round((percentage / 100) * barLength);
        const empty = barLength - filled;

        const bar = '#'.repeat(filled) + '-'.repeat(empty);
        const color = percentage > 75 ? '#00ff00' : percentage > 50 ? '#ffaa00' : '#ff0000';

        console.log(`  %c${label}: ${bar} ${percentage.toFixed(0)}%`, `color: ${color};`);
    }

    /**
     * Get current state as a formatted object for debugging
     */
    getDebugState() {
        return {
            noteState: this.noteState,
            envelope: {
                current: this.envelope.toFixed(4),
                peak: this.peakEnvelope.toFixed(4),
                attackThreshold: this.ATTACK_THRESHOLD,
                releaseThreshold: this.RELEASE_THRESHOLD
            },
            onset: {
                spectralFlux: this.spectralFlux.toFixed(4),
                fluxHistory: this.fluxHistory.map(f => f.toFixed(4)),
                onsetThreshold: this.ONSET_THRESHOLD
            },
            note: this.currentNote ? {
                name: `${this.currentNote.name}${this.currentNote.octave}`,
                frequency: this.currentNote.frequency.toFixed(2),
                cents: this.currentNote.cents,
                yinConfidence: (this.currentNote.confidence * 100).toFixed(1) + '%',
                harmonicConfidence: (this.currentNote.harmonicConfidence * 100).toFixed(1) + '%'
            } : null,
            timing: {
                framesSinceAttack: this.framesSinceAttack,
                framesSinceRelease: this.framesSinceRelease,
                cooldownFrames: this.cooldownFrames
            }
        };
    }

    /**
     * Print comprehensive debug information to console
     */
    printDebugState() {
        console.clear();
        console.log('%cAUDIO DETECTOR DEBUG STATE', 'font-size: 14px; font-weight: bold; color: #00ffff;');
        console.table(this.getDebugState());
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioDetector;
}
