/*
  Copyright 2020 David Whiting
  This work is licensed under a Creative Commons Attribution 4.0 International License
  https://creativecommons.org/licenses/by/4.0/
*/

import {choose, fill, rndInt, rnd, seedRNG} from './utils'
import * as music from './theory'
import * as Generators from './generators'
import {scales} from "./theory";
import Audio from "./audio";
import type {Drum, Key, Note, Pattern, Progression, Scale} from "./model";
import { AudioContext } from 'node-web-audio-api';

const PatternSize = 64;

const progressions = [
    [1,1,1,1,6,6,6,6,4,4,4,4,3,3,5,5],
    [1,1,1,1,6,6,6,6,1,1,1,1,6,6,6,6],
    [4,4,4,4,5,5,5,5,1,1,1,1,1,1,3,3],
    [1,1,6,6,4,4,5,5,1,1,6,6,3,3,5,5],
    [5,5,4,4,1,1,1,1,5,5,6,6,1,1,1,1],
    [6,6,6,6,5,5,5,5,4,4,4,4,5,5,5,5],
    [1,1,1,1,3,3,3,3,4,4,4,4,5,5,5,5],
    [6,6,6,6,4,4,4,4,1,1,1,1,1,1,5,5],
    [1,1,1,1,1,1,1,1,4,4,4,4,4,4,4,4]
];

type Synth<T> = { play: (note: T) => void}
type FourChannelsPlusDrums = [Note, Note, Note, Note, Drum]
type PatternsType<T> = { [K in keyof T]: Pattern<T[K]> };
type SynthsType<T> = { [K in keyof T]: Synth<T[K]> }

interface State {
    key: Key,
    scale: Scale,
    progression: Progression,
    bpm: number,
    songIndex: number,
    seedCode: string
}

type SaveCode = string & {typeTag: "__SaveCode"}

function hex(v: number) { return Math.floor(v).toString(16).toUpperCase().padStart(2,'0'); }
function unhex(v: string): number {
    return parseInt(v, 16)
}

function save(state: State): SaveCode {
    const nonRandomElements = [state.key, state.scale == music.scales.major ? 0 : 1, progressions.indexOf(state.progression), state.bpm, state.songIndex % 256];
    const saveCode = "0x" + nonRandomElements.map(hex).join("") + state.seedCode;
    return saveCode as SaveCode;
}

function restore(code: SaveCode): State {
    const codeString = code.slice(2);
    const key = unhex(codeString.slice(0,2)) as Key;
    const scale = unhex(codeString.slice(2,4)) === 0 ? music.scales.major : music.scales.minor;
    const progression = progressions[unhex(codeString.slice(4,6))];
    const bpm = unhex(codeString.slice(6,8));
    const songIndex = unhex(codeString.slice(8,10));
    const seedCode = codeString.slice(10);
    return {
        bpm,
        key,
        progression,
        scale,
        seedCode,
        songIndex
    }
}

function createSeedCode() {
    return hex(rndInt(255)) +hex(rndInt(255)) + hex(rndInt(255)) + hex(rndInt(255));
}

function createInitialState(seedOrSave: string): State {
    if (seedOrSave.startsWith("0x")) {
        return restore(seedOrSave as SaveCode);
    } else {
        seedRNG(seedOrSave && seedOrSave.length > 0 ? seedOrSave : "" + Math.random());
        return {
            key: rndInt(12) as Key,
            scale: music.scales.minor,
            progression: progressions[0],
            bpm: 112,
            seedCode: createSeedCode(),
            songIndex: 0
        };
    }
}

function mutateState(state: State): void {
    state.songIndex++;
    if (state.songIndex % 8 === 0) {
        state.bpm = Math.floor(rnd() * 80) + 100;
    }
    if (state.songIndex % 4 === 0) {
        [state.key, state.scale] = music.modulate(state.key, state.scale);
    }
    if (state.songIndex % 2 === 0) {
        state.progression = choose(progressions);
    }
    state.seedCode = hex(rndInt(255)) +hex(rndInt(255)) + hex(rndInt(255)) + hex(rndInt(255));
    seedRNG(state.seedCode);
}

function textRepr(slot: Drum | Note): string {
    function hex(v: number) { return Math.floor(v * 255).toString(16).toUpperCase().padStart(2,'0'); }
    function noteName(v: number | "---" | "cont") {
        switch (v) {
            case "---":
                return "---";
            case "cont":
                return "   ";
            default:
                return ['A-', 'A#', 'B-', 'C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#'][(v - (-12)) % 12] + Math.floor((v - (-12)) / 12)
        }
    }
    if ("drum" in slot) {
        let string = slot.drum;
        if (slot.vel) string +=" v" + hex(slot.vel);
        return string;
    } else {
        let string = noteName(slot.note);
        if (slot.fx && slot.fx.pulseWidth) string += " w" +hex(slot.fx.pulseWidth);
        if (slot.fx && slot.fx.glide) string +="  g" + hex(slot.fx.glide);
        if (slot.vel) string += " v" + hex(slot.vel);
        return string;
    }
}

function displayPatterns(patterns: Pattern<Slot>[], saveString: string): void {
    console.log(`Pattern ID: ${saveString}`);
    
    // Display column headers
    console.log("    | CH1      | CH2      | CH3      | CH4      | DRUMS    |");
    console.log("----+----------+----------+----------+----------+----------+");
    
    // Display pattern rows
    for (let i = 0; i < PatternSize; i++) {
        const rowNum = i.toString().padStart(2, '0');
        const highlight = i % 16 === 0 ? ">" : i % 4 === 0 ? "+" : " ";
        
        const row = `${highlight}${rowNum} | ${textRepr(patterns[0][i]).padEnd(8)} | ${textRepr(patterns[1][i]).padEnd(8)} | ${textRepr(patterns[2][i]).padEnd(8)} | ${textRepr(patterns[3][i]).padEnd(8)} | ${textRepr(patterns[4][i]).padEnd(8)} |`;
        console.log(row);
    }
}

function bpmClock() {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let fN = 0;
    
    function set(bpm: number, frameFunction: (f: number) => void) {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }
        
        const frameTime = (60000 / bpm) / 4;
        
        function scheduleFrame() {
            frameFunction(fN++);
            timeoutId = setTimeout(scheduleFrame, frameTime);
        }
        
        scheduleFrame();
    }
    
    function stop() {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    }
    
    return {
        set,
        stop
    };
}

type Slot = Note | Drum;

async function runAutotracker(seedOrSave: string = "", duration: number = 0) {
    const state: State = createInitialState(seedOrSave);
    console.log(`Starting AutoTracker with seed: ${seedOrSave || "random"}`);
    console.log(`Initial state: BPM=${state.bpm}, Key=${state.key}, Scale=${state.scale === scales.major ? "Major" : "Minor"}`);
    
    let patterns = [[],[],[],[],[]] as PatternsType<FourChannelsPlusDrums>;
    const clock = bpmClock();
    
    // Create and initialize audio context using node-web-audio-api
    const ctx = new AudioContext();
    const au = Audio(ctx);
    
    const synths: SynthsType<FourChannelsPlusDrums> = [
        au.SquareSynth(),
        au.SquareSynth(-0.5),
        au.SquareSynth(),
        au.SquareSynth(0.5),
        au.DrumSynth()
    ];
    
    function newPatterns() {
        seedRNG(state.seedCode);
        patterns = [
            choose([Generators.bass, Generators.bass2, Generators.emptyNote])(state),
            rnd() < 0.7 ? Generators.arp(state) : Generators.emptyNote(),
            rnd() < 0.7 ? Generators.melody1(state) : Generators.emptyNote(),
            choose([Generators.emptyNote, Generators.arp, Generators.melody1])(state),
            rnd() < 0.8 ? Generators.drum() : Generators.emptyDrum(),
        ];
    }
    
    // Create initial patterns
    newPatterns();
    displayPatterns(patterns, save(state));
    
    let endTimeoutId: ReturnType<typeof setTimeout> | null = null;
    
    function frame(f: number) {
        const positionInPattern = f % PatternSize;
        
        if (f % 128 === 0 && f !== 0) {
            mutateState(state);
            newPatterns();
            clock.set(state.bpm, frame);
            displayPatterns(patterns, save(state));
            console.log(`\nNew pattern: BPM=${state.bpm}, Key=${state.key}, Scale=${state.scale === scales.major ? "Major" : "Minor"}`);
        }
        
        // Only show position indicator every 16 steps to avoid console spam
        if (positionInPattern % 16 === 0) {
            process.stdout.write(`Position: ${positionInPattern}\r`);
        }
        
        // Play notes through audio engine
        synths[0].play(patterns[0][positionInPattern]);
        synths[1].play(patterns[1][positionInPattern]);
        synths[2].play(patterns[2][positionInPattern]);
        synths[3].play(patterns[3][positionInPattern]);
        synths[4].play(patterns[4][positionInPattern]);
    }
    
    // Start the clock
    clock.set(state.bpm, frame);
    
    // Set up duration limit if specified
    if (duration > 0) {
        endTimeoutId = setTimeout(() => {
            clock.stop();
            console.log("\nPlayback finished after specified duration.");
            process.exit(0);
        }, duration * 1000);
    }
    
    // Handle keyboard input to stop playback
    process.stdin.setRawMode(true);
    process.stdin.on('data', (data) => {
        // Check for Ctrl+C or 'q' to quit
        if (data.toString() === '\u0003' || data.toString().toLowerCase() === 'q') {
            if (endTimeoutId) clearTimeout(endTimeoutId);
            clock.stop();
            console.log("\nPlayback stopped.");
            process.exit(0);
        }
    });
    
    console.log("\nPress 'q' or Ctrl+C to stop playback");
}

// Parse command line arguments
const args = process.argv.slice(2);
let seed = "";
let duration = 0;

for (let i = 0; i < args.length; i++) {
    if (args[i] === "--seed" || args[i] === "-s") {
        seed = args[i+1] || "";
        i++;
    } else if (args[i] === "--duration" || args[i] === "-d") {
        duration = parseInt(args[i+1] || "0", 10);
        i++;
    } else if (args[i] === "--help" || args[i] === "-h") {
        console.log("AutoTracker CLI - Endless algorithmic chiptune generator");
        console.log("\nUsage:");
        console.log("  bun cli.ts [options]");
        console.log("\nOptions:");
        console.log("  -s, --seed <seed>       Provide a seed string or save code (starts with 0x)");
        console.log("  -d, --duration <secs>   Set playback duration in seconds (0 = unlimited)");
        console.log("  -h, --help              Show this help message");
        process.exit(0);
    }
}

runAutotracker(seed, duration).catch(err => {
    console.error("Error running AutoTracker:", err);
    process.exit(1);
});