#!/bin/bash

# Variables for file paths
BACKUP_NAME="dart_full_backup"
BACKUP_DIR="backup"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
ZIP_NAME="$BACKUP_NAME_$TIMESTAMP.zip"

# Create a backup directory
mkdir -p $BACKUP_DIR

# Copy repository files into backup directory
cp -r * $BACKUP_DIR

# Save git metadata (if this is needed for clone purposes)
mkdir -p $BACKUP_DIR/.git
cp -r .git/* $BACKUP_DIR/.git/

# Include Firestore data (if applicable)
if [ -d "data/firestore_backup" ]; then
  mkdir -p $BACKUP_DIR/data
  cp -r data/firestore_backup $BACKUP_DIR/data/
fi

# Include LocalStorage backup (if applicable)
if [ -f "localstorage-backup.json" ]; then
  cp localstorage-backup.json $BACKUP_DIR/
fi

# Create the ZIP file
zip -r $ZIP_NAME $BACKUP_DIR

# Clean up backup directory
rm -rf $BACKUP_DIR

echo "Backup completed: $ZIP_NAME"