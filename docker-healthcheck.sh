#!/bin/sh
wget --spider -q http://localhost:8000/api/health || exit 1 