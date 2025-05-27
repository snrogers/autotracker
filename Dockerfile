FROM --platform=linux/amd64 oven/bun:latest as builder

WORKDIR /app

# Copy project files
COPY . .

# Install dependencies 
RUN bun install --frozen-lockfile

# Build the binary
RUN bun build ./src/cli.ts --compile --outfile autotracker-amd64