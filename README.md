# fretlearner

An interactive Electron app for learning the guitar fretboard using audio detection and flashcard-based learning.

## Features

- **Advanced Audio Detection**:
  - Real-time pitch detection using YIN algorithm (industry-standard)
  - Mathematical note segmentation with ADSR envelope tracking
  - Spectral flux onset detection for fast and slow attacks
  - Harmonic validation to reject noise and octave errors
  - Pitch stability checking prevents false detections
  - Automatic silence detection for smooth note transitions
- **Visual Fretboard**: Interactive fretboard showing note positions and string information
- **Progressive Learning**: Master notes step-by-step
  - Natural notes (C, D, E, F, G, A, B)
  - Sharps (C#, D#, F#, G#, A#)
  - Flats (Db, Eb, Gb, Ab, Bb)
  - Notes anywhere on the fretboard
- **Flexible Practice Options**:
  - **Repeat each note**: Practice individual notes multiple times (1-10 repetitions)
  - **Full rounds**: Complete rounds through all notes (1-10 rounds)
  - **Random rounds**: Randomized practice after completing rounds (1-5 rounds)
  - **Focus Mode**: Enlarged flashcard with hidden fretboard for distraction-free practice
- **Smart Progression**:
  - Visual feedback with "Good job!" screen between repetitions
  - Intelligent release detection - waits for note to decay before advancing
  - String information displayed on flashcard
- **Progress Tracking**: Automatically saves progress and resumes where you left off
- **String-by-String Learning**: Master each string individually before moving on
- **Testing Mode**: Practice without audio input using on-screen buttons or keyboard shortcuts

## How It Works

1. Select your audio input device (guitar interface/microphone) or enable Testing Mode
2. Start audio detection (or skip if using Testing Mode)
3. Begin your learning session
4. Play the note shown on the flashcard with string information (e.g., "E on Low E (6th)")
5. The app detects your playing and shows "Good job!" when correct
6. Release the note - the app waits for the sound to decay before advancing
7. Each note can be repeated multiple times based on your "Repeat each note" setting
8. Complete multiple rounds through all notes based on your "Full rounds" setting
9. After completing all rounds, practice with randomized notes in "Random rounds"
10. Progress through all 6 strings (Low E → A → D → G → B → High E), then move to the next mode
11. Your progress is automatically saved and can be resumed anytime

## Installation

### Prerequisites

- Node.js (v16 or higher)
- npm

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the app:
   ```bash
   npm start
   ```

### Development Mode

Run with DevTools open:
```bash
npm run dev
```


### Building
```bash
npm run build
```

## Usage

### Initial Setup

#### Option 1: With Audio Input (Guitar/Microphone)

1. **Select Audio Input**: Choose your guitar interface or microphone from the dropdown
2. **Start Audio Detection**: Click "Start Audio Detection" to begin listening
3. **Configure Settings** (optional):
   - **Focus Mode**: Enable to enlarge flashcard and hide fretboard for distraction-free practice
   - **Repeat each note**: How many times to repeat each individual note before moving on (1-10, default: 1)
   - **Full rounds**: How many complete rounds through all notes (1-10, default: 2)
   - **Random rounds**: How many randomized rounds after completing all full rounds (1-5, default: 1)

#### Option 2: Testing Mode (No Audio Required)

1. **Enable Testing Mode**: Check the "Enable Testing Mode" checkbox
2. **Start Learning**: Click "Start Learning" (no audio setup needed)
3. **Input Notes**: Use the on-screen buttons or keyboard shortcuts to simulate notes
   - Click note buttons: C, C#, D, D#, E, F, F#, G, G#, A, A#, B
   - Keyboard shortcuts: Press C, D, E, F, G, A, or B
   - For sharps: Hold Shift or press S then the note
   - For flats: Press L or F then the note

### Learning Session

1. Click "Start Learning" to begin
2. The app shows you a note to play with string information (e.g., "F on Low E (6th)")
3. Play that note on your guitar
4. When detected correctly:
   - You'll see a green checkmark (✓) and "Good job!" message
   - The fretboard highlight clears
   - After 2 seconds, if you're still holding the note, you'll see "Release the note..."
   - The app automatically advances when it detects silence
5. For incorrect attempts, you'll see feedback showing which note you played
6. With "Repeat each note" > 1, you'll see repetition count (e.g., "Rep 1/3")

### Learning Progression

The app follows this progression:
1. **Natural Notes** - Learn C, D, E, F, G, A, B on each string
2. **Sharps** - Learn C#, D#, F#, G#, A# on each string
3. **Flats** - Learn Db, Eb, Gb, Ab, Bb on each string
4. **Notes Anywhere** - Practice all notes randomly

Each mode progresses through all 6 strings (High E → B → G → D → A → Low E)

### Controls

- **Start Learning / Pause**: Begin or pause your learning session
- **Reset Current Level**: Restart the current string
- **Reset All Progress**: Erase all progress and start from the beginning
- **Mode Selection**: Jump to a specific learning mode (naturals, sharps, flats, anywhere)

### Progress Tracking

Your progress is automatically saved, including:
- Current mode and string
- Notes completed
- Accuracy statistics
- Settings preferences

#### Data Storage Location

The application stores all progress data locally using browser localStorage. Since this is an Electron app, your data is stored in the Electron userData directory.

- **Linux**: `~/.config/fretlearner/Local Storage/`
- **macOS**: `~/Library/Application Support/fretlearner/Local Storage/`
- **Windows**: `%APPDATA%\fretlearner\Local Storage\`

All progress data is stored in a single localStorage key called `fretlearner_state`, which includes:
- Current learning mode (naturals, sharps, flats, anywhere)
- Current string and note position
- Repetition and round counters
- Total attempts and accuracy statistics
- User settings (repeat count, random rounds, etc.)

## Technical Details

### Audio Detection

The application uses advanced Music Information Retrieval (MIR) techniques for robust note detection:

**Pitch Detection - YIN Algorithm**
- Industry-standard YIN algorithm (Cheveigne & Kawahara, 2002)
- Uses difference function instead of autocorrelation for better accuracy
- Cumulative Mean Normalized Difference Function (CMNDF) for periodicity detection
- Parabolic interpolation for sub-sample frequency accuracy
- Optimized for guitar frequency range (82-2000 Hz, E2-B6)

**Note Segmentation - ADSR State Machine**
- Tracks note lifecycle: SILENCE → ATTACK → SUSTAIN → RELEASE → SILENCE
- Exponential smoothing for stable amplitude envelope tracking
- Hysteresis prevents rapid state oscillation and false triggers
- Minimum note duration filtering

**Onset Detection - Spectral Flux**
- Measures changes in magnitude spectrum between frames
- L2 norm of positive spectral differences
- Adaptive thresholding based on recent history
- Dual detection paths for fast and slow attacks

**Harmonic Validation**
- Analyzes first 5 harmonic partials in frequency spectrum
- Weighted scoring (lower harmonics weighted more heavily)
- Rejects noise, overtones, and octave errors
- Ensures detected pitch matches expected harmonic structure

**Pitch Stability**
- Tracks recent pitch detections for consistency
- Requires multiple consistent readings before committing to a note
- Prevents octave errors during attack transients
- Guitar range validation (rejects pitches below E2)

**Technical Stack**
- Web Audio API for real-time audio processing
- FFT size: 4096 samples for better low-frequency resolution
- Works with any audio interface or direct microphone input
- No echoCancellation, noiseSuppression, or autoGainControl for accurate pitch detection

**Debug Mode**
- Press `Ctrl+Shift+D` or type `debugAudio()` in console to toggle
- Real-time visualization of envelope, spectral flux, and pitch stability
- State transition logging
- Confidence metrics for YIN and harmonic analysis

### Fretboard Visualization

- Shows standard 6-string guitar tuning (E-A-D-G-B-E)
- Displays first 12 frets
- Highlights target notes in real-time
- Visual feedback for current position

## Troubleshooting

### Audio Not Detected

- Check that your audio interface is properly connected
- Ensure the correct input device is selected
- Try increasing the input gain on your interface
- Make sure your browser/Electron has microphone permissions
- Enable debug mode (`Ctrl+Shift+D`) to see real-time detection data
- For gentle playing, the system detects slow attacks - no need to strike hard

### Wrong Notes Detected

- Fast playing may detect lower octaves initially - pitch stabilizes after a few frames
- Enable debug mode to see pitch stability tracking
- Ensure clean note articulation without string noise
- The system automatically rejects pitches outside guitar range

### Performance Issues

- Close other applications using the microphone
- Reduce the number of browser/Electron windows open
- Ensure your system meets the minimum requirements
