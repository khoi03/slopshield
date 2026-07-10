# slopshield demo — record with:  vhs demo.tape   → produces demo.gif
#
# Prereqs:
#   brew install vhs                 # macOS (or see github.com/charmbracelet/vhs)
#   npm install -g slopshield        # so `slopshield` is on PATH
#
# The scan commands hit the live npm registry, so each has a Sleep to let the
# output finish rendering. If your network is slow, bump the Sleep values.

Output demo.gif

Require slopshield

Set Shell "bash"
Set FontSize 20
Set Width 1200
Set Height 760
Set Padding 24
Set TypingSpeed 55ms
# Set Theme "Dracula"   # optional — see `vhs themes` for the full list

# --- intro ---
Type "# slopshield — catch AI-hallucinated & typosquatted npm packages"
Enter
Sleep 1200ms

# --- 1. safe packages pass quietly ---
Type "slopshield express react lodash"
Sleep 400ms
Enter
Sleep 4s

# --- 2. a typo? it names the real target ---
Type "slopshield expresss reqeust"
Sleep 400ms
Enter
Sleep 4s

# --- 3. a hallucinated package that doesn't exist → critical ---
Type "slopshield react-async-hyperstore-provider-x9qz"
Sleep 400ms
Enter
Sleep 4s

# --- 4. block a real typosquat before npm ever runs ---
Type 'slopshield guard crossenv --block; echo "exit: $?"'
Sleep 400ms
Enter
Sleep 4s

# --- 5. --quiet: only the flagged packages, plus a summary line (great for CI) ---
Type "slopshield express lodash expresss crossenv --quiet"
Sleep 400ms
Enter
Sleep 4s

# --- 6. NEW in 0.3.0: the AI-agent guard — a hallucinated install, blocked live ---
Type "# 0.3.0: route every npm install your AI agent runs through slopshield first"
Enter
Sleep 1200ms

# Stage the PreToolUse payload an agent would send (hidden — keeps the demo clean,
# and side-steps vhs quote escaping by writing the JSON via a quoted heredoc).
Hide
Type "cat > agent-install.json <<'EOF'"
Enter
Type '{"tool_name":"Bash","tool_input":{"command":"npm install react-async-hyperstore-provider-x9qz"}}'
Enter
Type "EOF"
Enter
Show

Type "# the agent proposes installing a package it hallucinated:"
Enter
Sleep 900ms
Type "slopshield hook < agent-install.json"
Sleep 400ms
Enter
Sleep 3500ms
Type "# blocked — the reason is handed back to the model so it self-corrects."
Enter
Sleep 1200ms
Type "# (also new: slopshield mcp exposes a check_package tool to any MCP agent)"
Enter
Sleep 1500ms

# clean up the staged payload
Hide
Type "rm -f agent-install.json"
Enter
Show

Sleep 1500ms
