#!/usr/bin/env bash
# One-time local setup for Sprint 2. Creates the three server keypairs, prints the addresses to fund,
# and writes .env from .env.example with the Helius key you paste in. Never commits anything.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v solana >/dev/null; then
  echo "Installing Solana CLI…"; sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
  export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
fi
mkdir -p keys && chmod 700 keys
for k in deploy crank sponsor; do
  [ -f "keys/$k.json" ] || solana-keygen new --no-bip39-passphrase --silent --outfile "keys/$k.json"
done
grep -q '^keys/' .gitignore || echo 'keys/' >> .gitignore

b58() { node -e "const bs58=require('bs58');const k=require('./keys/$1.json');process.stdout.write(bs58.default?bs58.default.encode(Buffer.from(k)):bs58.encode(Buffer.from(k)))"; }
if [ ! -f .env ]; then cp .env.example .env; fi
node -e "
const fs=require('fs');const bs58=require('bs58');const enc=b=>(bs58.default||bs58).encode(Buffer.from(require('./keys/'+b+'.json')));
let e=fs.readFileSync('.env','utf8');
e=e.replace(/^CRANK_SECRET=.*$/m,'CRANK_SECRET='+enc('crank')).replace(/^SPONSOR_SECRET=.*$/m,'SPONSOR_SECRET='+enc('sponsor'));
fs.writeFileSync('.env',e);"
HELIUS=$(grep '^HELIUS_API_KEY=' .env | cut -d= -f2-)
CLUSTER=$(grep '^SOLANA_CLUSTER=' .env | cut -d= -f2-); [ "$CLUSTER" = "mainnet-beta" ] && HOST=mainnet || HOST=devnet
RPC="https://${HOST}.helius-rpc.com/?api-key=${HELIUS}"
solana config set --url "$RPC" --keypair keys/deploy.json >/dev/null

echo
echo "Fund these from Phantom, then continue:"
printf "  deploy  %s   ← ~4 SOL (program rent) \n" "$(solana-keygen pubkey keys/deploy.json)"
printf "  crank   %s   ← 0.1 SOL\n" "$(solana-keygen pubkey keys/crank.json)"
printf "  sponsor %s   ← 0.2 SOL (pays users' fees)\n" "$(solana-keygen pubkey keys/sponsor.json)"
echo
echo "Keys written into .env (HELIUS_API_KEY stays whatever you pasted). Next: npm run check:token2022 <your-phantom-address>  then  npm run check:depth"
