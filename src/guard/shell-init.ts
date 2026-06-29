export type SupportedShell = 'bash' | 'zsh' | 'fish';

const POSIX_SNIPPET = `# slopcheck guard — pre-check npm installs. Add to your ~/.bashrc or ~/.zshrc:
#   eval "$(slopcheck init-shell zsh)"
npm() {
  case "$1" in
    install|i|add)
      command slopcheck guard "\${@:2}" || return $?
      ;;
  esac
  command npm "$@"
}`;

const FISH_SNIPPET = `# slopcheck guard — pre-check npm installs. Add to your ~/.config/fish/config.fish:
#   slopcheck init-shell fish | source
function npm
  switch "$argv[1]"
    case install i add
      command slopcheck guard $argv[2..-1]; or return $status
  end
  command npm $argv
end`;

/**
 * Emit a shell function that shadows `npm` so `install`/`i`/`add` are pre-checked
 * by `slopcheck guard` before the real npm runs. Opt-in transparent adoption.
 */
export function shellInitSnippet(shell: SupportedShell): string {
  return shell === 'fish' ? FISH_SNIPPET : POSIX_SNIPPET;
}
