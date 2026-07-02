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

Sleep 1500ms
