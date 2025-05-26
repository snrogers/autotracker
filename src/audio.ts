/*
  Copyright 2020 David Whiting
  This work is licensed under a Creative Commons Attribution 4.0 International License
  https://creativecommons.org/licenses/by/4.0/
*/
import {fill, rnd} from './utils'
import type {Note, Drum} from './model'

type Synth<T> = { play: (note: T) => void}

const A3Frequency = 440;
const A0Frequency = A3Frequency / 8;


function Audio(ctx: AudioContext) {
    function oscillatorNode(type: OscillatorType, freq: number = 440): OscillatorNode {
        const node = ctx.createOscillator();
        node.type = type;
        node.frequency.value = freq;
        return node;
    }
    function waveShaperNode(curve: Float32Array | number[]): WaveShaperNode {
        const node = ctx.createWaveShaper();
        node.curve = new Float32Array(curve);
        return node;
    }
    function gainNode(gainAmount: number = 0): GainNode {
        const node = ctx.createGain();
        node.gain.value = gainAmount;
        return node;
    }
    function stereoPannerNode(pan: number): StereoPannerNode {
        if (ctx.createStereoPanner) {
            const node = ctx.createStereoPanner();
            node.pan.value = pan;
            return node;
        } else {
            const node = ctx.createPanner();
            node.panningModel = "equalpower";
            node.setPosition(pan, 0, 0.5);
            // @ts-ignore
            node.pan = node.positionX;
            return node as AudioNode as StereoPannerNode
        }
    }

    function SquareSynth(pan: number = 0): Synth<Note> {
        const set = (a: AudioParam, v: number) => {a.cancelScheduledValues(ctx.currentTime); a.setValueAtTime(v, ctx.currentTime); };
        const towards = (a: AudioParam, v: number, t: number) => {a.setTargetAtTime(v, ctx.currentTime, t)};
        const slide = (a: AudioParam, v: number, t: number) => {a.cancelScheduledValues(ctx.currentTime); a.setTargetAtTime(v,ctx.currentTime, t)};

        const wavetableTrigger = oscillatorNode("sawtooth"),
            pulseWavetable = waveShaperNode(new Float32Array(256).fill(-1,0,128).fill(1,128,256)),
            alwaysOneWavetable = waveShaperNode(new Float32Array(2).fill(1,0,2)),
            wavetableOffsetGain = gainNode(),
            pulseOutputGain = gainNode(),
            outputPanner = stereoPannerNode(pan);
        wavetableTrigger.start();
        wavetableTrigger.connect(pulseWavetable);
        wavetableTrigger.connect(alwaysOneWavetable);
        alwaysOneWavetable.connect(wavetableOffsetGain);
        wavetableOffsetGain.connect(pulseWavetable);
        pulseWavetable.connect(pulseOutputGain);
        pulseOutputGain.connect(outputPanner);
        outputPanner.connect(ctx.destination);

        const freq = wavetableTrigger.frequency,
            width = wavetableOffsetGain.gain,
            gain = pulseOutputGain.gain;

        const decay = 0.04, sustain = 0.7, release = 0.01, level = 0.1;

        function noteOn(note: number, glide: number = 0) {
            try {
                // Limit and sanitize values
                const safeNote = Math.max(-128, Math.min(127, note)); // Reasonable MIDI note range
                const safeGlide = Math.max(0, Math.min(1, glide/10));
                const safeFreq = A0Frequency * 2 ** (safeNote / 12);
                
                // Ensure frequency is in a reasonable range (20Hz - 20kHz)
                const clampedFreq = Math.max(20, Math.min(20000, safeFreq));
                
                slide(freq, clampedFreq, safeGlide);
                set(gain, level);
                towards(gain, level * sustain, decay);
            } catch (err) {
                console.error("Error in noteOn:", err);
            }
        }
        function noteOff() {
            try {
                slide(gain, 0, release);
            } catch (err) {
                console.error("Error in noteOff:", err);
            }
        }
        function play(note: Note) {
            try {
                if (!note) return; // Guard against undefined notes
                
                if (note.note === "---") {
                    noteOff();
                } else if (note.note === 'cont') {
                    // do nothing
                } else if (typeof note.note === 'number') {
                    noteOn(note.note, note.fx?.glide || 0);
                }
                
                // Sanitize pulse width
                const safePW = note.fx?.pulseWidth !== undefined ? 
                    Math.max(0, Math.min(1, note.fx.pulseWidth)) : 0.0;
                set(width, safePW);
            } catch (err) {
                console.error("Error in play:", err);
            }
        }

        return {play}
    }

    function DrumSynth(): Synth<Drum> {
        // Create safer noise wavetable with clamped values
        const safeNoiseTable = new Float32Array(1024);
        for (let i = 0; i < 1024; i++) {
            // Ensure values are strictly between -1 and 1
            safeNoiseTable[i] = Math.max(-0.95, Math.min(0.95, rnd() * 1.9 - 0.95));
        }
        
        let toneOscillator, toneGain, noiseWavetableTrigger, noiseWavetable, noiseGain, noisePan;
        
        try {
            toneOscillator = oscillatorNode("square", 55);
            toneGain = gainNode(0); // Start with 0 gain for safety
            noiseWavetableTrigger = oscillatorNode("sawtooth", 20);
            noiseWavetable = waveShaperNode(safeNoiseTable);
            noiseGain = gainNode(0); // Start with 0 gain for safety
            noisePan = stereoPannerNode(0);

            toneOscillator.start();
            noiseWavetableTrigger.start();

            toneOscillator.connect(toneGain);
            toneGain.connect(ctx.destination);

            noiseWavetableTrigger.connect(noiseWavetable);
            noiseWavetable.connect(noiseGain);
            noiseGain.connect(noisePan);
            noisePan.connect(ctx.destination);
        } catch (err) {
            console.error("Error initializing drum synth:", err);
        }


        // Create a safer version of the audio parameter manipulation functions
        const safeSetParam = (param: AudioParam | undefined, value: number) => {
            if (!param) return;
            try {
                // Clamp the value to a safe range (0 to 1 for gain, etc.)
                const safeValue = Math.max(0, Math.min(1, value));
                param.cancelScheduledValues(ctx.currentTime);
                param.setValueAtTime(safeValue, ctx.currentTime);
            } catch (err) {
                // Silently catch errors
            }
        };
        
        const safeRampParam = (param: AudioParam | undefined, value: number, timeConstant: number) => {
            if (!param) return;
            try {
                // Clamp values
                const safeValue = Math.max(0, Math.min(1, value));
                const safeTime = Math.max(0.01, Math.min(1, timeConstant));
                param.setTargetAtTime(safeValue, ctx.currentTime, safeTime);
            } catch (err) {
                // Silently catch errors
            }
        };
        
        const safeSetEnvelope = (param: AudioParam | undefined, values: number[], duration: number) => {
            if (!param) return;
            try {
                // Create a safe envelope with clamped values
                const safeValues = new Float32Array(values.map(v => Math.max(0, Math.min(1, v))));
                const safeDuration = Math.max(0.01, Math.min(2, duration));
                param.setValueCurveAtTime(safeValues, ctx.currentTime, safeDuration);
            } catch (err) {
                // Silently catch errors
            }
        };
        
        // Create reference-safe local variables that can be used in the play function
        let localToneOscillator = toneOscillator;
        let localToneGain = toneGain;
        let localNoiseGain = noiseGain;
        let localNoisePan = noisePan;
        
        // Return a dummy play function if any component failed to initialize
        if (!localToneOscillator || !localToneGain || !localNoiseGain || !localNoisePan) {
            console.warn("Drum synth not properly initialized, using silent version");
            return { play: () => {} };
        }
        
        function play(slot: Drum) {
            try {
                if (!slot || typeof slot !== 'object') return; // Guard against invalid inputs
                
                // Sanitize velocity to be between 0 and 1, with a safe default
                const vel = slot.vel !== undefined ? Math.max(0.01, Math.min(0.95, slot.vel)) : 0.7;
                
                if (slot.drum === 'KCK') {
                    try {
                        // Use significantly clamped values for kick drum
                        if (localToneOscillator && localToneOscillator.detune) {
                            localToneOscillator.detune.cancelScheduledValues(ctx.currentTime);
                            localToneOscillator.detune.setValueAtTime(2000, ctx.currentTime);
                            safeRampParam(localToneOscillator.detune, 0, 0.07);
                        }
                        
                        // Use conservative volume levels
                        const kickVol = 0.15 * vel;
                        safeSetParam(localToneGain?.gain, kickVol);
                        
                        // Use more conservative envelope with fewer points
                        const kickEnvelope = [kickVol, kickVol * 0.8, kickVol * 0.3, 0];
                        safeSetEnvelope(localToneGain?.gain, kickEnvelope, 0.12);
                    } catch (err) {
                        // Silent error handling
                    }
                } else if (slot.drum === 'NSS') {
                    try {
                        // Use conservative volume levels
                        const noiseVol = 0.08 * vel;
                        safeSetParam(localNoiseGain?.gain, noiseVol);
                        
                        // Simpler envelope with fewer points
                        const noiseEnvelope = [noiseVol, 0];
                        safeSetEnvelope(localNoiseGain?.gain, noiseEnvelope, 0.06);
                        
                        // Skip panning to reduce complexity
                    } catch (err) {
                        // Silent error handling
                    }
                } else if (slot.drum === 'SNR') {
                    try {
                        // More conservative detune values
                        if (localToneOscillator && localToneOscillator.detune) {
                            localToneOscillator.detune.cancelScheduledValues(ctx.currentTime);
                            localToneOscillator.detune.setValueAtTime(1800, ctx.currentTime);
                            safeRampParam(localToneOscillator.detune, 500, 0.04);
                        }
                        
                        // Use conservative volume levels for tone component
                        const toneVol = 0.12 * vel;
                        safeSetParam(localToneGain?.gain, toneVol);
                        
                        // Simpler envelope with fewer points
                        const toneEnvelope = [toneVol, toneVol * 0.3, 0];
                        safeSetEnvelope(localToneGain?.gain, toneEnvelope, 0.08);
                        
                        // Use conservative volume for noise component
                        const noiseVol = 0.15 * vel;
                        safeSetParam(localNoiseGain?.gain, noiseVol);
                        
                        // Simpler envelope with fewer points
                        const noiseEnvelope = [noiseVol, 0];
                        safeSetEnvelope(localNoiseGain?.gain, noiseEnvelope, 0.12);
                    } catch (err) {
                        // Silent error handling
                    }
                }
            } catch (err) {
                // Silent error handling to prevent crashes
            }
        }
        return {
            play,
        }
    }
    return {
        SquareSynth,
        DrumSynth
    }
}

export default Audio