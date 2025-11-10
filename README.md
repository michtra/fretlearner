# fretlearner

An interactive Electron app for learning the guitar fretboard using audio detection and flashcard-based learning.

## Features

- **Advanced Audio Detection**:
  - Real-time pitch detection using autocorrelation algorithm
  - Volume threshold filtering for accurate note recognition
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
6. Each note can be repeated multiple times based on your "Repeat each note" setting
7. Complete multiple rounds through all notes based on your "Full rounds" setting
8. After completing all rounds, practice with randomized notes in "Random rounds"
9. Progress through all 6 strings (Low E → A → D → G → B → High E), then move to the next mode
10. Your progress is automatically saved and can be resumed anytime

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

- Uses Web Audio API with autocorrelation algorithm for pitch detection
- Optimized for guitar frequency range (50-2000 Hz)
- Works with any audio interface or direct microphone input

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

### Performance Issues

- Close other applications using the microphone
- Reduce the number of browser/Electron windows open
- Ensure your system meets the minimum requirements

## Credits

Based on autocorrelation pitch detection algorithm inspired by various open-source implementations.
