#!/bin/bash
# Create a temporary repo for GitHub Pages
REPO_NAME="sound-architect-$(date +%s)"

cd dist

# Initialize git
git init
git config user.email "deploy@example.com"
git config user.name "Deploy"

# Add all files
git add .
git commit -m "Deploy to GitHub Pages"

# Force push to orphan branch
git checkout --orphan gh-pages
git add .
git commit -m "Deploy"

echo "Ready to push to: $REPO_NAME"
