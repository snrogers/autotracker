#!/usr/bin/env bash
echo "Compiling typescript to javascript"
npx tsc -p . --extendedDiagnostics
rm dist/*
echo "Bundling and minifying output"
npx parcel build --target browser --log-level 2 --detailed-report 10 target/tracker.js
