# AutoTracker Development Guide

## Build Commands
- `npm install` - Install dependencies
- `npm run dev` - Start development server with hot reloading
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run typecheck` - Check TypeScript types without building

## Code Style Guidelines
- **TypeScript**: Strict mode enabled, targeting ES2020
- **Naming**: camelCase for variables/functions, PascalCase for types/classes
- **Types**: Use explicit type annotations, interfaces for complex objects
- **Imports**: No need to include file extensions (modern bundler will handle)
- **Error Handling**: Use type guards and proper null checking
- **Format**: 4-space indentation, braces on same line
- **Components**: Single function/class per file, export default for main exports
- **Comments**: File headers include copyright notice and license info
- **Type Structure**: Export type definitions from model.ts
- **Audio Context**: Encapsulate Web Audio API usage in audio.ts

## Project Structure
- `src/` - TypeScript source files
- `dist/` - Production bundled files
- `model.ts` - Core type definitions
- `audio.ts` - Web Audio API functionality
- `theory.ts` - Music theory concepts
- `generators.ts` - Pattern generation algorithms