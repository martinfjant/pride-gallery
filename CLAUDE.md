# CLAUDE.md

## Node / npm through fish + nvm

The user's shell is fish with **nvm.fish**, which does **not** put `node`/`npm`/`npx`
on `PATH` in the non-interactive Bash tool. `node`, `npm`, `npx`, `which node`,
and `fish -l -c 'node ...'` all fail with "command not found". Don't retry those.

nvm.fish installs live under `~/.local/share/nvm/v<version>/bin`. Prepend the
newest one to `PATH` at the start of any command that needs node:

```bash
export PATH="$(ls -d ~/.local/share/nvm/v*/bin | sort -V | tail -1):$PATH"
node --version   # now works; npm / npx too
```

Common tasks (run from the repo root with the export above):

```bash
# Typecheck without emitting
node ./node_modules/typescript/bin/tsc --noEmit

# Build (compiles src/ -> dist/)
npm run build        # === tsc

# Start the Functions host locally
npm start            # runs prestart clean+build, then `func start`
```
