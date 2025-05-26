# AutoTracker CLI

A command-line version of the endless randomised algorithmic Chiptune composition by [Vitling](https://www.vitling.xyz) aka [Demoscene Time Machine](http://demoscenetimemachine.com)

Originally a web-based tool, this version has been converted to run in the terminal using Bun.

## Installation

Make sure you have [Bun](https://bun.sh) installed on your system, then run:

```bash
# Install dependencies
bun install
```

## Usage

```bash
# Basic usage
bun start

# Provide a seed
bun start --seed "myseed"

# Provide a seed and set duration (in seconds)
bun start --seed "myseed" --duration 60

# Show help
bun start --help
```

## Command Line Options

- `-s, --seed <seed>`: Provide a seed string or save code (starts with 0x)
- `-d, --duration <secs>`: Set playback duration in seconds (0 = unlimited)
- `-h, --help`: Show help message

## Controls

- Press `q` or `Ctrl+C` to stop playback

## Original Version

The web-based version exists [online here](https://www.vitling.xyz/toys/autotracker/)

This work is licensed under a [Commons Attribution 4.0 International License](http://creativecommons.org/licenses/by/4.0/)
