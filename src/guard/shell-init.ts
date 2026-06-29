export type SupportedShell = 'bash' | 'zsh' | 'fish';

const POSIX_SNIPPET = `# slopshield guard — pre-check npm installs. Add to your ~/.bashrc or ~/.zshrc:
#   eval "$(slopshield init-shell zsh)"
npm() {
  case "$1" in
    install|i|add)
      # Only gate when packages are named; a bare "npm install" runs npm directly.
      if [ "$#" -gt 1 ]; then
        command slopshield guard "\${@:2}" || return $?
      fi
      ;;
  esac
  command npm "$@"
}`;

const FISH_SNIPPET = `# slopshield guard — pre-check npm installs. Add to your ~/.config/fish/config.fish:
#   slopshield init-shell fish | source
function npm
  switch "$argv[1]"
    case install i add
      # Only gate when packages are named; a bare "npm install" runs npm directly.
      if test (count $argv) -gt 1
        command slopshield guard $argv[2..-1]; or return $status
      end
  end
  command npm $argv
end`;

/**
 * Emit a shell function that shadows `npm` so `install`/`i`/`add` are pre-checked
 * by `slopshield guard` before the real npm runs. Opt-in transparent adoption.
 */
export function shellInitSnippet(shell: SupportedShell): string {
  return shell === 'fish' ? FISH_SNIPPET : POSIX_SNIPPET;
}
