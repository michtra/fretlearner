// Fretboard visualization component
class Fretboard {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        // Guitar configuration (standard tuning, 6 strings)
        this.strings = [
            { note: 'E', octave: 4, name: 'High E' },  // 1st string (thinnest)
            { note: 'B', octave: 3, name: 'B' },        // 2nd string
            { note: 'G', octave: 3, name: 'G' },        // 3rd string
            { note: 'D', octave: 3, name: 'D' },        // 4th string
            { note: 'A', octave: 2, name: 'A' },        // 5th string
            { note: 'E', octave: 2, name: 'Low E' }     // 6th string (thickest)
        ];

        this.numFrets = 12; // Show first 12 frets
        this.highlightedNote = null;

        // Chromatic notes
        this.chromaticNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        this.resize();
        this.draw();
    }

    resize() {
        // Set canvas size
        const container = this.canvas.parentElement;
        this.canvas.width = 1000;
        this.canvas.height = 200;
    }

    // Get note at specific string and fret
    getNoteAt(stringIndex, fret) {
        const stringInfo = this.strings[stringIndex];
        const startNoteIndex = this.chromaticNotes.indexOf(stringInfo.note);
        const noteIndex = (startNoteIndex + fret) % 12;
        const octaveOffset = Math.floor((startNoteIndex + fret) / 12);

        return {
            note: this.chromaticNotes[noteIndex],
            octave: stringInfo.octave + octaveOffset,
            string: stringIndex,
            fret: fret
        };
    }

    // Highlight a specific note on the fretboard
    highlight(note, string = null, fret = null) {
        console.log('Fretboard highlight called:', { note, string, fret });
        this.highlightedNote = { note, string, fret };
        this.draw();
    }

    clearHighlight() {
        console.log('Fretboard clearHighlight called');
        this.highlightedNote = null;
        this.draw();
    }

    draw() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        console.log('Fretboard draw called, canvas size:', width, 'x', height, 'highlighted:', this.highlightedNote);

        // Clear canvas
        ctx.fillStyle = '#0a0b14';
        ctx.fillRect(0, 0, width, height);

        // Calculate dimensions
        const margin = 50;
        const fretboardWidth = width - 2 * margin;
        const fretboardHeight = height - 2 * margin;
        const stringSpacing = fretboardHeight / (this.strings.length - 1);

        // Draw fretboard background
        ctx.fillStyle = '#1a1d2e';
        ctx.fillRect(margin, margin - 20, fretboardWidth, fretboardHeight + 40);

        // Calculate fret positions (they get closer together as you go up)
        const fretPositions = [margin];
        const scaleLength = fretboardWidth - 60;
        for (let i = 1; i <= this.numFrets; i++) {
            const distance = scaleLength * (1 - Math.pow(2, -i / 12));
            fretPositions.push(margin + distance);
        }

        // Draw frets
        ctx.strokeStyle = '#2a2d42';
        ctx.lineWidth = 2;
        for (let i = 0; i <= this.numFrets; i++) {
            const x = fretPositions[i];
            ctx.beginPath();
            ctx.moveTo(x, margin - 20);
            ctx.lineTo(x, margin + fretboardHeight + 20);
            ctx.stroke();
        }

        // Draw fret markers (dots)
        ctx.fillStyle = '#2a2d42';
        const markerFrets = [3, 5, 7, 9];
        const doubleMarkerFrets = [12];

        for (const fret of markerFrets) {
            const x = (fretPositions[fret - 1] + fretPositions[fret]) / 2;
            const y = margin + fretboardHeight / 2;
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fill();
        }

        for (const fret of doubleMarkerFrets) {
            if (fret <= this.numFrets) {
                const x = (fretPositions[fret - 1] + fretPositions[fret]) / 2;
                const y1 = margin + fretboardHeight / 3;
                const y2 = margin + 2 * fretboardHeight / 3;
                ctx.beginPath();
                ctx.arc(x, y1, 6, 0, Math.PI * 2);
                ctx.arc(x, y2, 6, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Draw strings
        for (let i = 0; i < this.strings.length; i++) {
            const y = margin + i * stringSpacing;
            const thickness = 1 + (this.strings.length - i) * 0.5;

            ctx.strokeStyle = '#7e8fc7';
            ctx.lineWidth = thickness;
            ctx.beginPath();
            ctx.moveTo(margin, y);
            ctx.lineTo(margin + fretboardWidth, y);
            ctx.stroke();
        }

        // Draw string names
        ctx.fillStyle = '#9caae5';
        ctx.font = '14px Arial';
        ctx.textAlign = 'right';
        for (let i = 0; i < this.strings.length; i++) {
            const y = margin + i * stringSpacing;
            const stringInfo = this.strings[i];
            ctx.fillText(`${stringInfo.note}${stringInfo.octave}`, margin - 10, y + 5);
        }

        // Draw fret numbers
        ctx.textAlign = 'center';
        ctx.fillStyle = '#9caae5';
        ctx.font = '12px Arial';
        for (let i = 1; i <= this.numFrets; i++) {
            const x = (fretPositions[i - 1] + fretPositions[i]) / 2;
            ctx.fillText(i.toString(), x, height - 15);
        }

        // Highlight note if specified
        if (this.highlightedNote) {
            this.drawHighlight(fretPositions, stringSpacing, margin);
        }
    }

    drawHighlight(fretPositions, stringSpacing, margin) {
        const ctx = this.ctx;
        const { note, string, fret } = this.highlightedNote;

        // If specific position is given, highlight that
        if (string !== null && fret !== null) {
            const x = fret === 0 ?
                fretPositions[0] - 25 :
                (fretPositions[fret - 1] + fretPositions[fret]) / 2;
            const y = margin + string * stringSpacing;

            // Draw glowing circle
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#d4dcfb';
            ctx.fillStyle = '#d4dcfb';
            ctx.beginPath();
            ctx.arc(x, y, 15, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Draw note name
            ctx.fillStyle = '#0a0b14';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(note, x, y + 5);
        } else {
            // Highlight all instances of this note
            for (let s = 0; s < this.strings.length; s++) {
                for (let f = 0; f <= this.numFrets; f++) {
                    const noteInfo = this.getNoteAt(s, f);
                    if (noteInfo.note === note) {
                        const x = f === 0 ?
                            fretPositions[0] - 25 :
                            (fretPositions[f - 1] + fretPositions[f]) / 2;
                        const y = margin + s * stringSpacing;

                        ctx.shadowBlur = 15;
                        ctx.shadowColor = '#d4dcfb';
                        ctx.fillStyle = 'rgba(212, 220, 251, 0.6)';
                        ctx.beginPath();
                        ctx.arc(x, y, 12, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.shadowBlur = 0;

                        ctx.fillStyle = '#0a0b14';
                        ctx.font = 'bold 12px Arial';
                        ctx.textAlign = 'center';
                        ctx.fillText(note, x, y + 4);
                    }
                }
            }
        }
    }

    // Get the lowest fret position for a note on a specific string
    getLowestFretForNote(note, stringIndex) {
        // Enharmonic equivalents (flats to sharps)
        const enharmonics = {
            'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#'
        };

        // Convert flat to sharp if needed (fretboard uses sharps)
        const searchNote = enharmonics[note] || note;

        for (let fret = 0; fret <= this.numFrets; fret++) {
            const noteInfo = this.getNoteAt(stringIndex, fret);
            if (noteInfo.note === searchNote) {
                return fret;
            }
        }
        return null;
    }
}
